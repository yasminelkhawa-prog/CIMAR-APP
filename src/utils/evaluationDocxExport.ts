/**
 * Template-faithful export of the CIMAR interview evaluation grid.
 * Loads the original .docx template (preserves 100% of layout & styling) and
 * fills the {date}, {lieu}, {nomCandidat}, {nomIntervieweur} placeholders.
 */
import PizZip from 'pizzip';
import { saveAs } from 'file-saver';
import templateUrl from '@/assets/templates/grille_evaluation_template.docx?url';
import type { EvaluationForm } from '@/types/evaluation';

function escapeXml(value: string) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&apos;');
}

export async function exportEvaluationDocx(
  evaluation: EvaluationForm,
  interviewerFallback?: string,
) {
  const res = await fetch(`${templateUrl}?v=${Date.now()}`, { cache: 'no-store' });
  if (!res.ok) throw new Error('Failed to load evaluation template');
  const buf = await res.arrayBuffer();

  const zip = new PizZip(buf);
  const data = {
    date: evaluation.date
      ? new Date(evaluation.date).toLocaleDateString('fr-FR')
      : '',
    lieu: evaluation.location || '',
    nomCandidat: evaluation.candidateName || '',
    nomIntervieweur: evaluation.interviewerName || interviewerFallback || '',
  };

  const replacements = Object.entries(data).map(([key, value]) => [
    `{${key}}`,
    escapeXml(value),
  ] as const);

  Object.keys(zip.files)
    .filter((fileName) => fileName.startsWith('word/') && fileName.endsWith('.xml'))
    .forEach((fileName) => {
      const file = zip.file(fileName);
      const xml = file?.asText();
      if (!xml) return;

      const nextXml = replacements.reduce(
        (content, [token, value]) => content.split(token).join(value),
        xml,
      );

      if (nextXml !== xml) {
        zip.file(fileName, nextXml);
      }
    });

  const out = zip.generate({
    type: 'blob',
    mimeType:
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });

  saveAs(out, 'Grille_d_évaluation_de_l_entretien_-_CIMAR.docx');
}
