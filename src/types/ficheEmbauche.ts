export interface InterviewPanel {
  name: string;
  avis: string;
}

export interface ComparatifInterne {
  nom: string;
  poste: string;
  site: string;
  salaireBrut: number;
  primeLogement: number;
  primeSite: number;
  primeRepresentation: number;
  ancienneteCimar: string;
  experienceAvant: string;
}

export interface SiteIK {
  name: string;
  distance: number;
  unit: string;
  selected: boolean;
}

export interface FicheEmbaucheData {
  // Header
  date: string;
  directionDemandeuse: string;
  directionDemandeuseName: string;
  directionRH: string;
  directionRHName: string;
  directionGenerale: string;
  directionGeneraleName: string;

  // Poste
  titrePoste: string;
  directionDepartement: string;
  rattachementHierarchique: string;
  motifRecrutement: string;

  // Candidat
  nomPrenom: string;

  // Entretien
  interviewPanel: InterviewPanel[];

  // Entrée en fonction
  dureePreavis: string;
  entreeEnvisagee: string;
  statut: string;
  typeContrat: string;
  dureePeriodeEssai: string;
  voitureLieePoste: boolean;

  // IK
  sites: SiteIK[];
  nombreJoursTravailles: number;

  // Situation actuelle
  salaireBaseActuel: number;
  primeChantierActuel: number;
  indPanierActuel: number;
  indTransportActuel: number;
  salaireNetActuel: number;

  // Offre
  salaireBase: number;
  primeLogement: number;
  primeSite: number;
  indTransport: number;
  primeRepresentation: number;

  // Calcul
  tauxCIMR: number; // 3, 3.75, 4.5, 5.25, 6
  nbPersonnesCharge: number;
  tauxAnciennete: number;
  indemniteImposable: number;
  rma: number;
  interetsPretImmobilier: number;

  // Avantages
  mutuellePercent: number;
  primeAid: number;
  avanceAid: number;
  avanceSociale: number;

  // Comparatif
  comparatifInterne: ComparatifInterne[];

  // MBO
  mbo: number;
}

export const DEFAULT_SITES: SiteIK[] = [
  { name: 'Ait Baha', distance: 130, unit: 'kms', selected: false },
  { name: 'Marrakech', distance: 110, unit: 'kms', selected: false },
  { name: 'Safi', distance: 70, unit: 'kms', selected: false },
  { name: 'Laâyoune', distance: 72, unit: 'kms', selected: false },
  { name: 'Jorf Lasfar', distance: 64, unit: 'kms', selected: false },
  { name: 'Casablanca', distance: 50, unit: 'kms', selected: false },
];

export const DEFAULT_FICHE_EMBAUCHE: FicheEmbaucheData = {
  date: new Date().toISOString().split('T')[0],
  directionDemandeuse: '',
  directionDemandeuseName: '',
  directionRH: 'Direction RH',
  directionRHName: 'Mme IKKEZ',
  directionGenerale: 'Direction Générale',
  directionGeneraleName: 'M. WEIG',
  titrePoste: '',
  directionDepartement: '',
  rattachementHierarchique: '',
  motifRecrutement: 'Remplacement',
  nomPrenom: '',
  interviewPanel: [{ name: '', avis: 'Avis favorable' }],
  dureePreavis: '',
  entreeEnvisagee: '',
  statut: 'Cadre',
  typeContrat: 'Contrat à durée indéterminée',
  dureePeriodeEssai: '3 mois',
  voitureLieePoste: false,
  sites: DEFAULT_SITES,
  nombreJoursTravailles: 22,
  salaireBaseActuel: 0,
  primeChantierActuel: 0,
  indPanierActuel: 0,
  indTransportActuel: 0,
  salaireNetActuel: 0,
  salaireBase: 0,
  primeLogement: 0,
  primeSite: 0,
  indTransport: 0,
  primeRepresentation: 0,
  tauxCIMR: 6,
  nbPersonnesCharge: 0,
  tauxAnciennete: 0,
  indemniteImposable: 0,
  rma: 0,
  interetsPretImmobilier: 0,
  mutuellePercent: 85,
  primeAid: 3000,
  avanceAid: 5000,
  avanceSociale: 60000,
  comparatifInterne: [],
  mbo: 0,
};

// IGR Barème 2010
export function calculateIGR(baseImposable: number): number {
  if (baseImposable <= 3333) return 0;
  if (baseImposable <= 5000) return baseImposable * 0.10 - 333.33;
  if (baseImposable <= 6667) return baseImposable * 0.20 - 833.33;
  if (baseImposable <= 8333) return baseImposable * 0.30 - 1500.00;
  if (baseImposable <= 15000) return baseImposable * 0.34 - 1833.33;
  return baseImposable * 0.37 - 2283.33;
}

export function calculateSalary(data: FicheEmbaucheData) {
  const salaireBrut = data.salaireBase;
  const brutImposable = salaireBrut + data.indemniteImposable + data.primeRepresentation + (salaireBrut * data.tauxAnciennete / 100) + data.rma;
  const revenuBrutGlobal = brutImposable + data.indTransport;
  const montantRevenuBrutImposable = revenuBrutGlobal - data.interetsPretImmobilier;

  const fraisPro = Math.min(montantRevenuBrutImposable * 0.25, 2916.67);
  const cnss = Math.min(salaireBrut * 0.0448, 268.80);
  const cimr = salaireBrut * (data.tauxCIMR / 100);
  const retraiteComplementaire = 0;
  const retraite55 = 0;
  const mutuelle = salaireBrut * 0.0341;

  const salaireBrutImposable = montantRevenuBrutImposable - fraisPro - cnss - cimr - retraiteComplementaire - retraite55 - mutuelle;
  const igrBrut = calculateIGR(salaireBrutImposable);
  const chargesFamiliales = data.nbPersonnesCharge * 41.66;
  const css = 0;
  const igrNet = Math.max(igrBrut - chargesFamiliales, 0);
  const netAPayer = montantRevenuBrutImposable - cnss - cimr - retraiteComplementaire - retraite55 - mutuelle - igrNet;

  // IK
  const ikCadre = 91;
  const selectedSite = data.sites.find(s => s.selected);
  const ikDistance = selectedSite ? selectedSite.distance : 0;
  const ikTotal = ikDistance > 0 ? ikCadre * data.nombreJoursTravailles : 0;

  // Salary summary
  const salaireAnnuelBrut = brutImposable * 12 + data.mbo;
  const netMensuelPlusIK = netAPayer + ikTotal;

  return {
    brutImposable,
    revenuBrutGlobal,
    montantRevenuBrutImposable,
    fraisPro,
    cnss,
    cimr,
    retraiteComplementaire,
    retraite55,
    mutuelle,
    salaireBrutImposable,
    igrBrut,
    chargesFamiliales,
    css,
    igrNet,
    netAPayer,
    ikTotal,
    ikCadre,
    ikDistance,
    salaireAnnuelBrut,
    netMensuelPlusIK,
  };
}
