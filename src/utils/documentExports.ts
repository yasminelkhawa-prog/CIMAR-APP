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

// ─────────────────────── Fiche d'Embauche (XLSX) ───────────────────────

export async function exportFicheEmbaucheXlsx(data: FicheEmbaucheData, signer: SignerInfo) {
  const wb = XLSX.utils.book_new();
  const salary = calculateSalary(data);

  const fmt = (n: number) => Number.isFinite(n) ? Number(n.toFixed(2)) : 0;
  const dateStr = data.date ? new Date(data.date).toLocaleDateString('fr-FR') : '';
  const entreeStr = data.entreeEnvisagee ? new Date(data.entreeEnvisagee).toLocaleDateString('fr-FR') : '';
  const today = new Date().toLocaleDateString('fr-FR');
  const interviewers = data.interviewPanel || [];
  const selectedSite = data.sites.find(s => s.selected);

  // Build the AoA matrix matching the original template structure
  const aoa: any[][] = [];

  // Header rows
  aoa.push(['', '', '', "FICHE DE VALIDATION D'EMBAUCHE"]);
  aoa.push([dateStr]);
  aoa.push([]);
  aoa.push(['Direction Demandeuse', '', 'Direction RH', '', '', 'Direction Générale']);
  aoa.push([data.directionDemandeuseName || '', '', data.directionRHName || '', '', '', data.directionGeneraleName || '']);
  aoa.push([]);

  // Fonction
  aoa.push(['Fonction']);
  aoa.push(['Titre de poste:', '', data.titrePoste || '']);
  aoa.push(['Direction/ Département:', '', data.directionDepartement || '']);
  aoa.push(['Rattachement Hiérarchique:', '', data.rattachementHierarchique || '']);
  aoa.push(['Motif de recrutement:', '', data.motifRecrutement || '']);
  aoa.push([]);

  // Candidate
  aoa.push(['Nom & Prénom du candidat retenu:', '', data.nomPrenom || '']);
  aoa.push([]);

  // Interview panel
  aoa.push(['REÇU EN ENTRETIEN PAR :']);
  interviewers.forEach(p => {
    aoa.push(['', p.name || '', '', p.avis || '']);
  });
  aoa.push([]);

  // Entrée en fonction
  aoa.push(['Entrée en fonction:']);
  aoa.push(['', 'Durée de préavis:', '', data.dureePreavis || '']);
  aoa.push(['', 'Entrée envisagée le:', '', entreeStr]);
  aoa.push(['', 'Statut:', '', data.statut || '']);
  aoa.push(['', 'Type de contrat:', '', data.typeContrat || '']);
  aoa.push(['', "Durée de période d'essai:", '', data.dureePeriodeEssai || '']);
  aoa.push(['', 'Voiture liée au poste:', '', data.voitureLieePoste ? 'Oui' : 'Non']);
  aoa.push([]);

  // Indemnités kilométriques
  aoa.push(['Indemnités Kilométriques']);
  aoa.push(['', 'Cadre :', '91', 'Dh/jour fixe']);
  data.sites.forEach(s => {
    aoa.push(['', `${s.name} :`, s.distance, s.unit, s.selected ? 'X' : '']);
  });
  aoa.push(['', 'Nombre de jours travaillés', data.nombreJoursTravailles, 'jours', fmt(salary.ikTotal), 'Dhs']);
  aoa.push(['', 'Site sélectionné', selectedSite?.name || '-']);
  aoa.push([]);

  // Situation actuelle vs Offre
  aoa.push(['Situation Actuelle', '', '', '', 'Offre Ciments du Maroc']);
  aoa.push(['Salaire de base:', fmt(data.salaireBaseActuel), '', '', 'Salaire de base', fmt(data.salaireBase), 'Dhs brut sur 13,3 mois']);
  aoa.push(['Prime de chantier', fmt(data.primeChantierActuel), '', '', 'Prime de logement', fmt(data.primeLogement), 'Dhs brut sur 12 mois']);
  aoa.push(['Indemnité de panier', fmt(data.indPanierActuel), '', '', 'Prime de site', fmt(data.primeSite), 'Dhs brut sur 12 mois']);
  aoa.push(['Indemnité de transport', fmt(data.indTransportActuel), '', '', 'Indemnité de transport', fmt(data.indTransport), 'Dhs net sur 12 mois']);
  aoa.push(['Salaire Net:', fmt(data.salaireNetActuel), '', '', 'Prime de représentation', fmt(data.primeRepresentation), 'Dhs brut sur 12 mois']);
  aoa.push([]);

  // Récapitulatif salaire calculé
  aoa.push(['Récapitulatif (Calculé)']);
  aoa.push(['Salaire annuel brut', fmt(salary.salaireAnnuelBrut), 'Dhs']);
  aoa.push(['MBO', fmt(data.mbo), 'Dhs']);
  aoa.push(['Salaire net mensuel', fmt(salary.netAPayer), 'Dhs']);
  aoa.push(['Net mensuel + IK', fmt(salary.netMensuelPlusIK), 'Dhs']);
  aoa.push(['IK total', fmt(salary.ikTotal), 'Dhs']);
  aoa.push([]);

  // Détail du calcul
  aoa.push(['Détail du calcul']);
  aoa.push(['Nombre de personnes à charge', data.nbPersonnesCharge]);
  aoa.push(['Salaire brut de base', fmt(data.salaireBase)]);
  aoa.push(['Taux Ancienneté', `${data.tauxAnciennete}%`]);
  aoa.push(['Taux CIMR', `${data.tauxCIMR}%`]);
  aoa.push(['Indemnité imposable', fmt(data.indemniteImposable)]);
  aoa.push(['RMA', fmt(data.rma)]);
  aoa.push(['Brut imposable', fmt(salary.brutImposable)]);
  aoa.push(['Indemnité Transport', fmt(data.indTransport)]);
  aoa.push(['Revenu brut global', fmt(salary.revenuBrutGlobal)]);
  aoa.push(['Intérêts prêt immobilier', fmt(data.interetsPretImmobilier)]);
  aoa.push(['Montant du revenu brut imposable', fmt(salary.montantRevenuBrutImposable)]);
  aoa.push([]);
  aoa.push(['Frais professionnels', fmt(salary.fraisPro)]);
  aoa.push(['CNSS', fmt(salary.cnss)]);
  aoa.push(['CIMR', fmt(salary.cimr)]);
  aoa.push(['Mutuelle', fmt(salary.mutuelle)]);
  aoa.push(['Salaire Brut Imposable', fmt(salary.salaireBrutImposable)]);
  aoa.push(['IGR Brut', fmt(salary.igrBrut)]);
  aoa.push(['Charges familiales', fmt(salary.chargesFamiliales)]);
  aoa.push(['IGR Net', fmt(salary.igrNet)]);
  aoa.push(['Net à payer', fmt(salary.netAPayer)]);
  aoa.push([]);

  // Comparatif interne
  aoa.push(['Comparatif Interne']);
  aoa.push(['Nom et prénom', 'Intitulé du poste', "Site d'affectation", 'Salaire Brut', 'Prime de logement', 'Prime de site', 'Prime de représentation', 'Ancienneté CIMAR', 'Expérience avant CIMAR']);
  data.comparatifInterne.forEach(c => {
    aoa.push([c.nom, c.poste, c.site, fmt(c.salaireBrut), fmt(c.primeLogement), fmt(c.primeSite), fmt(c.primeRepresentation), c.ancienneteCimar, c.experienceAvant]);
  });
  aoa.push([]);

  // Avantages
  aoa.push(['Avantages']);
  aoa.push(['CIMR', `${data.tauxCIMR}%`]);
  aoa.push(['Mutuelle maladie WafaAssurances', `${data.mutuellePercent}%`]);
  aoa.push(["Prime de l'aïd", data.primeAid, 'Dhs bruts']);
  aoa.push(['Avance aïd', data.avanceAid, 'Dhs nets sur 10 mois']);
  aoa.push(['Avance sociale', data.avanceSociale, 'Dhs nets sur 12 mois']);
  aoa.push(['Bonus (MBO)', fmt(data.mbo), 'Dhs bruts pour 100%']);
  aoa.push([]);

  // Signature block (placeholder rows; the signature image is added below as anchored image is tricky in XLSX, so we add a labeled cell)
  aoa.push(['Validation']);
  aoa.push(['Préparé par :', signer.fullName || '']);
  aoa.push(['Fonction :', signer.title || '']);
  aoa.push(['Date :', today]);
  aoa.push(['Signature :', signer.signatureUrl ? '(voir image insérée)' : '']);

  const ws = XLSX.utils.aoa_to_sheet(aoa);

  // Column widths to match original layout
  ws['!cols'] = [
    { wch: 30 }, { wch: 22 }, { wch: 28 }, { wch: 14 },
    { wch: 28 }, { wch: 14 }, { wch: 24 }, { wch: 12 }, { wch: 26 },
  ];

  // Bold header style on title row
  const setBold = (addr: string) => {
    if (ws[addr]) {
      ws[addr].s = { font: { bold: true, sz: 14 }, alignment: { horizontal: 'center' } };
    }
  };
  setBold('D1');

  XLSX.utils.book_append_sheet(wb, ws, "Fiche d'Embauche");

  // Détail page (Barème IGR + paramètres)
  const aoa2: any[][] = [
    ['Barème IGR 2010'],
    ['Tranche', 'Taux', 'Somme à déduire'],
    ['[0-3333]', '0%', 0],
    ['[3334-5000]', '10%', 333.33],
    ['[5001-6667]', '20%', 833.33],
    ['[6668-8333]', '30%', 1500],
    ['[8334-15000]', '34%', 1833.33],
    ['15001 et plus', '37%', 2283.33],
    [],
    ['Taux appliqués'],
    ['Rubrique', 'Taux', 'Plafond'],
    ['Frais professionnels', '25%', 2916.67],
    ['CNSS', '4.48%', 6000],
    ['CIMR', `${data.tauxCIMR}%`, 2000000],
    ['Retraite Complémentaire', '0%', 'N/A'],
    ['Mutuelle', '3.41%', 'N/A'],
    ['Charges familiales', 41.66, 3],
  ];
  const ws2 = XLSX.utils.aoa_to_sheet(aoa2);
  ws2['!cols'] = [{ wch: 28 }, { wch: 14 }, { wch: 18 }];
  XLSX.utils.book_append_sheet(wb, ws2, 'Détail');

  XLSX.writeFile(wb, `Fiche_embauche_${(data.nomPrenom || data.titrePoste || 'document').replace(/\s+/g, '_')}.xlsx`);
}
