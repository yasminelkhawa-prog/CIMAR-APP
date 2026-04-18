import { EvaluationForm, JobRoleConfig } from '@/types/evaluation';
import logoImage from '../../public/cimar-logo-official.png';

const GREEN = [39, 124, 75] as const; // #277C4B - CIMAR green
const LIGHT_GREEN = [220, 237, 225] as const;
const DARK_GREEN = [30, 95, 58] as const;
const WHITE = [255, 255, 255] as const;
const BLACK = [0, 0, 0] as const;
const GRAY = [100, 100, 100] as const;
const BORDER_GREEN = [39, 124, 75] as const;

// X mark for checkboxes
const X_MARK = 'X';

export async function generateEvaluationPdf(
  evaluation: EvaluationForm,
  jobRole: JobRoleConfig | undefined,
  lang: 'en' | 'fr' = 'fr',
  signatureUrl?: string | null
) {
  const { jsPDF } = await import('jspdf');
  const doc = new jsPDF('p', 'mm', 'a4');
  const pageWidth = 210;
  const margin = 15;
  const contentWidth = pageWidth - margin * 2;
  let y = 12;

  const fr = lang === 'fr';

  // ── LOGO area ──
  // Add CIMAR official logo image
  const logoWidth = 70;
  const logoHeight = 22;
  try {
    doc.addImage(logoImage, 'PNG', margin, y, logoWidth, logoHeight);
  } catch {
    // Fallback to text if image fails
    doc.setFontSize(18);
    doc.setFont('helvetica', 'bold');
    doc.setTextColor(...DARK_GREEN);
    doc.text('Ciments du Maroc', margin, y + 5);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...GRAY);
    doc.text('Heidelberg Materials', margin, y + 11);
  }
  y += 26;

  // ── TITLE BOX ──
  const titleBoxH = 14;
  doc.setDrawColor(...BORDER_GREEN);
  doc.setLineWidth(0.8);
  doc.rect(margin, y, contentWidth, titleBoxH);
  doc.setFontSize(16);
  doc.setFont('helvetica', 'bold');
  doc.setTextColor(...BLACK);
  doc.text(
    fr ? "GRILLE D'ÉVALUATION DE L'ENTRETIEN" : 'INTERVIEW EVALUATION GRID',
    pageWidth / 2, y + titleBoxH / 2 + 2, { align: 'center' }
  );
  y += titleBoxH + 4;

  // ── INFO SECTION (bordered box) ──
  const infoStartY = y;
  const infoH = 52;
  doc.setDrawColor(...BORDER_GREEN);
  doc.setLineWidth(0.5);
  doc.rect(margin, y, contentWidth, infoH);

  const infoX = margin + 5;
  const midX = margin + contentWidth / 2 + 5;
  y += 8;

  // Row 1: Date / Lieu
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  doc.setTextColor(...BLACK);
  doc.text(`${fr ? 'Date' : 'Date'} :`, infoX, y);
  doc.setFont('helvetica', 'bold');
  doc.text(evaluation.date || '___', infoX + 20, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${fr ? 'Lieu' : 'Location'} :`, midX, y);
  doc.setFont('helvetica', 'bold');
  doc.text(evaluation.location || '___', midX + 20, y);
  y += 9;

  // Row 2: Candidate / Interviewer
  doc.setFont('helvetica', 'normal');
  doc.text(`${fr ? 'Nom & prénom du candidat' : 'Candidate name'} :`, infoX, y);
  doc.setFont('helvetica', 'bold');
  doc.text(evaluation.candidateName || '___', infoX + 55, y);
  doc.setFont('helvetica', 'normal');
  doc.text(`${fr ? "Nom de l'intervieweur" : 'Interviewer'} :`, midX, y);
  doc.setFont('helvetica', 'bold');
  doc.text(evaluation.interviewerName || '___', midX + 45, y);
  y += 9;

  // Row 3: Source de CV
  doc.setFont('helvetica', 'normal');
  doc.text(`${fr ? 'Source de CV' : 'CV Source'} :`, infoX, y);
  // Checkbox for Interne
  const cbSize = 3.5;
  const cbX1 = infoX + 30;
  doc.rect(cbX1, y - 3, cbSize, cbSize);
  if (evaluation.candidateSource === 'internal') {
    doc.setFont('helvetica', 'bold');
    doc.text(X_MARK, cbX1 + 0.8, y - 0.5);
  }
  doc.setFont('helvetica', 'normal');
  doc.text(fr ? 'Interne' : 'Internal', cbX1 + 5, y);

  const cbX2 = cbX1 + 30;
  doc.rect(cbX2, y - 3, cbSize, cbSize);
  if (evaluation.candidateSource === 'external') {
    doc.setFont('helvetica', 'bold');
    doc.text(X_MARK, cbX2 + 0.8, y - 0.5);
  }
  doc.setFont('helvetica', 'normal');
  doc.text(fr ? 'Externe' : 'External', cbX2 + 5, y);

  // Motif de recrutement
  doc.text(`${fr ? 'Motif de recrutement' : 'Recruitment reason'} :`, midX, y);
  const motifX = midX + 48;
  // Remplacement
  doc.rect(motifX, y - 3, cbSize, cbSize);
  if (evaluation.recruitmentReason === 'replacement') {
    doc.setFont('helvetica', 'bold');
    doc.text(X_MARK, motifX + 0.8, y - 0.5);
  }
  doc.setFont('helvetica', 'normal');
  doc.text(fr ? 'Remplacement' : 'Replacement', motifX + 5, y);
  y += 7;

  // Création de poste
  doc.rect(motifX, y - 3, cbSize, cbSize);
  if (evaluation.recruitmentReason === 'creation') {
    doc.setFont('helvetica', 'bold');
    doc.text(X_MARK, motifX + 0.8, y - 0.5);
  }
  doc.setFont('helvetica', 'normal');
  doc.text(fr ? 'Création de poste' : 'New position', motifX + 5, y);
  y += 7;

  // Row 4: Type de recrutement / Autre
  doc.text(`${fr ? 'Type de recrutement' : 'Recruitment type'} :`, infoX, y);
  const typeX1 = infoX + 42;
  doc.rect(typeX1, y - 3, cbSize, cbSize);
  if (evaluation.recruitmentType === 'budgeted') {
    doc.setFont('helvetica', 'bold');
    doc.text(X_MARK, typeX1 + 0.8, y - 0.5);
  }
  doc.setFont('helvetica', 'normal');
  doc.text(fr ? 'Budgété' : 'Budgeted', typeX1 + 5, y);

  const typeX2 = typeX1 + 30;
  doc.rect(typeX2, y - 3, cbSize, cbSize);
  if (evaluation.recruitmentType === 'non-budgeted') {
    doc.setFont('helvetica', 'bold');
    doc.text(X_MARK, typeX2 + 0.8, y - 0.5);
  }
  doc.setFont('helvetica', 'normal');
  doc.text(fr ? 'Non budgété' : 'Non-budgeted', typeX2 + 5, y);

  // Autre checkbox
  doc.rect(motifX, y - 3, cbSize, cbSize);
  if (evaluation.recruitmentReason === 'other') {
    doc.setFont('helvetica', 'bold');
    doc.text(X_MARK, motifX + 0.8, y - 0.5);
  }
  doc.setFont('helvetica', 'normal');
  doc.text(fr ? 'Autre' : 'Other', motifX + 5, y);

  y = infoStartY + infoH + 6;

  // ── SCORING TABLE ──
  if (jobRole) {
    const colCriteria = margin;
    const catLabelW = 8;
    const criteriaTextX = margin + catLabelW;
    const criteriaTextW = contentWidth - catLabelW - 48;
    const scoreColW = 12;
    const scoreStartX = margin + contentWidth - 48;
    const headerH = 10;

    // Score labels
    const scoreHeaders = fr
      ? ['INSUFFISANT', 'PASSABLE', 'BIEN', 'TRÈS BIEN']
      : ['INSUFFICIENT', 'PASSABLE', 'GOOD', 'VERY GOOD'];

    // Table header row
    doc.setFillColor(...GREEN);
    doc.rect(colCriteria, y, contentWidth, headerH, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(8);
    doc.setFont('helvetica', 'bold');
    doc.text(fr ? 'CRITÈRES' : 'CRITERIA', criteriaTextX + 2, y + 6);

    for (let i = 0; i < 4; i++) {
      const cx = scoreStartX + i * scoreColW + scoreColW / 2;
      doc.setFontSize(5.5);
      doc.text(scoreHeaders[i], cx, y + 4, { align: 'center' });
      doc.setFontSize(9);
      doc.text(String(i + 1), cx, y + 8.5, { align: 'center' });
    }
    y += headerH;

    let totalPoints = 0;
    let maxPoints = 0;
    const allCriteria: { catName: string; criteria: typeof jobRole.categories[0]['criteria'] }[] = [];

    jobRole.categories.forEach(cat => {
      allCriteria.push({ catName: cat.name, criteria: cat.criteria });
    });

    // Draw each category
    allCriteria.forEach(({ catName, criteria }) => {
      const catStartY = y;
      const rowH = 8;
      const catH = criteria.length * rowH;

      // Category vertical label background
      doc.setFillColor(...GREEN);
      doc.rect(colCriteria, y, catLabelW, catH, 'F');

      // Draw criteria rows
      criteria.forEach((crit, idx) => {
        const rowY = y + idx * rowH;
        const score = evaluation.scores.find(s => s.criterionId === crit.id)?.score || 0;
        totalPoints += score;
        maxPoints += jobRole.scaleMax;

        // Alternating row background
        if (idx % 2 === 0) {
          doc.setFillColor(250, 250, 250);
        } else {
          doc.setFillColor(255, 255, 255);
        }
        doc.rect(criteriaTextX, rowY, contentWidth - catLabelW, rowH, 'F');

        // Criteria text
        doc.setTextColor(...BLACK);
        doc.setFontSize(7.5);
        doc.setFont('helvetica', 'normal');

        // Use French name from description if in French mode
        const critText = fr ? crit.name : crit.name;
        const descText = crit.description ? ` (${crit.description})` : '';
        const fullText = critText + descText;
        doc.text(fullText, criteriaTextX + 2, rowY + 5.5, { maxWidth: criteriaTextW - 4 });

        // Score checkboxes
        for (let v = 1; v <= 4; v++) {
          const cx = scoreStartX + (v - 1) * scoreColW + scoreColW / 2;
          if (score === v) {
            doc.setFillColor(...GREEN);
            doc.rect(cx - 2.5, rowY + 2, 5, 4, 'F');
            doc.setTextColor(...WHITE);
            doc.setFontSize(8);
            doc.setFont('helvetica', 'bold');
            doc.text(String(v), cx, rowY + 5.2, { align: 'center' });
          } else {
            doc.setDrawColor(200, 200, 200);
            doc.setLineWidth(0.3);
            doc.rect(cx - 2.5, rowY + 2, 5, 4);
          }
        }

        // Row border
        doc.setDrawColor(220, 220, 220);
        doc.setLineWidth(0.2);
        doc.line(criteriaTextX, rowY + rowH, margin + contentWidth, rowY + rowH);
      });

      // Category vertical label text (rotated)
      doc.setTextColor(...WHITE);
      doc.setFontSize(6.5);
      doc.setFont('helvetica', 'bold');
      const catCenterY = catStartY + catH / 2;
      doc.text(catName.toUpperCase(), colCriteria + catLabelW / 2, catCenterY, {
        align: 'center',
        angle: 90,
      });

      // Category border
      doc.setDrawColor(...BORDER_GREEN);
      doc.setLineWidth(0.3);
      doc.rect(colCriteria, catStartY, contentWidth, catH);

      y += catH;

      // Page break check
      if (y > 260) {
        doc.addPage();
        y = 15;
      }
    });

    // TOTAL DES POINTS row
    const totalRowH = 8;
    doc.setFillColor(...GREEN);
    doc.rect(colCriteria, y, contentWidth / 2 + 10, totalRowH, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(9);
    doc.setFont('helvetica', 'bold');
    doc.text(fr ? 'TOTAL DES POINTS' : 'TOTAL POINTS', colCriteria + contentWidth / 2 - 5, y + 5.5, { align: 'center' });

    // Total value
    doc.setFillColor(245, 245, 245);
    doc.rect(colCriteria + contentWidth / 2 + 10, y, contentWidth / 2 - 10, totalRowH, 'F');
    doc.setTextColor(...BLACK);
    doc.setFontSize(10);
    doc.text(`${totalPoints} / ${maxPoints}`, colCriteria + contentWidth * 3 / 4 + 5, y + 5.5, { align: 'center' });
    doc.setDrawColor(...BORDER_GREEN);
    doc.rect(colCriteria, y, contentWidth, totalRowH);
    y += totalRowH;

    // NOTE GLOBALE row
    const pct = maxPoints > 0 ? ((totalPoints / maxPoints) * 100).toFixed(1) : '0';
    doc.setFillColor(...GREEN);
    doc.rect(colCriteria, y, contentWidth / 2 + 10, totalRowH, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(9);
    doc.text(fr ? 'NOTE GLOBALE' : 'OVERALL SCORE', colCriteria + contentWidth / 2 - 5, y + 5.5, { align: 'center' });

    doc.setFillColor(245, 245, 245);
    doc.rect(colCriteria + contentWidth / 2 + 10, y, contentWidth / 2 - 10, totalRowH, 'F');
    doc.setTextColor(...BLACK);
    doc.setFontSize(10);
    doc.text(`${pct}%`, colCriteria + contentWidth * 3 / 4 + 5, y + 5.5, { align: 'center' });
    doc.setDrawColor(...BORDER_GREEN);
    doc.rect(colCriteria, y, contentWidth, totalRowH);
    y += totalRowH + 8;
  }

  // ── COMMENTAIRE GÉNÉRAL ──
  if (y > 240) { doc.addPage(); y = 15; }

  // Section header
  doc.setFillColor(...GREEN);
  doc.rect(margin, y, contentWidth, 7, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(
    fr ? 'COMMENTAIRE GÉNÉRAL DU RECRUTEUR' : 'GENERAL RECRUITER COMMENT',
    margin + 3, y + 5
  );
  y += 7;

  // Comment box
  const commentBoxH = 35;
  doc.setDrawColor(...BORDER_GREEN);
  doc.setLineWidth(0.5);
  doc.rect(margin, y, contentWidth, commentBoxH);
  doc.setTextColor(...BLACK);
  doc.setFontSize(9);
  doc.setFont('helvetica', 'normal');
  const commentLines = doc.splitTextToSize(evaluation.comments || '', contentWidth - 10);
  doc.text(commentLines, margin + 5, y + 7);
  y += commentBoxH + 8;

  // ── DÉCISION FINALE ──
  if (y > 260) { doc.addPage(); y = 15; }

  doc.setFillColor(...GREEN);
  doc.rect(margin, y, contentWidth, 7, 'F');
  doc.setTextColor(...WHITE);
  doc.setFontSize(8);
  doc.setFont('helvetica', 'bold');
  doc.text(
    fr ? 'DÉCISION FINALE DU RECRUTEUR' : 'FINAL RECRUITER DECISION',
    margin + 3, y + 5
  );
  y += 7;

  // Decision box
  const decisionBoxH = 12;
  doc.setDrawColor(...BORDER_GREEN);
  doc.rect(margin, y, contentWidth, decisionBoxH);

  const leftDecX = margin + contentWidth / 4;
  const rightDecX = margin + contentWidth * 3 / 4;

  // FAVORABLE checkbox
  const dcbSize = 5;
  doc.setDrawColor(...BLACK);
  doc.setLineWidth(0.4);
  doc.rect(leftDecX - 15, y + 3.5, dcbSize, dcbSize);
  if (evaluation.decision === 'favorable') {
    doc.setFillColor(...GREEN);
    doc.rect(leftDecX - 15, y + 3.5, dcbSize, dcbSize, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(8);
    doc.text(X_MARK, leftDecX - 13.5, y + 7);
  }
  doc.setTextColor(...BLACK);
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text(fr ? 'FAVORABLE' : 'FAVORABLE', leftDecX - 8, y + 7.5);

  // NON FAVORABLE checkbox
  doc.rect(rightDecX - 15, y + 3.5, dcbSize, dcbSize);
  if (evaluation.decision === 'unfavorable') {
    doc.setFillColor(220, 53, 69);
    doc.rect(rightDecX - 15, y + 3.5, dcbSize, dcbSize, 'F');
    doc.setTextColor(...WHITE);
    doc.setFontSize(8);
    doc.text(X_MARK, rightDecX - 13.5, y + 7);
  }
  doc.setTextColor(...BLACK);
  doc.setFontSize(10);
  doc.text(fr ? 'NON FAVORABLE' : 'NOT FAVORABLE', rightDecX - 8, y + 7.5);

  // ── SIGNATURE in footer of last page ──
  const totalPages = doc.getNumberOfPages();
  doc.setPage(totalPages);
  const footerY = 270;
  if (signatureUrl) {
    try {
      const img = new Image();
      img.crossOrigin = 'anonymous';
      await new Promise<void>((resolve, reject) => {
        img.onload = () => resolve();
        img.onerror = reject;
        img.src = signatureUrl;
      });
      const canvas = document.createElement('canvas');
      canvas.width = img.width;
      canvas.height = img.height;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0);
      const dataUrl = canvas.toDataURL('image/png');
      doc.addImage(dataUrl, 'PNG', pageWidth - margin - 50, footerY - 15, 45, 15);
    } catch {
      // Signature load failed, skip
    }
  }
  doc.setTextColor(...GRAY);
  doc.setFontSize(7);
  doc.setFont('helvetica', 'italic');
  doc.text(evaluation.interviewerName || '', pageWidth - margin, footerY + 2, { align: 'right' });

  // Save
  doc.save(`evaluation-${evaluation.candidateName.replace(/\s+/g, '-')}-${evaluation.date}.pdf`);
}
