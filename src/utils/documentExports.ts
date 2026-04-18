/**
 * Template-faithful exporters for HR documents.
 * - Fiche d'Embauche → .xlsx (matches the original Excel template)
 * - Fiche de Poste → .docx
 * - Plan d'Intégration → .docx
 *
 * Each export auto-fills the signed-in user's name and embeds their signature image.
 */

import {
  Document, Packer, Paragraph, TextRun, Table, TableRow, TableCell, ImageRun,
  AlignmentType, BorderStyle, WidthType, ShadingType, HeadingLevel, PageOrientation,
} from 'docx';
import { saveAs } from 'file-saver';
import * as XLSX from 'xlsx';
import ExcelJS from 'exceljs';
import type { FicheEmbaucheData } from '@/types/ficheEmbauche';
import { calculateSalary } from '@/types/ficheEmbauche';
import type { FichePosteData } from '@/types/fichePoste';
import type { PlanIntegrationData } from '@/types/planIntegration';

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

function p(text: string, opts: { bold?: boolean; italic?: boolean; size?: number; align?: any; color?: string } = {}) {
  return new Paragraph({
    alignment: opts.align,
    children: [new TextRun({ text, bold: opts.bold, italics: opts.italic, size: opts.size, color: opts.color, font: 'Calibri' })],
  });
}

function cell(text: string | Paragraph[], opts: { bold?: boolean; shade?: string; width?: number; align?: any; colSpan?: number } = {}) {
  const children = Array.isArray(text)
    ? text
    : [new Paragraph({
        alignment: opts.align,
        children: [new TextRun({ text, bold: opts.bold, font: 'Calibri', size: 20 })],
      })];
  return new TableCell({
    children,
    columnSpan: opts.colSpan,
    width: opts.width ? { size: opts.width, type: WidthType.DXA } : undefined,
    shading: opts.shade ? { fill: opts.shade, type: ShadingType.CLEAR, color: 'auto' } : undefined,
    margins: { top: 80, bottom: 80, left: 120, right: 120 },
  });
}

async function buildSignatureBlock(signer: SignerInfo): Promise<Paragraph[]> {
  const blocks: Paragraph[] = [];
  blocks.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
  blocks.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [new TextRun({ text: 'Date et Visa', bold: true, font: 'Calibri', size: 20 })],
  }));

  const sigBytes = await fetchSignatureBytes(signer.signatureUrl);
  if (sigBytes) {
    blocks.push(new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new ImageRun({
        type: signatureImageType(signer.signatureUrl),
        data: sigBytes,
        transformation: { width: 140, height: 60 },
        altText: { title: 'Signature', description: 'User signature', name: 'signature' },
      })],
    }));
  }

  if (signer.fullName) {
    blocks.push(new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: signer.fullName, bold: true, font: 'Calibri', size: 20 })],
    }));
  }
  if (signer.title) {
    blocks.push(new Paragraph({
      alignment: AlignmentType.RIGHT,
      children: [new TextRun({ text: signer.title, italics: true, font: 'Calibri', size: 18 })],
    }));
  }
  blocks.push(new Paragraph({
    alignment: AlignmentType.RIGHT,
    children: [new TextRun({ text: new Date().toLocaleDateString('fr-FR'), font: 'Calibri', size: 18 })],
  }));
  return blocks;
}

// ─────────────────────── Fiche de Poste (DOCX) ───────────────────────

export async function exportFichePosteDocx(data: FichePosteData, signer: SignerInfo) {
  const HEADER_FILL = 'D9E2F3';
  const fullW = 9000;

  const infoTable = new Table({
    width: { size: fullW, type: WidthType.DXA },
    columnWidths: [2200, 2300, 2200, 2300],
    rows: [
      new TableRow({ children: [cell('1. Informations générales', { bold: true, shade: HEADER_FILL, colSpan: 4, italic: true } as any)] }),
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

  const signature = await buildSignatureBlock(signer);

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
        ...signature,
      ],
    }],
  });

  const blob = await Packer.toBlob(doc);
  saveAs(blob, `Fiche_de_poste_${(data.poste || 'document').replace(/\s+/g, '_')}.docx`);
}

// ─────────────────────── Plan d'Intégration (DOCX) ───────────────────────

export async function exportPlanIntegrationDocx(data: PlanIntegrationData, signer: SignerInfo) {
  const HEADER_FILL = 'D9E2F3';
  // Landscape for the wide planning table — pass portrait dims, set orientation
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
      cell(e.visaRecrue || '', { width: colWidths[5] }),
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

  const sigBytes = await fetchSignatureBytes(signer.signatureUrl);
  const sigParas: Paragraph[] = [];
  if (sigBytes) {
    sigParas.push(new Paragraph({
      alignment: AlignmentType.LEFT,
      children: [new ImageRun({
        type: signatureImageType(signer.signatureUrl),
        data: sigBytes,
        transformation: { width: 130, height: 55 },
        altText: { title: 'Signature', description: 'Signature', name: 'sig' },
      })],
    }));
  }
  if (signer.fullName) {
    sigParas.push(new Paragraph({ children: [new TextRun({ text: signer.fullName, bold: true, font: 'Calibri', size: 20 })] }));
  }
  if (signer.title) {
    sigParas.push(new Paragraph({ children: [new TextRun({ text: signer.title, italics: true, font: 'Calibri', size: 18 })] }));
  }
  sigParas.push(new Paragraph({ children: [new TextRun({ text: new Date().toLocaleDateString('fr-FR'), font: 'Calibri', size: 18 })] }));

  const avisTable = new Table({
    width: { size: fullW, type: WidthType.DXA },
    columnWidths: [fullW],
    rows: [
      new TableRow({ children: [cell('AVIS DE LA HIERARCHIE', { bold: true, shade: HEADER_FILL, align: AlignmentType.CENTER })] }),
      new TableRow({ children: [cell([
        new Paragraph({ children: [new TextRun({ text: data.avisHierarchie || '', font: 'Calibri', size: 20 })] }),
        new Paragraph({ children: [new TextRun({ text: '' })] }),
        new Paragraph({ children: [new TextRun({ text: 'Date et Visa', bold: true, font: 'Calibri', size: 20 })] }),
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

// ─────────────────────── Fiche d'Embauche (XLSX with embedded signature) ───────────────────────

export async function exportFicheEmbaucheXlsx(data: FicheEmbaucheData, signer: SignerInfo) {
  const salary = calculateSalary(data);
  const fmt = (n: number) => Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
  const dateStr = data.date ? new Date(data.date).toLocaleDateString('fr-FR') : '';
  const entreeStr = data.entreeEnvisagee ? new Date(data.entreeEnvisagee).toLocaleDateString('fr-FR') : '';
  const today = new Date().toLocaleDateString('fr-FR');
  const interviewers = data.interviewPanel || [];
  const selectedSite = data.sites.find(s => s.selected);

  const wb = new ExcelJS.Workbook();
  wb.creator = signer.fullName || 'CIMAR HR';
  wb.created = new Date();

  const ws = wb.addWorksheet("Fiche d'Embauche");
  ws.columns = [
    { width: 30 }, { width: 22 }, { width: 28 }, { width: 14 },
    { width: 28 }, { width: 14 }, { width: 24 }, { width: 12 }, { width: 26 },
  ];

  const HEADER_FILL = 'FFD9E2F3';
  const SECTION_FILL = 'FFB4C7E7';
  const thinBorder: Partial<ExcelJS.Borders> = {
    top: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    left: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    bottom: { style: 'thin', color: { argb: 'FFCCCCCC' } },
    right: { style: 'thin', color: { argb: 'FFCCCCCC' } },
  };

  const addRow = (values: any[]) => ws.addRow(values);
  const sectionRow = (label: string) => {
    const r = ws.addRow([label]);
    ws.mergeCells(r.number, 1, r.number, 9);
    r.getCell(1).font = { bold: true, size: 12, color: { argb: 'FFFFFFFF' } };
    r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: SECTION_FILL } };
    r.getCell(1).alignment = { horizontal: 'left', vertical: 'middle' };
    r.height = 22;
  };
  const headerRow = (label: string, span = 2) => {
    const r = ws.addRow([label]);
    if (span > 1) ws.mergeCells(r.number, 1, r.number, span);
    r.getCell(1).font = { bold: true, color: { argb: 'FF1F3864' } };
    r.getCell(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  };

  // Title
  const titleRow = ws.addRow(['', '', '', "FICHE DE VALIDATION D'EMBAUCHE"]);
  ws.mergeCells(titleRow.number, 1, titleRow.number, 9);
  titleRow.getCell(1).value = "FICHE DE VALIDATION D'EMBAUCHE";
  titleRow.getCell(1).font = { bold: true, size: 16, color: { argb: 'FF1F3864' } };
  titleRow.getCell(1).alignment = { horizontal: 'center', vertical: 'middle' };
  titleRow.height = 30;

  ws.addRow([`Date: ${dateStr}`]);
  ws.addRow([]);

  // Validation
  const validationHeader = ws.addRow(['Direction Demandeuse', '', 'Direction RH', '', '', 'Direction Générale']);
  [1, 3, 6].forEach(c => {
    validationHeader.getCell(c).font = { bold: true };
    validationHeader.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  });
  ws.addRow([data.directionDemandeuseName || '', '', data.directionRHName || '', '', '', data.directionGeneraleName || '']);
  ws.addRow([]);

  // Fonction
  sectionRow('Fonction');
  addRow(['Titre de poste:', '', data.titrePoste || '']);
  addRow(['Direction/Département:', '', data.directionDepartement || '']);
  addRow(['Rattachement Hiérarchique:', '', data.rattachementHierarchique || '']);
  addRow(['Motif de recrutement:', '', data.motifRecrutement || '']);
  ws.addRow([]);

  // Candidate
  addRow(['Nom & Prénom du candidat retenu:', '', data.nomPrenom || '']);
  ws.addRow([]);

  // Interview panel
  sectionRow('REÇU EN ENTRETIEN PAR :');
  interviewers.forEach(p => addRow(['', p.name || '', '', p.avis || '']));
  ws.addRow([]);

  // Entrée en fonction
  sectionRow('Entrée en fonction');
  addRow(['', 'Durée de préavis:', '', data.dureePreavis || '']);
  addRow(['', 'Entrée envisagée le:', '', entreeStr]);
  addRow(['', 'Statut:', '', data.statut || '']);
  addRow(['', 'Type de contrat:', '', data.typeContrat || '']);
  addRow(['', "Durée de période d'essai:", '', data.dureePeriodeEssai || '']);
  addRow(['', 'Voiture liée au poste:', '', data.voitureLieePoste ? 'Oui' : 'Non']);
  ws.addRow([]);

  // IK
  sectionRow('Indemnités Kilométriques');
  addRow(['', 'Cadre :', 91, 'Dh/jour fixe']);
  data.sites.forEach(s => addRow(['', `${s.name} :`, s.distance, s.unit, s.selected ? 'X' : '']));
  addRow(['', 'Nombre de jours travaillés', data.nombreJoursTravailles, 'jours', fmt(salary.ikTotal), 'Dhs']);
  addRow(['', 'Site sélectionné', selectedSite?.name || '-']);
  ws.addRow([]);

  // Situation vs Offre
  const cmpHeader = ws.addRow(['Situation Actuelle', '', '', '', 'Offre Ciments du Maroc']);
  [1, 5].forEach(c => {
    cmpHeader.getCell(c).font = { bold: true };
    cmpHeader.getCell(c).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
  });
  addRow(['Salaire de base:', fmt(data.salaireBaseActuel), '', '', 'Salaire de base', fmt(data.salaireBase), 'Dhs brut sur 13,3 mois']);
  addRow(['Prime de chantier', fmt(data.primeChantierActuel), '', '', 'Prime de logement', fmt(data.primeLogement), 'Dhs brut sur 12 mois']);
  addRow(['Indemnité de panier', fmt(data.indPanierActuel), '', '', 'Prime de site', fmt(data.primeSite), 'Dhs brut sur 12 mois']);
  addRow(['Indemnité de transport', fmt(data.indTransportActuel), '', '', 'Indemnité de transport', fmt(data.indTransport), 'Dhs net sur 12 mois']);
  addRow(['Salaire Net:', fmt(data.salaireNetActuel), '', '', 'Prime de représentation', fmt(data.primeRepresentation), 'Dhs brut sur 12 mois']);
  ws.addRow([]);

  // Récapitulatif
  sectionRow('Récapitulatif (Calculé)');
  addRow(['Salaire annuel brut', fmt(salary.salaireAnnuelBrut), 'Dhs']);
  addRow(['MBO', fmt(data.mbo), 'Dhs']);
  addRow(['Salaire net mensuel', fmt(salary.netAPayer), 'Dhs']);
  addRow(['Net mensuel + IK', fmt(salary.netMensuelPlusIK), 'Dhs']);
  addRow(['IK total', fmt(salary.ikTotal), 'Dhs']);
  ws.addRow([]);

  // Détail
  sectionRow('Détail du calcul');
  addRow(['Nombre de personnes à charge', data.nbPersonnesCharge]);
  addRow(['Salaire brut de base', fmt(data.salaireBase)]);
  addRow(['Taux Ancienneté', `${data.tauxAnciennete}%`]);
  addRow(['Taux CIMR', `${data.tauxCIMR}%`]);
  addRow(['Indemnité imposable', fmt(data.indemniteImposable)]);
  addRow(['RMA', fmt(data.rma)]);
  addRow(['Brut imposable', fmt(salary.brutImposable)]);
  addRow(['Indemnité Transport', fmt(data.indTransport)]);
  addRow(['Revenu brut global', fmt(salary.revenuBrutGlobal)]);
  addRow(['Intérêts prêt immobilier', fmt(data.interetsPretImmobilier)]);
  addRow(['Montant du revenu brut imposable', fmt(salary.montantRevenuBrutImposable)]);
  ws.addRow([]);
  addRow(['Frais professionnels', fmt(salary.fraisPro)]);
  addRow(['CNSS', fmt(salary.cnss)]);
  addRow(['CIMR', fmt(salary.cimr)]);
  addRow(['Mutuelle', fmt(salary.mutuelle)]);
  addRow(['Salaire Brut Imposable', fmt(salary.salaireBrutImposable)]);
  addRow(['IGR Brut', fmt(salary.igrBrut)]);
  addRow(['Charges familiales', fmt(salary.chargesFamiliales)]);
  addRow(['IGR Net', fmt(salary.igrNet)]);
  addRow(['Net à payer', fmt(salary.netAPayer)]);
  ws.addRow([]);

  // Comparatif Interne
  sectionRow('Comparatif Interne');
  const compHead = ws.addRow(['Nom et prénom', 'Intitulé du poste', "Site d'affectation", 'Salaire Brut', 'Prime de logement', 'Prime de site', 'Prime de représentation', 'Ancienneté CIMAR', 'Expérience avant CIMAR']);
  compHead.eachCell(c => {
    c.font = { bold: true };
    c.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: HEADER_FILL } };
    c.alignment = { wrapText: true, horizontal: 'center', vertical: 'middle' };
    c.border = thinBorder;
  });
  data.comparatifInterne.forEach(c => addRow([c.nom, c.poste, c.site, fmt(c.salaireBrut), fmt(c.primeLogement), fmt(c.primeSite), fmt(c.primeRepresentation), c.ancienneteCimar, c.experienceAvant]));
  ws.addRow([]);

  // Avantages
  sectionRow('Avantages');
  addRow(['CIMR', `${data.tauxCIMR}%`]);
  addRow(['Mutuelle maladie WafaAssurances', `${data.mutuellePercent}%`]);
  addRow(["Prime de l'aïd", data.primeAid, 'Dhs bruts']);
  addRow(['Avance aïd', data.avanceAid, 'Dhs nets sur 10 mois']);
  addRow(['Avance sociale', data.avanceSociale, 'Dhs nets sur 12 mois']);
  addRow(['Bonus (MBO)', fmt(data.mbo), 'Dhs bruts pour 100%']);
  ws.addRow([]);

  // Signature
  sectionRow('Validation & Signature');
  addRow(['Préparé par :', signer.fullName || '']);
  addRow(['Fonction :', signer.title || '']);
  addRow(['Date :', today]);
  const sigLabelRow = ws.addRow(['Signature :']);

  // Embed signature image if available
  if (signer.signatureUrl) {
    try {
      const res = await fetch(signer.signatureUrl);
      if (res.ok) {
        const buf = await res.arrayBuffer();
        const ext = /\.jpe?g(\?|$)/i.test(signer.signatureUrl) ? 'jpeg' : 'png';
        const imageId = wb.addImage({ buffer: buf as any, extension: ext });
        const startRow = sigLabelRow.number; // 0-indexed: startRow - 1
        // Anchor image to columns 2..5, ~3 rows tall
        ws.addImage(imageId, {
          tl: { col: 1, row: startRow - 1 } as any,
          ext: { width: 200, height: 80 },
        } as any);
        // Reserve a few empty rows so the image has space
        for (let i = 0; i < 4; i++) ws.addRow([]);
      }
    } catch (e) {
      console.warn('Signature embed failed:', e);
    }
  }

  // Add IGR detail sheet
  const ws2 = wb.addWorksheet('Détail IGR');
  ws2.columns = [{ width: 28 }, { width: 14 }, { width: 18 }];
  ws2.addRow(['Barème IGR 2010']).getCell(1).font = { bold: true, size: 13 };
  ws2.addRow(['Tranche', 'Taux', 'Somme à déduire']).eachCell(c => { c.font = { bold: true }; });
  ws2.addRows([
    ['[0-3333]', '0%', 0],
    ['[3334-5000]', '10%', 333.33],
    ['[5001-6667]', '20%', 833.33],
    ['[6668-8333]', '30%', 1500],
    ['[8334-15000]', '34%', 1833.33],
    ['15001 et plus', '37%', 2283.33],
  ]);
  ws2.addRow([]);
  ws2.addRow(['Taux appliqués']).getCell(1).font = { bold: true, size: 13 };
  ws2.addRow(['Rubrique', 'Taux', 'Plafond']).eachCell(c => { c.font = { bold: true }; });
  ws2.addRows([
    ['Frais professionnels', '25%', 2916.67],
    ['CNSS', '4.48%', 6000],
    ['CIMR', `${data.tauxCIMR}%`, 2000000],
    ['Retraite Complémentaire', '0%', 'N/A'],
    ['Mutuelle', '3.41%', 'N/A'],
    ['Charges familiales', 41.66, 3],
  ]);

  const buf = await wb.xlsx.writeBuffer();
  const blob = new Blob([buf], { type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet' });
  saveAs(blob, `Fiche_embauche_${(data.nomPrenom || data.titrePoste || 'document').replace(/\s+/g, '_')}.xlsx`);
}

