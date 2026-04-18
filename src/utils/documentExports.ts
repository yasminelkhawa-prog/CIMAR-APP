/**
 * Template-faithful exporters for HR documents.
 * - Fiche d'Embauche → loads the authored XLSX template, patches {placeholders}, embeds signature
 * - Fiche de Poste → DOCX (code-generated, exact CIMAR layout)
 * - Plan d'Intégration → DOCX (code-generated, exact CIMAR layout)
 *
 * All exports auto-fill the signed-in user's name, title, and embed their signature image.
 * The candidate/employee `nomPrenom` is propagated to every "Nom" field across all docs.
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  AlignmentType, BorderStyle, WidthType, ShadingType, PageOrientation,
  Header, Footer, PageNumber, TabStopType, TabStopPosition,
} from 'docx';
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import type { FicheEmbaucheData } from '@/types/ficheEmbauche';
import { calculateSalary } from '@/types/ficheEmbauche';
import type { FichePosteData } from '@/types/fichePoste';
import type { PlanIntegrationData } from '@/types/planIntegration';
import templateUrl from '@/assets/templates/fiche_embauche_template.xlsx?url';
import logoUrl from '@/assets/logo-cimar.png';

interface SignerInfo {
  fullName?: string;
  title?: string;
  signatureUrl?: string | null;
}

/** Additional countersignatures fetched from accepted signature_requests. */
export interface ExtraSignature {
  fullName: string;
  title?: string;
  signatureUrl: string;
  signedAt?: string | null;
}

// ─────────────────────────── Helpers ───────────────────────────

async function fetchSignatureBytes(url?: string | null): Promise<Uint8Array | null> {
  if (!url) return null;
  try {
    const res = await fetch(url);
    if (!res.ok) return null;
    const buf = await res.arrayBuffer();
    return new Uint8Array(buf);
  } catch {
    return null;
  }
}

function signatureImageType(url?: string | null): 'png' | 'jpg' {
  if (!url) return 'png';
  return /\.jpe?g(\?|$)/i.test(url) ? 'jpg' : 'png';
}

function cell(text: string | Paragraph[], opts: { bold?: boolean; shade?: string; width?: number; align?: any; colSpan?: number; italic?: boolean; color?: string } = {}) {
  const children = Array.isArray(text)
    ? text
    : [new Paragraph({
        alignment: opts.align,
        children: [new TextRun({ text, bold: opts.bold, italics: opts.italic, color: opts.color, font: 'Calibri', size: 20 })],
      })];
  return new TableCell({
    children,
    columnSpan: opts.colSpan,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.shade ? { fill: opts.shade, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  });
}

async function buildSignatureParagraphs(signer: SignerInfo, alignment: any = AlignmentType.RIGHT): Promise<Paragraph[]> {
  const paras: Paragraph[] = [];
  paras.push(new Paragraph({
    alignment,
    children: [new TextRun({ text: 'Date et Visa', bold: true, font: 'Calibri', size: 20 })],
  }));

  const sigBytes = await fetchSignatureBytes(signer.signatureUrl);
  if (sigBytes) {
    paras.push(new Paragraph({
      alignment,
      children: [new ImageRun({
        type: signatureImageType(signer.signatureUrl),
        data: sigBytes,
        transformation: { width: 140, height: 60 },
        altText: { title: 'Signature', description: 'User signature', name: 'signature' },
      })],
    }));
  }

  if (signer.fullName) {
    paras.push(new Paragraph({
      alignment,
      children: [new TextRun({ text: signer.fullName, bold: true, font: 'Calibri', size: 20 })],
    }));
  }
  if (signer.title) {
    paras.push(new Paragraph({
      alignment,
      children: [new TextRun({ text: signer.title, italics: true, font: 'Calibri', size: 18 })],
    }));
  }
  paras.push(new Paragraph({
    alignment,
    children: [new TextRun({ text: new Date().toLocaleDateString('fr-FR'), font: 'Calibri', size: 18 })],
  }));
  return paras;
}

async function buildExtraSignaturesTable(extras: ExtraSignature[], fullW: number, headerFill: string, titleColor: string): Promise<Table | null> {
  if (!extras || extras.length === 0) return null;
  const cellsForSig = await Promise.all(extras.map(async (s) => {
    const sigBytes = await fetchSignatureBytes(s.signatureUrl);
    const children: Paragraph[] = [];
    if (sigBytes) {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new ImageRun({
          type: signatureImageType(s.signatureUrl),
          data: sigBytes,
          transformation: { width: 130, height: 55 },
          altText: { title: 'Signature', description: 'Co-signer signature', name: 'co-signature' },
        })],
      }));
    }
    children.push(new Paragraph({
      alignment: AlignmentType.CENTER,
      children: [new TextRun({ text: s.fullName, bold: true, font: 'Calibri', size: 20 })],
    }));
    if (s.title) {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: s.title, italics: true, font: 'Calibri', size: 18 })],
      }));
    }
    if (s.signedAt) {
      children.push(new Paragraph({
        alignment: AlignmentType.CENTER,
        children: [new TextRun({ text: `Signé le ${new Date(s.signedAt).toLocaleDateString('fr-FR')}`, font: 'Calibri', size: 16, color: '666666' })],
      }));
    }
    return cell(children, { width: Math.floor(fullW / extras.length) });
  }));

  return new Table({
    width: { size: fullW, type: WidthType.DXA },
    columnWidths: extras.map(() => Math.floor(fullW / extras.length)),
    rows: [
      new TableRow({ children: [cell('Visas et signatures', { bold: true, shade: headerFill, colSpan: extras.length, italic: true, color: titleColor, align: AlignmentType.CENTER })] }),
      new TableRow({ children: cellsForSig }),
    ],
  });
}

// ─────────────────────── Fiche de Poste (DOCX) ───────────────────────

export async function exportFichePosteDocx(data: FichePosteData, signer: SignerInfo, extraSignatures: ExtraSignature[] = []) {
  const HEADER_FILL = 'B9DCCB';
  const TITLE_COLOR = '044C2A';
  const fullW = 9000;

  const infoTable = new Table({
    width: { size: fullW, type: WidthType.DXA },
    columnWidths: [2200, 2300, 2200, 2300],
    rows: [
      new TableRow({ children: [cell('1. Informations générales', { bold: true, shade: HEADER_FILL, colSpan: 4, italic: true, color: TITLE_COLOR })] }),
      new TableRow({ children: [
        cell('Poste :'),
        cell(data.poste || '-', { bold: true }),
        cell('Date :'),
        cell(data.date ? new Date(data.date).toLocaleDateString('fr-FR') : '-', { bold: true }),
      ]}),
      new TableRow({ children: [
        cell('Rattachement hiérarchique :'),
        cell(data.rattachementHierarchique || '-', { bold: true }),
        cell('Rattachement fonctionnel :'),
        cell(data.rattachementFonctionnel || '-', { bold: true }),
      ]}),
      new TableRow({ children: [
        cell('Supervise :'),
        cell(data.supervise || '-', { bold: true }),
        cell('Nombre de subordonnées :'),
        cell(data.nombreSubordonnees || '-', { bold: true }),
      ]}),
      new TableRow({ children: [
        cell('Périmètre :'),
        cell(data.perimetre || '-', { bold: true }),
        cell('Niveau Hiérarchique :'),
        cell(data.niveauHierarchique || '-', { bold: true }),
      ]}),
    ],
  });

  const categorizedTable = (
    title: string,
    catHeader: string,
    detailsHeader: string,
    items: { category: string; details: string }[],
  ) => {
    const filtered = items.filter(i => (i.category || '').trim() || (i.details || '').trim());
    return new Table({
      width: { size: fullW, type: WidthType.DXA },
      columnWidths: [3000, 6000],
      rows: [
        new TableRow({ children: [cell(title, { bold: true, shade: HEADER_FILL, colSpan: 2, italic: true, color: TITLE_COLOR })] }),
        new TableRow({
          tableHeader: true,
          children: [
            cell(catHeader, { bold: true, shade: HEADER_FILL, align: AlignmentType.CENTER, color: TITLE_COLOR }),
            cell(detailsHeader, { bold: true, shade: HEADER_FILL, align: AlignmentType.CENTER, color: TITLE_COLOR }),
          ],
        }),
        ...(filtered.length > 0
          ? filtered.map(it => new TableRow({
              children: [
                cell(it.category || '-', { bold: true }),
                cell(
                  it.details
                    ? it.details.split(/\r?\n/).filter(l => l.trim()).map(line => new Paragraph({
                        bullet: { level: 0 },
                        children: [new TextRun({ text: line.replace(/^[-•]\s*/, ''), font: 'Calibri', size: 20 })],
                      }))
                    : '-'
                ),
              ],
            }))
          : [new TableRow({ children: [cell('-', { colSpan: 2 })] })]),
      ],
    });
  };

  const missionTable = new Table({
    width: { size: fullW, type: WidthType.DXA },
    columnWidths: [fullW],
    rows: [
      new TableRow({ children: [cell('2. Mission', { bold: true, shade: HEADER_FILL, color: TITLE_COLOR })] }),
      new TableRow({ children: [cell(data.mission || '-')] }),
    ],
  });

  const signaturePara = await buildSignatureParagraphs(signer, AlignmentType.RIGHT);
  const extrasTable = await buildExtraSignaturesTable(extraSignatures, fullW, HEADER_FILL, TITLE_COLOR);

  // CIMAR logo header
  const logoBuf = await fetch(logoUrl).then(r => r.arrayBuffer());
  const logoPara = new Paragraph({
    alignment: AlignmentType.LEFT,
    spacing: { after: 200 },
    children: [new ImageRun({
      type: 'png',
      data: logoBuf,
      transformation: { width: 160, height: 50 },
      altText: { title: 'CIMAR', description: 'Ciments du Maroc', name: 'logo-cimar' },
    })],
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } },
      children: [
        logoPara,
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Description de Poste', bold: true, size: 36, font: 'Calibri', color: TITLE_COLOR })] }),
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        infoTable,
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        missionTable,
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        categorizedTable('3. Rôles et responsabilités', 'Catégorie', 'Responsabilités détaillées', data.rolesResponsabilites),
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        categorizedTable('4. Compétences', 'Type de compétence', 'Détails', data.competences),
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        categorizedTable('5. Profil du poste', 'Critère', 'Exigence', data.profil),
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        ...signaturePara,
        ...(extrasTable ? [new Paragraph({ children: [new TextRun({ text: '' })] }), extrasTable] : []),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Fiche_de_poste_${(data.poste || 'document').replace(/\s+/g, '_')}.docx`);
}

// ─────────────────────── Plan d'Intégration (DOCX) ───────────────────────

export async function exportPlanIntegrationDocx(data: PlanIntegrationData, signer: SignerInfo, extraSignatures: ExtraSignature[] = []) {
  const HEADER_FILL = 'B5D8E5';   // Light teal/blue (matches template)
  // Landscape A4: long edge = 16838, with 720 DXA margins (0.5in) → content = 15398
  const fullW = 15398;
  const colWidths = [1900, 3300, 2700, 3700, 1900, 1898]; // sums to 15398

  // Cell border helper (light gray border for inner table cells)
  const thinBorder = { style: BorderStyle.SINGLE, size: 4, color: '000000' };
  const allBorders = { top: thinBorder, bottom: thinBorder, left: thinBorder, right: thinBorder };

  // Override the default cell helper inline to ensure visible borders on planning tables
  const tCell = (text: string | Paragraph[], opts: Parameters<typeof cell>[1] = {}) => {
    const c = cell(text, opts);
    // mutate borders post-creation: docx TableCell exposes options through internal root, simpler to recreate
    return new TableCell({
      children: Array.isArray(text)
        ? text
        : [new Paragraph({
            alignment: opts.align,
            children: [new TextRun({ text, bold: opts.bold, italics: opts.italic, color: opts.color, font: 'Calibri', size: 20 })],
          })],
      columnSpan: opts.colSpan,
      width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
      shading: opts.shade ? { fill: opts.shade, type: ShadingType.CLEAR, color: 'auto' } : undefined,
      margins: { top: 80, bottom: 80, left: 120, right: 120 },
      borders: allBorders,
    });
  };

  // --- Identity / type checkbox table (matches template top-right block) ---
  const idColWidths = [2400, 700, 2400, 700];
  const idTable = new Table({
    width: { size: 6200, type: WidthType.DXA },
    columnWidths: idColWidths,
    rows: [
      new TableRow({
        children: [
          tCell('Nouvelle recrue :', { bold: true, width: idColWidths[0] }),
          tCell(data.type === 'nouvelle_recrue' ? 'X' : '', { bold: true, align: AlignmentType.CENTER, width: idColWidths[1] }),
          tCell('Réaffectation :', { bold: true, width: idColWidths[2] }),
          tCell(data.type === 'reaffectation' ? 'X' : '', { bold: true, align: AlignmentType.CENTER, width: idColWidths[3] }),
        ],
      }),
    ],
  });

  // --- Planning header row ---
  const buildHeaderRow = () => new TableRow({
    tableHeader: true,
    children: [
      tCell('Date', { bold: true, shade: HEADER_FILL, width: colWidths[0], align: AlignmentType.CENTER }),
      tCell('Direction /Département /Service', { bold: true, shade: HEADER_FILL, width: colWidths[1], align: AlignmentType.CENTER }),
      tCell('Responsable', { bold: true, shade: HEADER_FILL, width: colWidths[2], align: AlignmentType.CENTER }),
      tCell('Objectifs', { bold: true, shade: HEADER_FILL, width: colWidths[3], align: AlignmentType.CENTER }),
      tCell('Visa Responsable du service', { bold: true, shade: HEADER_FILL, width: colWidths[4], align: AlignmentType.CENTER }),
      tCell([
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Visa', bold: true, font: 'Calibri', size: 20 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Nouvelle recrue', bold: true, font: 'Calibri', size: 20 })] }),
      ], { shade: HEADER_FILL, width: colWidths[5] }),
    ],
  });

  const buildEntryRow = (e: typeof data.entries[number]) => new TableRow({
    children: [
      tCell([
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: e.date ? new Date(e.date).toLocaleDateString('fr-FR') : '', bold: true, font: 'Calibri', size: 20 })] }),
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: e.horaire || '', bold: true, font: 'Calibri', size: 20 })] }),
      ], { width: colWidths[0] }),
      tCell(
        e.direction
          ? e.direction.split(/\r?\n/).filter(l => l.trim()).map(line => new Paragraph({
              children: [new TextRun({ text: line.trim(), bold: true, font: 'Calibri', size: 20 })],
            }))
          : [new Paragraph({ children: [new TextRun({ text: '' })] })],
        { width: colWidths[1] }
      ),
      tCell(e.responsable || '', { width: colWidths[2], bold: true, italic: true }),
      tCell(
        e.objectifs
          ? e.objectifs.split(/\r?\n/).filter(l => l.trim()).map(line => new Paragraph({
              bullet: { level: 0 },
              children: [new TextRun({ text: line.replace(/^[-•]\s*/, ''), bold: true, font: 'Calibri', size: 20 })],
            }))
          : [new Paragraph({ children: [new TextRun({ text: '' })] })],
        { width: colWidths[3] }
      ),
      tCell(e.visaResponsable || '', { width: colWidths[4] }),
      tCell(e.visaRecrue || '', { width: colWidths[5] }),
    ],
  });

  // Split entries by explicit activityType field. Backward-compat: legacy entries
  // without an activityType fall back to keyword detection.
  const formationKeywords = /(formation|workday|sécurit|securit|recrutement|développement rh|developpement rh)/i;
  const isFormation = (e: typeof data.entries[number]) => {
    if (e.activityType) return e.activityType === 'formation';
    return formationKeywords.test(`${e.direction} ${e.objectifs}`);
  };
  const planningEntries = data.entries.filter(e => !isFormation(e));
  const formationEntries = data.entries.filter(e => isFormation(e));

  const planningTable = new Table({
    width: { size: fullW, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [buildHeaderRow(), ...planningEntries.map(buildEntryRow)],
  });

  const formationsTable = new Table({
    width: { size: fullW, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [buildHeaderRow(), ...formationEntries.map(buildEntryRow)],
  });

  // --- AVIS / APPRECIATION boxes: large bordered box, label on top-left, "Date et Visa" bottom-right ---
  const buildBoxRow = (title: string, content: string) => {
    const lines = content
      ? content.split(/\r?\n/).map(l => new Paragraph({
          spacing: { line: 360 },
          border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: '999999', space: 1 } },
          children: [new TextRun({ text: l, font: 'Calibri', size: 22 })],
        }))
      : Array.from({ length: 4 }, () => new Paragraph({
          spacing: { line: 360 },
          border: { bottom: { style: BorderStyle.DOTTED, size: 4, color: '999999', space: 1 } },
          children: [new TextRun({ text: '' })],
        }));

    return new Table({
      width: { size: fullW, type: WidthType.DXA },
      columnWidths: [fullW],
      rows: [
        new TableRow({
          children: [
            new TableCell({
              borders: allBorders,
              width: { size: fullW, type: WidthType.DXA },
              margins: { top: 200, bottom: 200, left: 200, right: 200 },
              children: [
                new Paragraph({
                  spacing: { after: 240 },
                  children: [new TextRun({ text: title, bold: true, font: 'Calibri', size: 24 })],
                }),
                ...lines,
                new Paragraph({
                  spacing: { before: 240 },
                  alignment: AlignmentType.RIGHT,
                  children: [new TextRun({ text: 'Date et Visa', bold: true, font: 'Calibri', size: 22 })],
                }),
              ],
            }),
          ],
        }),
      ],
    });
  };

  const appreciationTable = buildBoxRow(
    "APPRECIATION DE LA NOUVELLE RECRUE APRES LA REALISATION DU PLAN D'INTEGRATION",
    data.appreciation || ''
  );
  const avisTable = buildBoxRow('AVIS DE LA HIERARCHIE', data.avisHierarchie || '');

  // --- CIMAR logo for header (top-right on every page) ---
  const logoBuf = await fetch(logoUrl).then(r => r.arrayBuffer());
  const headerLogo = new Header({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [new ImageRun({
          type: 'png',
          data: logoBuf,
          transformation: { width: 160, height: 50 },
          altText: { title: 'CIMAR', description: 'Ciments du Maroc', name: 'logo-cimar' },
        })],
      }),
    ],
  });

  const footer = new Footer({
    children: [
      new Paragraph({
        alignment: AlignmentType.RIGHT,
        children: [
          new TextRun({ text: 'Page ', font: 'Calibri', size: 20 }),
          new TextRun({ children: [PageNumber.CURRENT], font: 'Calibri', size: 20 }),
          new TextRun({ text: '/', font: 'Calibri', size: 20 }),
          new TextRun({ children: [PageNumber.TOTAL_PAGES], font: 'Calibri', size: 20 }),
        ],
      }),
    ],
  });

  // --- Title in bordered box (centered) ---
  const titleTable = new Table({
    alignment: AlignmentType.CENTER,
    width: { size: 5000, type: WidthType.DXA },
    columnWidths: [5000],
    rows: [
      new TableRow({
        children: [new TableCell({
          borders: allBorders,
          width: { size: 5000, type: WidthType.DXA },
          margins: { top: 100, bottom: 100, left: 200, right: 200 },
          children: [new Paragraph({
            alignment: AlignmentType.CENTER,
            children: [new TextRun({ text: "PLAN D'INTEGRATION", bold: true, font: 'Calibri', size: 36 })],
          })],
        })],
      }),
    ],
  });

  // --- Identity row: 3 fields side-by-side via tab stops ---
  const thirdW = Math.floor(fullW / 3);
  const identityPara = new Paragraph({
    spacing: { before: 240, after: 120 },
    tabStops: [
      { type: TabStopType.LEFT, position: thirdW },
      { type: TabStopType.LEFT, position: thirdW * 2 },
    ],
    children: [
      new TextRun({ text: 'Nom et prénom : ', bold: true, font: 'Calibri', size: 22 }),
      new TextRun({ text: data.nomPrenom || '', bold: true, font: 'Calibri', size: 22 }),
      new TextRun({ text: '\t', font: 'Calibri', size: 22 }),
      new TextRun({ text: "Date d'embauche : ", bold: true, font: 'Calibri', size: 22 }),
      new TextRun({ text: data.dateEmbauche ? new Date(data.dateEmbauche).toLocaleDateString('fr-FR') : '', bold: true, font: 'Calibri', size: 22 }),
      new TextRun({ text: '\t', font: 'Calibri', size: 22 }),
      new TextRun({ text: 'Poste à occuper : ', bold: true, font: 'Calibri', size: 22 }),
      new TextRun({ text: data.posteOccuper || '', bold: true, font: 'Calibri', size: 22 }),
    ],
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 1440, right: 720, bottom: 720, left: 720 },
        },
      },
      headers: { default: headerLogo },
      footers: { default: footer },
      children: [
        titleTable,
        identityPara,
        idTable,
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        planningTable,
        new Paragraph({
          spacing: { before: 360, after: 120 },
          children: [new TextRun({ text: 'Formations :', bold: true, size: 32, font: 'Calibri' })],
        }),
        formationsTable,
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        appreciationTable,
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        avisTable,
        ...(extraSignatures.length > 0
          ? [
              new Paragraph({ children: [new TextRun({ text: '' })] }),
              (await buildExtraSignaturesTable(extraSignatures, fullW, HEADER_FILL, '044C2A'))!,
            ]
          : []),
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Plan_integration_${(data.nomPrenom || 'document').replace(/\s+/g, '_')}.docx`);
}

// ─────────────────────── Fiche d'Embauche (template-fill XLSX) ───────────────────────

/**
 * Loads the authored Fiche d'Embauche template, walks every cell, replaces
 * {placeholder} tokens with form values, and embeds the user's signature image.
 * Preserves merged cells, formulas, fonts, column widths, and borders exactly.
 */
export async function exportFicheEmbaucheXlsx(data: FicheEmbaucheData, signer: SignerInfo, extraSignatures: ExtraSignature[] = []) {
  const salary = calculateSalary(data);
  const fmt = (n: number | undefined) => Number.isFinite(n) ? Number((n as number).toFixed(2)) : 0;
  const today = new Date().toLocaleDateString('fr-FR');
  const entreeStr = data.entreeEnvisagee ? new Date(data.entreeEnvisagee).toLocaleDateString('fr-FR') : '';
  const interviewers = data.interviewPanel || [];
  const selectedSiteName = data.sites.find(s => s.selected)?.name || '';

  // Build replacement map
  const tokens: Record<string, any> = {
    directionDemandeuseName: data.directionDemandeuseName || '',
    directionRHName: data.directionRHName || signer.fullName || '',
    directionGeneraleName: data.directionGeneraleName || '',
    titrePoste: data.titrePoste || '',
    directionDepartement: data.directionDepartement || '',
    rattachementHierarchique: data.rattachementHierarchique || '',
    motifRecrutement: data.motifRecrutement || '',
    nomPrenom: data.nomPrenom || '',
    interviewer1Name: interviewers[0]?.name || signer.fullName || '',
    interviewer1Avis: interviewers[0]?.avis || '',
    interviewer2Name: interviewers[1]?.name || '',
    interviewer2Avis: interviewers[1]?.avis || '',
    interviewer3Name: interviewers[2]?.name || '',
    interviewer3Avis: interviewers[2]?.avis || '',
    interviewer4Name: interviewers[3]?.name || '',
    interviewer4Avis: interviewers[3]?.avis || '',
    dureePreavis: data.dureePreavis || '',
    entreeEnvisagee: entreeStr,
    statut: data.statut || '',
    typeContrat: data.typeContrat || '',
    dureePeriodeEssai: data.dureePeriodeEssai || '',
    voitureLieePoste: data.voitureLieePoste ? 'Oui' : 'Non',
    ikCadreSelected: data.statut === 'Cadre' ? 1 : 0,
    ikChefSelected: 0,
    ikAitBahaSelected: selectedSiteName === 'Ait Baha' ? 1 : 0,
    ikMarrakechSelected: selectedSiteName === 'Marrakech' ? 1 : 0,
    ikSafiSelected: selectedSiteName === 'Safi' ? 1 : 0,
    ikLaayouneSelected: selectedSiteName === 'Laâyoune' ? 1 : 0,
    ikJorfSelected: selectedSiteName === 'Jorf Lasfar' ? 1 : 0,
    ikCasablancaSelected: selectedSiteName === 'Casablanca' ? 1 : 0,
    nombreJoursTravailles: data.nombreJoursTravailles || 22,
    salaireBaseActuel: fmt(data.salaireBaseActuel),
    primeChantierActuel: fmt(data.primeChantierActuel),
    indPanierActuel: fmt(data.indPanierActuel),
    indTransportActuel: fmt(data.indTransportActuel),
    salaireNetActuel: fmt(data.salaireNetActuel),
    salaireBase: fmt(data.salaireBase),
    primeLogement: fmt(data.primeLogement),
    primeSite: fmt(data.primeSite),
    indTransport: fmt(data.indTransport),
    primeRepresentation: fmt(data.primeRepresentation),
    tauxCIMR: data.tauxCIMR / 100,
    tauxCIMRDecimal: data.tauxCIMR / 100,
    mutuellePercent: (data.mutuellePercent || 85) / 100,
    primeAid: data.primeAid || 0,
    avanceAid: data.avanceAid || 0,
    avanceSociale: data.avanceSociale || 0,
    nbPersonnesCharge: data.nbPersonnesCharge || 0,
    tauxAnciennete: (data.tauxAnciennete || 0) / 100,
    rma: fmt(data.rma),
    interetsPretImmobilier: fmt(data.interetsPretImmobilier),
    signerFullName: signer.fullName || '',
    signerTitle: signer.title || '',
    signerDate: today,
    signaturePlaceholder: '',
  };

  // Load the authored template
  const res = await fetch(templateUrl);
  if (!res.ok) throw new Error('Failed to load Fiche d\'Embauche template');
  const arrayBuffer = await res.arrayBuffer();

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(arrayBuffer);
  wb.creator = signer.fullName || 'CIMAR HR';
  wb.modified = new Date();

  // Patch every cell that contains a {token}
  const tokenRegex = /\{(\w+)\}/g;
  let signatureAnchor: { ws: ExcelJS.Worksheet; row: number; col: number } | null = null;

  wb.worksheets.forEach((ws) => {
    ws.eachRow({ includeEmpty: false }, (row) => {
      row.eachCell({ includeEmpty: false }, (c) => {
        if (typeof c.value !== 'string') return;
        const text = c.value as string;
        if (!text.includes('{')) return;

        // Special: signature placeholder
        if (text.includes('{signaturePlaceholder}')) {
          c.value = '';
          signatureAnchor = { ws, row: Number(c.row), col: Number(c.col) + 1 };
          return;
        }

        // If the cell is exactly one token like "{tauxCIMR}" → use the raw value (preserves number type)
        const exact = text.match(/^\{(\w+)\}$/);
        if (exact) {
          const key = exact[1];
          if (key in tokens) {
            c.value = tokens[key] as any;
            return;
          }
        }

        // Otherwise interpolate as string
        c.value = text.replace(tokenRegex, (m, k) => {
          if (k in tokens) {
            const v = tokens[k];
            return v === null || v === undefined ? '' : String(v);
          }
          return m;
        });
      });
    });
  });

  // Embed signature image at the anchor
  if (signer.signatureUrl && signatureAnchor) {
    try {
      const sigRes = await fetch(signer.signatureUrl);
      if (sigRes.ok) {
        const buf = await sigRes.arrayBuffer();
        const ext = /\.jpe?g(\?|$)/i.test(signer.signatureUrl) ? 'jpeg' : 'png';
        const imageId = wb.addImage({ buffer: buf as any, extension: ext });
        const { ws, row, col } = signatureAnchor;
        ws.addImage(imageId, {
          tl: { col: col - 1, row: row - 1 } as any,
          ext: { width: 200, height: 80 },
        } as any);
      }
    } catch (e) {
      console.warn('Signature embed failed:', e);
    }
  }

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Fiche_embauche_${(data.nomPrenom || data.titrePoste || 'document').replace(/\s+/g, '_')}.xlsx`);
}
