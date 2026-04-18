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
} from 'docx';
import { saveAs } from 'file-saver';
import ExcelJS from 'exceljs';
import type { FicheEmbaucheData } from '@/types/ficheEmbauche';
import { calculateSalary } from '@/types/ficheEmbauche';
import type { FichePosteData } from '@/types/fichePoste';
import type { PlanIntegrationData } from '@/types/planIntegration';
import templateUrl from '@/assets/templates/fiche_embauche_template.xlsx?url';

interface SignerInfo {
  fullName?: string;
  title?: string;
  signatureUrl?: string | null;
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

function cell(text: string | Paragraph[], opts: { bold?: boolean; shade?: string; width?: number; align?: any; colSpan?: number; italic?: boolean } = {}) {
  const children = Array.isArray(text)
    ? text
    : [new Paragraph({
        alignment: opts.align,
        children: [new TextRun({ text, bold: opts.bold, italics: opts.italic, font: 'Calibri', size: 20 })],
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

// ─────────────────────── Fiche de Poste (DOCX) ───────────────────────

export async function exportFichePosteDocx(data: FichePosteData, signer: SignerInfo) {
  const HEADER_FILL = 'D9E2F3';
  const fullW = 9000;

  const infoTable = new Table({
    width: { size: fullW, type: WidthType.DXA },
    columnWidths: [2200, 2300, 2200, 2300],
    rows: [
      new TableRow({ children: [cell('1. Informations générales', { bold: true, shade: HEADER_FILL, colSpan: 4, italic: true })] }),
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

  const sectionTable = (title: string, items: string[]) =>
    new Table({
      width: { size: fullW, type: WidthType.DXA },
      columnWidths: [fullW],
      rows: [
        new TableRow({ children: [cell(title, { bold: true, shade: HEADER_FILL })] }),
        new TableRow({ children: [cell(
          items.filter(Boolean).length > 0
            ? items.filter(Boolean).map(it => new Paragraph({
                bullet: { level: 0 },
                children: [new TextRun({ text: it, font: 'Calibri', size: 20 })],
              }))
            : '-'
        )] }),
      ],
    });

  const missionTable = new Table({
    width: { size: fullW, type: WidthType.DXA },
    columnWidths: [fullW],
    rows: [
      new TableRow({ children: [cell('2. Mission', { bold: true, shade: HEADER_FILL })] }),
      new TableRow({ children: [cell(data.mission || '-')] }),
    ],
  });

  const signaturePara = await buildSignatureParagraphs(signer, AlignmentType.RIGHT);

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{
      properties: { page: { size: { width: 11906, height: 16838 }, margin: { top: 1000, right: 1000, bottom: 1000, left: 1000 } } },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'Description de Poste', bold: true, size: 36, font: 'Calibri' })] }),
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        infoTable,
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        missionTable,
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        sectionTable('3. Rôles et responsabilités', data.rolesResponsabilites),
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        sectionTable('4. Compétences', data.competences),
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        sectionTable('5. Profil du poste', data.profil),
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        ...signaturePara,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Fiche_de_poste_${(data.poste || 'document').replace(/\s+/g, '_')}.docx`);
}

// ─────────────────────── Plan d'Intégration (DOCX) ───────────────────────

export async function exportPlanIntegrationDocx(data: PlanIntegrationData, signer: SignerInfo) {
  const HEADER_FILL = 'D9E2F3';
  const fullW = 14400;
  const colWidths = [1700, 3000, 2500, 3500, 1850, 1850];

  const planningHeader = new TableRow({
    children: [
      cell('Date', { bold: true, shade: HEADER_FILL, width: colWidths[0], align: AlignmentType.CENTER }),
      cell('Direction / Département / Service', { bold: true, shade: HEADER_FILL, width: colWidths[1], align: AlignmentType.CENTER }),
      cell('Responsable', { bold: true, shade: HEADER_FILL, width: colWidths[2], align: AlignmentType.CENTER }),
      cell('Objectifs', { bold: true, shade: HEADER_FILL, width: colWidths[3], align: AlignmentType.CENTER }),
      cell('Visa Responsable du service', { bold: true, shade: HEADER_FILL, width: colWidths[4], align: AlignmentType.CENTER }),
      cell('Visa Nouvelle recrue', { bold: true, shade: HEADER_FILL, width: colWidths[5], align: AlignmentType.CENTER }),
    ],
    tableHeader: true,
  });

  const planningRows = data.entries.map(e => new TableRow({
    children: [
      cell([
        new Paragraph({ children: [new TextRun({ text: e.date ? new Date(e.date).toLocaleDateString('fr-FR') : '', bold: true, font: 'Calibri', size: 20 })] }),
        new Paragraph({ children: [new TextRun({ text: e.horaire || '', bold: true, font: 'Calibri', size: 20 })] }),
      ], { width: colWidths[0] }),
      cell(e.direction || '', { width: colWidths[1] }),
      cell(e.responsable || '', { width: colWidths[2], bold: true }),
      cell(
        e.objectifs
          ? [new Paragraph({ bullet: { level: 0 }, children: [new TextRun({ text: e.objectifs, font: 'Calibri', size: 20 })] })]
          : '',
        { width: colWidths[3] }
      ),
      cell(e.visaResponsable || '', { width: colWidths[4] }),
      cell(e.visaRecrue || data.nomPrenom || '', { width: colWidths[5] }),
    ],
  }));

  const planningTable = new Table({
    width: { size: fullW, type: WidthType.DXA },
    columnWidths: colWidths,
    rows: [planningHeader, ...planningRows],
  });

  const formationsTable = new Table({
    width: { size: fullW, type: WidthType.DXA },
    columnWidths: [fullW],
    rows: [
      new TableRow({ children: [cell('Formations', { bold: true, shade: HEADER_FILL })] }),
      new TableRow({ children: [cell(data.formations || '-')] }),
    ],
  });

  const sigParas = await buildSignatureParagraphs(signer, AlignmentType.LEFT);

  const avisTable = new Table({
    width: { size: fullW, type: WidthType.DXA },
    columnWidths: [fullW],
    rows: [
      new TableRow({ children: [cell('AVIS DE LA HIERARCHIE', { bold: true, shade: HEADER_FILL, align: AlignmentType.CENTER })] }),
      new TableRow({ children: [cell([
        new Paragraph({ children: [new TextRun({ text: data.avisHierarchie || '', font: 'Calibri', size: 20 })] }),
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        ...sigParas,
      ])] }),
    ],
  });

  const appreciationTable = new Table({
    width: { size: fullW, type: WidthType.DXA },
    columnWidths: [fullW],
    rows: [
      new TableRow({ children: [cell('APPRÉCIATION DE LA NOUVELLE RECRUE APRÈS LA RÉALISATION DU PLAN D\'INTÉGRATION', { bold: true, shade: HEADER_FILL, align: AlignmentType.CENTER })] }),
      new TableRow({ children: [cell([
        new Paragraph({ children: [new TextRun({ text: data.appreciation || '', font: 'Calibri', size: 20 })] }),
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        new Paragraph({ children: [new TextRun({ text: `${data.nomPrenom || ''}`, bold: true, font: 'Calibri', size: 20 })] }),
        new Paragraph({ children: [new TextRun({ text: 'Date et Visa', bold: true, font: 'Calibri', size: 20 })] }),
      ])] }),
    ],
  });

  const doc = new Document({
    styles: { default: { document: { run: { font: 'Calibri', size: 22 } } } },
    sections: [{
      properties: {
        page: {
          size: { width: 11906, height: 16838, orientation: PageOrientation.LANDSCAPE },
          margin: { top: 800, right: 800, bottom: 800, left: 800 },
        },
      },
      children: [
        new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: "PLAN D'INTÉGRATION", bold: true, size: 36, font: 'Calibri' })] }),
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        new Paragraph({ children: [
          new TextRun({ text: 'Nom et prénom : ', bold: true, font: 'Calibri', size: 22 }),
          new TextRun({ text: data.nomPrenom || '', font: 'Calibri', size: 22 }),
        ]}),
        new Paragraph({ children: [
          new TextRun({ text: "Date d'embauche : ", bold: true, font: 'Calibri', size: 22 }),
          new TextRun({ text: data.dateEmbauche ? new Date(data.dateEmbauche).toLocaleDateString('fr-FR') : '', font: 'Calibri', size: 22 }),
        ]}),
        new Paragraph({ children: [
          new TextRun({ text: 'Poste à occuper : ', bold: true, font: 'Calibri', size: 22 }),
          new TextRun({ text: data.posteOccuper || '', font: 'Calibri', size: 22 }),
        ]}),
        new Paragraph({ children: [
          new TextRun({ text: `Nouvelle recrue : ${data.type === 'nouvelle_recrue' ? '☒' : '☐'}    Réaffectation : ${data.type === 'reaffectation' ? '☒' : '☐'}`, font: 'Calibri', size: 22 }),
        ]}),
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        planningTable,
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        formationsTable,
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        avisTable,
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        appreciationTable,
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
export async function exportFicheEmbaucheXlsx(data: FicheEmbaucheData, signer: SignerInfo) {
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
