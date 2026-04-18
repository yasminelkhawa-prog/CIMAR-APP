/**
 * Template-faithful export of the CIMAR interview evaluation grid.
 * Loads the original .docx template (preserves 100% of layout & styling) and
 * fills the {date}, {lieu}, {nomCandidat}, {nomIntervieweur} placeholders.
 */
import PizZip from 'pizzip';
import Docxtemplater from 'docxtemplater';
import { saveAs } from 'file-saver';
import templateUrl from '@/assets/templates/grille_evaluation_template.docx?url';
import type { EvaluationForm } from '@/types/evaluation';

export async function exportEvaluationDocx(
  evaluation: EvaluationForm,
  interviewerFallback?: string,
) {
  // cache-bust to make sure we never serve a stale template
  const res = await fetch(`${templateUrl}?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load evaluation template');
  const buf = await res.arrayBuffer();

  const zip = new PizZip(buf);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' },
  });

  const data = {
    date: evaluation.date
      ? new Date(evaluation.date).toLocaleDateString('fr-FR')
      : '',
    lieu: evaluation.location || '',
    nomCandidat: evaluation.candidateName || '',
    nomIntervieweur: evaluation.interviewerName || interviewerFallback || '',
  };

  // eslint-disable-next-line no-console
  console.log('[evaluationDocxExport] Filling template with:', data);

  try {
    doc.render(data);
  } catch (err: any) {
    // eslint-disable-next-line no-console
    console.error('[evaluationDocxExport] render error:', err, err?.properties);
    throw err;
  }

  const out = doc.getZip().generate({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  const safeName = (evaluation.candidateName || 'evaluation').replace(/\s+/g, '_');
  saveAs(out, `Grille_evaluation_${safeName}.docx`);
}
