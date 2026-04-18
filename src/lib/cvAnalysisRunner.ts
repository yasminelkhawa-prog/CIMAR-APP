// Singleton background runner for CV analysis.
// Survives component unmount (sidebar navigation) so analysis keeps going
// and results land in the DB regardless of what the user is viewing.

import { supabase } from '@/integrations/supabase/client';

type Listener = (state: RunnerState) => void;

export interface RunnerState {
  isAnalyzing: boolean;
  current: number;
  total: number;
  stage: 'idle' | 'extracting' | 'analyzing' | 'done';
  message: string;
}

const initialState: RunnerState = {
  isAnalyzing: false,
  current: 0,
  total: 0,
  stage: 'idle',
  message: '',
};

let state: RunnerState = { ...initialState };
const listeners = new Set<Listener>();

function setState(patch: Partial<RunnerState>) {
  state = { ...state, ...patch };
  listeners.forEach((l) => l(state));
}

export const cvAnalysisRunner = {
  getState: () => state,
  subscribe(listener: Listener) {
    listeners.add(listener);
    listener(state);
    return () => listeners.delete(listener);
  },
  isRunning: () => state.isAnalyzing,
  async run(params: {
    cvTexts: { text: string; filePath: string }[];
    sessionId: string;
    targetPositions: string[];
    onComplete?: () => void;
    onError?: (msg: string) => void;
    onSuccess?: (count: number, total: number, failed: number) => void;
  }) {
    if (state.isAnalyzing) return;
    setState({
      isAnalyzing: true,
      stage: 'analyzing',
      current: 0,
      total: params.cvTexts.length,
      message: `Analyse IA de ${params.cvTexts.length} CV en cours...`,
    });
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
            cvTexts: params.cvTexts,
            sessionId: params.sessionId,
            targetPositions: params.targetPositions,
          }),
        }
      );
      if (resp.status === 429) params.onError?.('Limite de requêtes atteinte');
      else if (resp.status === 402) params.onError?.('Crédits IA insuffisants');
      else if (!resp.ok) params.onError?.("Erreur lors de l'analyse IA");
      else {
        const data = await resp.json();
        const count = data.results?.length || 0;
        const total = data.total || params.cvTexts.length;
        const failedCount = (data.failed?.length) ?? (total - count);
        params.onSuccess?.(count, total, failedCount);
      }
    } catch (e) {
      console.error('Analysis error:', e);
      params.onError?.("Erreur de connexion au service d'analyse");
    } finally {
      setState({ ...initialState, stage: 'done' });
      params.onComplete?.();
    }
  },
  setExtractionProgress(current: number, total: number, fileName?: string) {
    setState({
      isAnalyzing: true,
      stage: 'extracting',
      current,
      total,
      message: fileName ? `Extraction: ${fileName}` : `Extraction (${current}/${total})`,
    });
  },
};
