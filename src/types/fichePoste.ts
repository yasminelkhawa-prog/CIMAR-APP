export interface FichePosteData {
  poste: string;
  date: string;
  rattachementHierarchique: string;
  rattachementFonctionnel: string;
  supervise: string;
  nombreSubordonnees: string;
  perimetre: string;
  niveauHierarchique: string;
  mission: string;
  rolesResponsabilites: string[];
  competences: string[];
  profil: string[];
}

export const DEFAULT_FICHE_POSTE: FichePosteData = {
  poste: '',
  date: new Date().toISOString().split('T')[0],
  rattachementHierarchique: '',
  rattachementFonctionnel: '-',
  supervise: '-',
  nombreSubordonnees: '-',
  perimetre: '',
  niveauHierarchique: '',
  mission: '',
  rolesResponsabilites: [''],
  competences: [''],
  profil: [''],
};
