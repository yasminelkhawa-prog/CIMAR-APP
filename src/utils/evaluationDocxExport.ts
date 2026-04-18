/**
 * Generates a single-page CIMAR interview evaluation grid as a .docx.
 * Built programmatically with docx-js — no external template required.
 * All scores, comments and decision are filled from the EvaluationForm.
 */
import {
  Document,
  Packer,
  Paragraph,
  TextRun,
  ImageRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  BorderStyle,
  HeightRule,
  PageOrientation,
  ShadingType,
  VerticalAlign,
  WidthType,
} from 'docx';
import { saveAs } from 'file-saver';
import logoUrl from '@/assets/logo-cimar.png';
import type { EvaluationForm, JobRoleConfig } from '@/types/evaluation';

// CIMAR brand colors
const GREEN = '1F6B3A';
const GREEN_LIGHT = 'D9E8DE';
const GREY = '595959';
const WHITE = 'FFFFFF';
const BORDER = '808080';

const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: BORDER };
const cellBorders = {
  top: thinBorder,
  bottom: thinBorder,
  left: thinBorder,
  right: thinBorder,
};

// A4 portrait: 11906 x 16838 DXA. With 0.4" margins (576 DXA)
const PAGE_W = 11906;
const PAGE_H = 16838;
const MARGIN = 576; // 0.4"
const CONTENT_W = PAGE_W - MARGIN * 2; // ≈ 10754

function txt(
  text: string,
  opts: { bold?: boolean; size?: number; color?: string; font?: string } = {},
) {
  return new TextRun({
    text,
    bold: opts.bold,
    size: opts.size ?? 16, // half-points → 8pt default
    color: opts.color ?? '000000',
    font: opts.font ?? 'Arial',
  });
}

function p(
  children: TextRun[] | string,
  opts: { align?: (typeof AlignmentType)[keyof typeof AlignmentType] } = {},
) {
  const runs = typeof children === 'string' ? [txt(children)] : children;
  return new Paragraph({
    children: runs,
    alignment: opts.align,
    spacing: { before: 20, after: 20 },
  });
}

function cell(opts: {
  children: Paragraph[];
  width: number;
  shade?: string;
  colSpan?: number;
  rowSpan?: number;
  vAlign?: 'top' | 'center' | 'bottom';
}) {
  return new TableCell({
    children: opts.children,
    width: { size: opts.width, type: WidthType.DXA },
    columnSpan: opts.colSpan,
    rowSpan: opts.rowSpan,
    shading: opts.shade
      ? { fill: opts.shade, type: ShadingType.CLEAR, color: 'auto' }
      : undefined,
    verticalAlign: opts.vAlign ?? VerticalAlign.CENTER,
    borders: cellBorders,
    margins: { top: 40, bottom: 40, left: 80, right: 80 },
  });
}

function checkbox(checked: boolean) {
  return checked ? '☒' : '☐';
}

async function fetchImageBuf(url: string): Promise<ArrayBuffer | null> {
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    return await res.arrayBuffer();
  } catch {
    return null;
  }
}

export async function exportEvaluationDocx(
  evaluation: EvaluationForm,
  role: JobRoleConfig | undefined,
  interviewerFallback?: string,
  signatureUrl?: string | null,
) {
  const dateStr = evaluation.date
    ? new Date(evaluation.date).toLocaleDateString('fr-FR')
    : '';
  const interviewerName = evaluation.interviewerName || interviewerFallback || '';
  const signatureBuf = signatureUrl ? await fetchImageBuf(signatureUrl) : null;

  // ===== Header info table (2 rows × 4 cols of label/value pairs) =====
  const headerColW = CONTENT_W / 8; // 8 sub-cols
  const labelShade = GREEN;
  const valueShade = WHITE;

  const headerRow = (
    pairs: Array<{ label: string; value: string }>,
  ) =>
    new TableRow({
      height: { value: 320, rule: HeightRule.ATLEAST },
      children: pairs.flatMap((pair) => [
        cell({
          width: headerColW,
          shade: labelShade,
          children: [
            p([txt(pair.label, { bold: true, color: WHITE, size: 14 })]),
          ],
        }),
        cell({
          width: headerColW,
          shade: valueShade,
          children: [p([txt(pair.value, { size: 14 })])],
        }),
      ]),
    });

  const headerTable = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: Array(8).fill(headerColW),
    rows: [
      headerRow([
        { label: 'Date', value: dateStr },
        { label: 'Lieu', value: evaluation.location || '' },
        { label: 'Nom & prénom du candidat', value: evaluation.candidateName || '' },
        {
          label: "Nom de l'intervieweur",
          value: evaluation.interviewerName || interviewerFallback || '',
        },
      ]),
      headerRow([
        {
          label: 'Statut',
          value: evaluation.candidateSource === 'internal' ? 'BC' : 'WC',
        },
        {
          label: 'Source de CV',
          value: evaluation.candidateSource === 'internal' ? 'Interne' : 'Externe',
        },
        {
          label: 'Motif de recrutement',
          value:
            evaluation.recruitmentReason === 'replacement'
              ? 'Remplacement'
              : evaluation.recruitmentReason === 'creation'
                ? 'Création de poste'
                : 'Autre',
        },
        {
          label: 'Type de recrutement',
          value:
            evaluation.recruitmentType === 'budgeted' ? 'Budgété' : 'Non budgété',
        },
      ]),
    ],
  });

  // ===== Scoring grid =====
  // Columns: Catégorie | Critère | 1 | 2 | 3 | 4 | Score
  const colCat = 1400;
  const colCrit = CONTENT_W - 1400 - 700 * 4 - 900;
  const colScale = 700;
  const colScore = 900;
  const gridCols = [colCat, colCrit, colScale, colScale, colScale, colScale, colScore];

  const headerScoreRow = new TableRow({
    tableHeader: true,
    height: { value: 360, rule: HeightRule.ATLEAST },
    children: [
      cell({
        width: colCat,
        shade: GREEN,
        children: [p([txt('CATÉGORIE', { bold: true, color: WHITE, size: 14 })], { align: AlignmentType.CENTER })],
      }),
      cell({
        width: colCrit,
        shade: GREEN,
        children: [p([txt('CRITÈRES', { bold: true, color: WHITE, size: 14 })], { align: AlignmentType.CENTER })],
      }),
      cell({
        width: colScale,
        shade: GREEN,
        children: [
          p([txt('INSUFFISANT', { bold: true, color: WHITE, size: 11 })], { align: AlignmentType.CENTER }),
          p([txt('1', { bold: true, color: WHITE, size: 14 })], { align: AlignmentType.CENTER }),
        ],
      }),
      cell({
        width: colScale,
        shade: GREEN,
        children: [
          p([txt('PASSABLE', { bold: true, color: WHITE, size: 11 })], { align: AlignmentType.CENTER }),
          p([txt('2', { bold: true, color: WHITE, size: 14 })], { align: AlignmentType.CENTER }),
        ],
      }),
      cell({
        width: colScale,
        shade: GREEN,
        children: [
          p([txt('BIEN', { bold: true, color: WHITE, size: 11 })], { align: AlignmentType.CENTER }),
          p([txt('3', { bold: true, color: WHITE, size: 14 })], { align: AlignmentType.CENTER }),
        ],
      }),
      cell({
        width: colScale,
        shade: GREEN,
        children: [
          p([txt('TRÈS BIEN', { bold: true, color: WHITE, size: 11 })], { align: AlignmentType.CENTER }),
          p([txt('4', { bold: true, color: WHITE, size: 14 })], { align: AlignmentType.CENTER }),
        ],
      }),
      cell({
        width: colScore,
        shade: GREEN,
        children: [p([txt('SCORE', { bold: true, color: WHITE, size: 14 })], { align: AlignmentType.CENTER })],
      }),
    ],
  });

  let totalScore = 0;
  let maxScore = 0;
  const gridRows: TableRow[] = [headerScoreRow];

  if (role) {
    role.categories.forEach((cat) => {
      cat.criteria.forEach((crit, idx) => {
        const score = evaluation.scores.find((s) => s.criterionId === crit.id)?.score || 0;
        const weighted = score * crit.weight;
        totalScore += weighted;
        maxScore += role.scaleMax * crit.weight;

        const row = new TableRow({
          height: { value: 320, rule: HeightRule.ATLEAST },
          children: [
            // Category cell — only on first criterion of each category (rowSpan)
            ...(idx === 0
              ? [
                  cell({
                    width: colCat,
                    shade: GREEN_LIGHT,
                    rowSpan: cat.criteria.length,
                    children: [
                      p([txt(cat.name.toUpperCase(), { bold: true, color: GREEN, size: 14 })], {
                        align: AlignmentType.CENTER,
                      }),
                    ],
                  }),
                ]
              : []),
            cell({
              width: colCrit,
              children: [
                p([
                  txt(crit.name, { bold: true, size: 13 }),
                  txt(crit.weight > 1 ? `  (×${crit.weight})` : '', { size: 11, color: GREY }),
                ]),
                p([txt(crit.description, { size: 11, color: GREY })]),
              ],
            }),
            ...[1, 2, 3, 4].map((n) =>
              cell({
                width: colScale,
                shade: score === n ? GREEN_LIGHT : undefined,
                children: [
                  p([txt(checkbox(score === n), { size: 18, bold: score === n })], {
                    align: AlignmentType.CENTER,
                  }),
                ],
              }),
            ),
            cell({
              width: colScore,
              children: [
                p([txt(score > 0 ? String(weighted) : '—', { bold: true, size: 14 })], {
                  align: AlignmentType.CENTER,
                }),
              ],
            }),
          ],
        });
        gridRows.push(row);
      });
    });
  }

  const pct = maxScore > 0 ? Math.round((totalScore / maxScore) * 100) : 0;

  // Total row
  gridRows.push(
    new TableRow({
      height: { value: 360, rule: HeightRule.ATLEAST },
      children: [
        cell({
          width: colCat + colCrit + colScale * 4,
          colSpan: 6,
          shade: GREEN,
          children: [
            p([txt('TOTAL DES POINTS  /  NOTE GLOBALE', { bold: true, color: WHITE, size: 14 })], {
              align: AlignmentType.RIGHT,
            }),
          ],
        }),
        cell({
          width: colScore,
          shade: GREEN_LIGHT,
          children: [
            p([txt(`${totalScore}/${maxScore}`, { bold: true, size: 14, color: GREEN })], {
              align: AlignmentType.CENTER,
            }),
            p([txt(`${pct}%`, { bold: true, size: 13, color: GREEN })], {
              align: AlignmentType.CENTER,
            }),
          ],
        }),
      ],
    }),
  );

  const gridTable = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: gridCols,
    rows: gridRows,
  });

  // ===== Comment + Decision row =====
  const commentTable = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [Math.round(CONTENT_W * 0.65), Math.round(CONTENT_W * 0.35)],
    rows: [
      new TableRow({
        children: [
          cell({
            width: Math.round(CONTENT_W * 0.65),
            shade: GREEN,
            children: [
              p([txt('COMMENTAIRE GÉNÉRAL DU RECRUTEUR', { bold: true, color: WHITE, size: 13 })], {
                align: AlignmentType.CENTER,
              }),
            ],
          }),
          cell({
            width: Math.round(CONTENT_W * 0.35),
            shade: GREEN,
            children: [
              p([txt('DÉCISION FINALE DU RECRUTEUR', { bold: true, color: WHITE, size: 13 })], {
                align: AlignmentType.CENTER,
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        height: { value: 1400, rule: HeightRule.ATLEAST },
        children: [
          cell({
            width: Math.round(CONTENT_W * 0.65),
            vAlign: VerticalAlign.TOP,
            children: [p([txt(evaluation.comments || '', { size: 13 })])],
          }),
          cell({
            width: Math.round(CONTENT_W * 0.35),
            vAlign: VerticalAlign.CENTER,
            children: [
              p(
                [
                  txt(`${checkbox(evaluation.decision === 'favorable')}  `, {
                    size: 20,
                    bold: true,
                    color: evaluation.decision === 'favorable' ? GREEN : '000000',
                  }),
                  txt('FAVORABLE', {
                    bold: true,
                    size: 14,
                    color: evaluation.decision === 'favorable' ? GREEN : '000000',
                  }),
                ],
                { align: AlignmentType.CENTER },
              ),
              p(
                [
                  txt(`${checkbox(evaluation.decision === 'unfavorable')}  `, {
                    size: 20,
                    bold: true,
                    color: evaluation.decision === 'unfavorable' ? 'B22222' : '000000',
                  }),
                  txt('NON FAVORABLE', {
                    bold: true,
                    size: 14,
                    color: evaluation.decision === 'unfavorable' ? 'B22222' : '000000',
                  }),
                ],
                { align: AlignmentType.CENTER },
              ),
            ],
          }),
        ],
      }),
    ],
  });

  // ===== Logo + Title header =====
  const logoBuf = await fetch(logoUrl).then((r) => r.arrayBuffer());

  const headerBlock = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [1800, CONTENT_W - 1800],
    rows: [
      new TableRow({
        children: [
          new TableCell({
            width: { size: 1800, type: WidthType.DXA },
            verticalAlign: 'center',
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.LEFT,
                children: [
                  new ImageRun({
                    type: 'png',
                    data: logoBuf,
                    transformation: { width: 90, height: 45 },
                    altText: { title: 'CIMAR', description: 'CIMAR logo', name: 'cimar' },
                  }),
                ],
              }),
            ],
          }),
          new TableCell({
            width: { size: CONTENT_W - 1800, type: WidthType.DXA },
            verticalAlign: 'center',
            borders: {
              top: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              bottom: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              left: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
              right: { style: BorderStyle.NONE, size: 0, color: 'FFFFFF' },
            },
            children: [
              new Paragraph({
                alignment: AlignmentType.CENTER,
                children: [
                  txt("GRILLE D'ÉVALUATION DE L'ENTRETIEN", {
                    bold: true,
                    size: 22,
                    color: GREEN,
                  }),
                ],
              }),
              new Paragraph({
                alignment: AlignmentType.CENTER,
                spacing: { before: 40 },
                children: [txt('CIMAR — Ciments du Maroc', { bold: true, size: 14, color: GREY })],
              }),
            ],
          }),
        ],
      }),
    ],
  });

  const spacer = new Paragraph({
    children: [txt('', { size: 4 })],
    spacing: { before: 0, after: 60 },
  });

  // ===== Signature block =====
  const sigInnerCells: Paragraph[] = [
    new Paragraph({
      alignment: AlignmentType.LEFT,
      spacing: { before: 40, after: 40 },
      children: [txt(`Date : ${dateStr}`, { size: 12, color: GREY })],
    }),
  ];

  if (signatureBuf) {
    sigInnerCells.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 40, after: 40 },
        children: [
          new ImageRun({
            type: 'png',
            data: signatureBuf,
            transformation: { width: 170, height: 60 },
            altText: { title: 'Signature', description: 'Signature', name: 'sig' },
          }),
        ],
      }),
    );
  } else {
    sigInnerCells.push(
      new Paragraph({
        alignment: AlignmentType.CENTER,
        spacing: { before: 200, after: 200 },
        children: [txt('', { size: 12 })],
      }),
    );
  }

  sigInnerCells.push(
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 40, after: 20 },
      children: [txt(interviewerName, { bold: true, size: 13 })],
    }),
  );

  const signatureTable = new Table({
    width: { size: CONTENT_W, type: WidthType.DXA },
    columnWidths: [CONTENT_W],
    rows: [
      new TableRow({
        children: [
          cell({
            width: CONTENT_W,
            shade: GREEN,
            children: [
              p([txt('SIGNATURE DU RECRUTEUR', { bold: true, color: WHITE, size: 13 })], {
                align: AlignmentType.CENTER,
              }),
            ],
          }),
        ],
      }),
      new TableRow({
        children: [
          cell({
            width: CONTENT_W,
            vAlign: 'center',
            children: sigInnerCells,
          }),
        ],
      }),
    ],
  });

  const doc = new Document({
    creator: 'CIMAR HR',
    title: "Grille d'évaluation",
    styles: {
      default: { document: { run: { font: 'Arial', size: 14 } } },
    },
    sections: [
      {
        properties: {
          page: {
            size: {
              width: PAGE_W,
              height: PAGE_H,
              orientation: PageOrientation.PORTRAIT,
            },
            margin: {
              top: MARGIN,
              right: MARGIN,
              bottom: MARGIN,
              left: MARGIN,
            },
          },
        },
        children: [headerBlock, spacer, headerTable, spacer, gridTable, spacer, commentTable, spacer, signatureTable],
      },
    ],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, "Grille_d_évaluation_de_l_entretien_-_CIMAR.docx");
}
