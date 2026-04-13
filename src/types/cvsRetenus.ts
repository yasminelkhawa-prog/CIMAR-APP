export interface CvRetenu {
  id: string;
  prenom: string;
  nom: string;
  posteActuel: string;
  entrepriseActuelle: string;
  dateDebutPoste: string;
  etablissementFormation: string;
  anneesExperience: string;
}

export interface CvsRetenusData {
  posteVise: string;
  candidates: CvRetenu[];
}

export const DEFAULT_CVS_RETENUS: CvsRetenusData = {
  posteVise: '',
  candidates: [{
    id: crypto.randomUUID(),
    prenom: '',
    nom: '',
    posteActuel: '',
    entrepriseActuelle: '',
    dateDebutPoste: '',
    etablissementFormation: '',
    anneesExperience: '',
  }],
};
