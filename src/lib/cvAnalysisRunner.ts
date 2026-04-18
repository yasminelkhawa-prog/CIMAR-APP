// Singleton background runner for CV analysis.
// Survives component unmount (sidebar navigation) so analysis keeps going
// and results land in the DB regardless of what the user is viewing.
//
// Processes CVs one by one against the edge function so we get live
// per-CV progress (current name) AND keep failed CVs in memory for retry
// without re-uploading.

import { toast } from 'sonner';
import { supabase } from '@/integrations/supabase/client';

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
const ANALYSIS_REQUEST_TIMEOUT_MS = 150_000;

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
    const data = await new Promise<any>(async (resolve, reject) => {
      const timeoutId = window.setTimeout(() => reject(new Error('Délai dépassé')), ANALYSIS_REQUEST_TIMEOUT_MS);

      try {
        const result = await supabase.functions.invoke('analyze-cv', {
          body: {
            cvTexts: [cv],
            sessionId,
            targetPositions,
          },
        });

        clearTimeout(timeoutId);

        if (result.error) {
          reject(result.error);
          return;
        }

        resolve(result.data);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });

    if (!data) return { ok: false, reason: 'Réponse invalide' };
    if ((data.results?.length || 0) > 0) return { ok: true };
    return { ok: false, reason: data.error || 'Pas de résultat IA' };
  } catch (e: any) {
    if (e?.name === 'AbortError') {
      return { ok: false, reason: 'Délai dépassé' };
    }

    const message = String(e?.message || e?.context?.statusText || 'Erreur réseau');
    if (message.includes('429')) return { ok: false, reason: 'Rate limit' };
    if (message.includes('402')) return { ok: false, reason: 'Crédits IA' };
    return { ok: false, reason: message };
  }
}

async function processBatch(
  cvs: CvPayload[],
  sessionId: string,
  targetPositions: string[],
  startIndex: number,
  totalOverride: number,
  isRetryPass: boolean
): Promise<{ failed: FailedCv[]; succeeded: number }> {
  const failed: FailedCv[] = [];
  let succeeded = 0;
  for (let i = 0; i < cvs.length; i++) {
    const cv = cvs[i];
    const name = prettyName(cv.filePath);
    const display = startIndex + i + 1;
    setState({
      current: display,
      currentName: name,
      message: `${display}/${totalOverride} — ${name}${isRetryPass ? ' (retry)' : ''}`,
    });
    const res = await analyzeOne(cv, sessionId, targetPositions);
    if (res.ok) {
      succeeded += 1;
      toast.success(`✓ ${name}`, {
        description: `Analysé (${display}/${totalOverride})`,
        duration: 2500,
      });
    } else {
      failed.push({ ...cv, reason: res.reason || 'Échec' });
      toast.error(`✗ ${name}`, {
        description: `Échec: ${res.reason || 'Erreur'} (${display}/${totalOverride})`,
        duration: 3500,
      });
    }
  }
  return { failed, succeeded };
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

  // Pass 1
  const pass1 = await processBatch(cvs, sessionId, targetPositions, 0, total, false);
  let totalSucceeded = pass1.succeeded;
  let stillFailed = pass1.failed;
  setState({ succeeded: totalSucceeded, failed: [...stillFailed] });

  // Auto-retry pass for failures (one extra pass)
  if (stillFailed.length > 0) {
    toast.info(`Auto-retry de ${stillFailed.length} CV en échec...`);
    setState({
      message: `Auto-retry de ${stillFailed.length} CV en échec...`,
      total: total + stillFailed.length,
    });
    const retryCvs = stillFailed.map(({ text, filePath }) => ({ text, filePath }));
    const pass2 = await processBatch(retryCvs, sessionId, targetPositions, total, total + retryCvs.length, true);
    totalSucceeded += pass2.succeeded;
    stillFailed = pass2.failed;
    setState({ succeeded: totalSucceeded, failed: [...stillFailed] });
  }

  if (stillFailed.length > 0) {
    callbacks.onError?.(`${stillFailed.length} CV en échec — vous pouvez relancer.`);
  }
  callbacks.onSuccess?.(totalSucceeded, total, stillFailed.length);

  setState({
    isAnalyzing: false,
    stage: 'done',
    currentName: '',
    message: stillFailed.length
      ? `${totalSucceeded}/${total} analysés — ${stillFailed.length} échec(s)`
      : `${totalSucceeded}/${total} CV analysés`,
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
    if (state.isAnalyzing && state.stage === 'analyzing') return;
    await runQueue(params.cvTexts, params.sessionId, params.targetPositions, params);
  },

  async retryFailed(callbacks: {
    onComplete?: () => void;
    onError?: (msg: string) => void;
    onSuccess?: (count: number, total: number, failed: number) => void;
  }) {
    if (state.isAnalyzing && state.stage === 'analyzing') return;
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

  /** Force-reset the runner state (used when extraction is aborted or stuck). */
  reset() {
    state = { ...initialState };
    listeners.forEach((l) => l(state));
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
