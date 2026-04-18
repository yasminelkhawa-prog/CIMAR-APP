export type ActivityType = 'planning' | 'formation';

export interface IntegrationEntry {
  id: string;
  activityType: ActivityType;
  date: string;
  horaire: string;
  direction: string;
  responsable: string;
  objectifs: string;
  visaResponsable: string;
  visaRecrue: string;
}

export interface PlanIntegrationData {
  nomPrenom: string;
  dateEmbauche: string;
  posteOccuper: string;
  type: 'nouvelle_recrue' | 'reaffectation';
  entries: IntegrationEntry[];
  formations: string;
  avisHierarchie: string;
  appreciation: string;
}

export const DEFAULT_PLAN_INTEGRATION: PlanIntegrationData = {
  nomPrenom: '',
  dateEmbauche: new Date().toISOString().split('T')[0],
  posteOccuper: '',
  type: 'nouvelle_recrue',
  entries: [{
    id: crypto.randomUUID(),
    activityType: 'planning',
    date: '',
    horaire: '',
    direction: '',
    responsable: '',
    objectifs: '',
    visaResponsable: '',
    visaRecrue: '',
  }],
  formations: '',
  avisHierarchie: '',
  appreciation: '',
};

