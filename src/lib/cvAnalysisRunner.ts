// Singleton background runner for CV analysis.
// Survives component unmount (sidebar navigation) so analysis keeps going
// and results land in the DB regardless of what the user is viewing.
//
// Processes CVs one by one against the edge function so we get live
// per-CV progress (current name) AND keep failed CVs in memory for retry
// without re-uploading.

import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';

type Listener = (state: RunnerState) => void;

export interface CvPayload {
  text: string;
  filePath: string;
}

export interface FailedCv extends CvPayload {
  reason: string;
}

export interface RunnerState {
  isAnalyzing: boolean;
  current: number;
  total: number;
  stage: 'idle' | 'extracting' | 'analyzing' | 'done';
  message: string;
  currentName: string;
  failed: FailedCv[];
  succeeded: number;
  sessionId: string | null;
  targetPositions: string[];
}

const initialState: RunnerState = {
  isAnalyzing: false,
  current: 0,
  total: 0,
  stage: 'idle',
  message: '',
  currentName: '',
  failed: [],
  succeeded: 0,
  sessionId: null,
  targetPositions: [],
};

let state: RunnerState = { ...initialState };
const listeners = new Set<Listener>();

function setState(patch: Partial<RunnerState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

function prettyName(filePath: string) {
  const base = filePath.split('/').pop() || filePath;
  return base.replace(/\.[^.]+$/, '');
}

async function analyzeOne(
  cv: CvPayload,
  sessionId: string,
  targetPositions: string[]
): Promise<{ ok: boolean; reason?: string }> {
  try {
    const resp = await fetch(
      `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/analyze-cv`,
      {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_PUBLISHABLE_KEY}`,
        },
        body: JSON.stringify({
          cvTexts: [cv],
          sessionId,
          targetPositions,
        }),
      }
    );
    if (resp.status === 429) return { ok: false, reason: 'Rate limit' };
    if (resp.status === 402) return { ok: false, reason: 'Crédits IA' };
    if (!resp.ok) return { ok: false, reason: `HTTP ${resp.status}` };
    const data = await resp.json();
    if ((data.results?.length || 0) > 0) return { ok: true };
    return { ok: false, reason: 'Pas de résultat IA' };
  } catch (e: any) {
    return { ok: false, reason: e?.message || 'Erreur réseau' };
  }
}

async function runQueue(
  cvs: CvPayload[],
  sessionId: string,
  targetPositions: string[],
  callbacks: {
    onError?: (msg: string) => void;
    onSuccess?: (count: number, total: number, failed: number) => void;
    onComplete?: () => void;
  }
) {
  const total = cvs.length;
  setState({
    isAnalyzing: true,
    stage: 'analyzing',
    current: 0,
    total,
    succeeded: 0,
    failed: [],
    sessionId,
    targetPositions,
    message: `Analyse IA de ${total} CV en cours...`,
    currentName: '',
  });

  const failed: FailedCv[] = [];
  let succeeded = 0;

  for (let i = 0; i < cvs.length; i++) {
    const cv = cvs[i];
    const name = prettyName(cv.filePath);
    setState({
      current: i + 1,
      currentName: name,
      message: `${i + 1}/${total} — ${name}`,
    });
    const res = await analyzeOne(cv, sessionId, targetPositions);
    if (res.ok) {
      succeeded += 1;
      setState({ succeeded });
      toast.success(`✓ ${name}`, {
        description: `Analysé (${i + 1}/${total})`,
        duration: 2500,
      });
    } else {
      failed.push({ ...cv, reason: res.reason || 'Échec' });
      setState({ failed: [...failed] });
      toast.error(`✗ ${name}`, {
        description: `Échec: ${res.reason || 'Erreur'} (${i + 1}/${total})`,
        duration: 3500,
      });
    }
  }

  if (failed.length > 0) {
    callbacks.onError?.(`${failed.length} CV en échec — vous pouvez relancer.`);
  }
  callbacks.onSuccess?.(succeeded, total, failed.length);

  setState({
    isAnalyzing: false,
    stage: 'done',
    currentName: '',
    message: failed.length
      ? `${succeeded}/${total} analysés — ${failed.length} échec(s)`
      : `${succeeded}/${total} CV analysés`,
  });
  callbacks.onComplete?.();
}

export const cvAnalysisRunner = {
  getState: () => state,
  subscribe(listener: Listener) {
    listeners.add(listener);
    listener(state);
    return () => listeners.delete(listener);
  },
  isRunning: () => state.isAnalyzing,
  hasFailed: () => state.failed.length > 0,
  getFailed: () => state.failed,

  async run(params: {
    cvTexts: CvPayload[];
    sessionId: string;
    targetPositions: string[];
    onComplete?: () => void;
    onError?: (msg: string) => void;
    onSuccess?: (count: number, total: number, failed: number) => void;
  }) {
    if (state.isAnalyzing) return;
    await runQueue(params.cvTexts, params.sessionId, params.targetPositions, params);
  },

  async retryFailed(callbacks: {
    onComplete?: () => void;
    onError?: (msg: string) => void;
    onSuccess?: (count: number, total: number, failed: number) => void;
  }) {
    if (state.isAnalyzing) return;
    const toRetry = state.failed.map(({ text, filePath }) => ({ text, filePath }));
    if (toRetry.length === 0) return;
    const sessionId = state.sessionId || crypto.randomUUID();
    const targets = state.targetPositions;
    if (targets.length === 0) {
      callbacks.onError?.('Aucun poste cible défini');
      return;
    }
    await runQueue(toRetry, sessionId, targets, callbacks);
  },

  clearFailed() {
    setState({ failed: [] });
  },

  setExtractionProgress(current: number, total: number, fileName?: string) {
    setState({
      isAnalyzing: true,
      stage: 'extracting',
      current,
      total,
      currentName: fileName || '',
      message: fileName ? `Extraction: ${fileName}` : `Extraction (${current}/${total})`,
    });
  },
};
