export interface CategorizedItem {
  category: string;
  details: string;
}

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
  rolesResponsabilites: CategorizedItem[];
  competences: CategorizedItem[];
  profil: CategorizedItem[];
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
  rolesResponsabilites: [],
  competences: [
    { category: 'Compétences Techniques (Hard Skills)', details: '' },
    { category: 'Compétences Comportementales (Soft Skills)', details: '' },
  ],
  profil: [
    { category: 'Formation académique', details: '' },
    { category: 'Expérience professionnelle', details: '' },
    { category: 'Langues', details: '' },
  ],
};
