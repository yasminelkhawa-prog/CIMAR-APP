import { EvaluationForm, JobRoleConfig } from '@/types/evaluation';

export async function generateEvaluationPdf(
  evaluation: EvaluationForm,
  jobRole: JobRoleConfig | undefined,
  lang: 'en' | 'fr' = 'en'
) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 15;

  const labels = lang === 'fr' ? {
    title: 'GRILLE D\'ÉVALUATION DE L\'ENTRETIEN',
    company: 'Ciments du Maroc - Heidelberg Materials',
    candidate: 'Candidat',
    source: 'Source',
    internal: 'Interne',
    external: 'Externe',
    position: 'Poste',
    interviewer: 'Intervieweur',
    date: 'Date',
    location: 'Lieu',
    reason: 'Motif',
    type: 'Type',
    replacement: 'Remplacement',
    creation: 'Création de Poste',
    other: 'Autre',
    budgeted: 'Budgétisé',
    nonBudgeted: 'Non Budgétisé',
    criteria: 'Critères d\'Évaluation',
    weight: 'Poids',
    score: 'Note',
    total: 'Score Total',
    comments: 'Commentaires',
    decision: 'Décision',
    favorable: 'Favorable',
    unfavorable: 'Défavorable',
    pending: 'En attente',
    scoreLabels: ['', 'Insuffisant', 'Passable', 'Bien', 'Excellent'],
  } : {
    title: 'INTERVIEW EVALUATION GRID',
    company: 'Ciments du Maroc - Heidelberg Materials',
    candidate: 'Candidate',
    source: 'Source',
    internal: 'Internal',
    external: 'External',
    position: 'Position',
    interviewer: 'Interviewer',
    date: 'Date',
    location: 'Location',
    reason: 'Reason',
    type: 'Type',
    replacement: 'Replacement',
    creation: 'New Position',
    other: 'Other',
    budgeted: 'Budgeted',
    nonBudgeted: 'Non-Budgeted',
    criteria: 'Evaluation Criteria',
    weight: 'Weight',
    score: 'Score',
    total: 'Total Score',
    comments: 'Comments',
    decision: 'Decision',
    favorable: 'Favorable',
    unfavorable: 'Unfavorable',
    pending: 'Pending',
    scoreLabels: ['', 'Insufficient', 'Passable', 'Good', 'Excellent'],
  };

  // Header
  doc.setFillColor(0, 100, 60);
  doc.rect(0, 0, pageWidth, 28, 'F');
  doc.setTextColor(255, 255, 255);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.text(labels.title, pageWidth / 2, 12, { align: 'center' });
  doc.setFontSize(10);
  doc.setFont('helvetica', 'normal');
  doc.text(labels.company, pageWidth / 2, 20, { align: 'center' });

  y = 36;
  doc.setTextColor(0, 0, 0);

  // Candidate info
  const drawField = (label: string, value: string, x: number, yPos: number, w: number) => {
    doc.setFontSize(8);
    doc.setTextColor(100, 100, 100);
    doc.text(label, x, yPos);
    doc.setFontSize(10);
    doc.setTextColor(0, 0, 0);
    doc.setFont('helvetica', 'bold');
    doc.text(value || '-', x, yPos + 5);
    doc.setFont('helvetica', 'normal');
    doc.line(x, yPos + 7, x + w, yPos + 7);
  };

  const reasonLabel = evaluation.recruitmentReason === 'replacement' ? labels.replacement :
    evaluation.recruitmentReason === 'creation' ? labels.creation : labels.other;
  const typeLabel = evaluation.recruitmentType === 'budgeted' ? labels.budgeted : labels.nonBudgeted;
  const sourceLabel = evaluation.candidateSource === 'internal' ? labels.internal : labels.external;

  drawField(labels.candidate, evaluation.candidateName, margin, y, contentWidth / 3 - 5);
  drawField(labels.source, sourceLabel, margin + contentWidth / 3, y, contentWidth / 3 - 5);
  drawField(labels.position, jobRole?.name || '-', margin + (contentWidth / 3) * 2, y, contentWidth / 3);
  y += 16;
  drawField(labels.interviewer, evaluation.interviewerName, margin, y, contentWidth / 4 - 5);
  drawField(labels.date, evaluation.date, margin + contentWidth / 4, y, contentWidth / 4 - 5);
  drawField(labels.location, evaluation.location, margin + (contentWidth / 4) * 2, y, contentWidth / 4 - 5);
  drawField(labels.reason, `${reasonLabel} / ${typeLabel}`, margin + (contentWidth / 4) * 3, y, contentWidth / 4);
  y += 20;

  // Scoring table
  if (jobRole) {
    doc.setFillColor(0, 100, 60);
    doc.rect(margin, y, contentWidth, 8, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(labels.criteria, margin + 2, y + 5.5);
    doc.text(labels.weight, margin + contentWidth - 55, y + 5.5);
    doc.text('1', margin + contentWidth - 35, y + 5.5);
    doc.text('2', margin + contentWidth - 25, y + 5.5);
    doc.text('3', margin + contentWidth - 15, y + 5.5);
    doc.text('4', margin + contentWidth - 5, y + 5.5);
    y += 8;

    let totalWeighted = 0;
    let maxWeighted = 0;

    jobRole.categories.forEach(cat => {
      // Category header
      doc.setFillColor(220, 235, 228);
      doc.rect(margin, y, contentWidth, 7, 'F');
      doc.setTextColor(0, 80, 50);
      doc.setFontSize(9);
      doc.setFont('helvetica', 'bold');
      doc.text(cat.name.toUpperCase(), margin + 2, y + 5);
      y += 7;

      cat.criteria.forEach(crit => {
        const score = evaluation.scores.find(s => s.criterionId === crit.id)?.score || 0;
        totalWeighted += score * crit.weight;
        maxWeighted += jobRole.scaleMax * crit.weight;

        doc.setTextColor(0, 0, 0);
        doc.setFont('helvetica', 'normal');
        doc.setFontSize(8);
        doc.text(crit.name, margin + 2, y + 5);
        doc.setTextColor(120, 120, 120);
        doc.setFontSize(7);

        const descLines = doc.splitTextToSize(crit.description, contentWidth - 70);
        doc.text(descLines[0] || '', margin + 2, y + 9);

        doc.setTextColor(0, 0, 0);
        doc.setFontSize(8);
        doc.text(`×${crit.weight}`, margin + contentWidth - 55, y + 6);

        // Score circles
        for (let v = 1; v <= 4; v++) {
          const cx = margin + contentWidth - 40 + v * 10;
          if (score === v) {
            doc.setFillColor(0, 100, 60);
            doc.circle(cx, y + 5, 3, 'F');
            doc.setTextColor(255, 255, 255);
          } else {
            doc.setDrawColor(180, 180, 180);
            doc.circle(cx, y + 5, 3, 'S');
            doc.setTextColor(150, 150, 150);
          }
          doc.setFontSize(7);
          doc.text(String(v), cx - 1, y + 6.5);
        }

        doc.setDrawColor(230, 230, 230);
        y += 12;
        doc.line(margin, y, margin + contentWidth, y);

        if (y > 270) {
          doc.addPage();
          y = 15;
        }
      });
    });

    // Total score
    y += 3;
    const pct = maxWeighted > 0 ? Math.round((totalWeighted / maxWeighted) * 100) : 0;
    doc.setFillColor(0, 100, 60);
    doc.rect(margin, y, contentWidth, 10, 'F');
    doc.setTextColor(255, 255, 255);
    doc.setFontSize(11);
    doc.setFont('helvetica', 'bold');
    doc.text(`${labels.total}: ${totalWeighted}/${maxWeighted} (${pct}%)`, margin + 5, y + 7);
    y += 16;
  }

  // Comments
  if (y > 250) { doc.addPage(); y = 15; }
  doc.setTextColor(0, 80, 50);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(labels.comments, margin, y);
  y += 5;
  doc.setTextColor(0, 0, 0);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const commentLines = doc.splitTextToSize(evaluation.comments || '-', contentWidth);
  doc.text(commentLines, margin, y);
  y += commentLines.length * 4 + 8;

  // Decision
  doc.setTextColor(0, 80, 50);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(labels.decision, margin, y);
  y += 6;
  const decisionText = evaluation.decision === 'favorable' ? labels.favorable :
    evaluation.decision === 'unfavorable' ? labels.unfavorable : labels.pending;
  const decisionColor: [number, number, number] = evaluation.decision === 'favorable' ? [34, 139, 34] :
    evaluation.decision === 'unfavorable' ? [220, 53, 69] : [150, 150, 150];
  doc.setTextColor(...decisionColor);
  doc.setFontSize(14);
  doc.text(decisionText.toUpperCase(), margin, y + 2);

  // Footer
  doc.setTextColor(150, 150, 150);
  doc.setFontSize(7);
  doc.text(`Generated on ${new Date().toLocaleDateString()} — Numa Evaluation System`, pageWidth / 2, 290, { align: 'center' });

  doc.save(`evaluation-${evaluation.candidateName.replace(/\s+/g, '-')}-${evaluation.date}.pdf`);
}
