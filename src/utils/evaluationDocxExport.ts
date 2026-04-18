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
  const res = await fetch(templateUrl);
  if (!res.ok) throw new Error('Failed to load evaluation template');
  const buf = await res.arrayBuffer();

  const zip = new PizZip(buf);
  const doc = new Docxtemplater(zip, {
    paragraphLoop: true,
    linebreaks: true,
    delimiters: { start: '{', end: '}' },
  });

  doc.render({
    date: evaluation.date || '',
    lieu: evaluation.location || '',
    nomCandidat: evaluation.candidateName || '',
    nomIntervieweur: evaluation.interviewerName || interviewerFallback || '',
  });

  const out = doc.getZip().generate({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  const safeName = (evaluation.candidateName || 'evaluation').replace(/\s+/g, '_');
  saveAs(out, `Grille_evaluation_${safeName}.docx`);
}
