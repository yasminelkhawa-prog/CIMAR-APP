export interface Criterion {
  id: string;
  name: string;
  description: string;
  weight: number; // 1-5, multiplier for score
}

export interface CriteriaCategory {
  id: string;
  name: string;
  criteria: Criterion[];
}

export interface JobRoleConfig {
  id: string;
  name: string;
  categories: CriteriaCategory[];
  scaleMax: number;
}

export interface Candidate {
  id: string;
  firstName: string;
  lastName: string;
  jobTitle: string;
  department: string;
  email: string;
  source: 'internal' | 'external';
  status: 'BC' | 'WC';
}

export interface CriterionScore {
  criterionId: string;
  score: number; // 0 = not scored, 1-4
}

export interface EvaluationForm {
  id: string;
  candidateName: string;
  candidateSource: 'internal' | 'external';
  jobRoleConfigId: string;
  interviewerName: string;
  date: string;
  location: string;
  recruitmentReason: 'replacement' | 'creation' | 'other';
  recruitmentType: 'budgeted' | 'non-budgeted';
  scores: CriterionScore[];
  comments: string;
  decision: 'favorable' | 'unfavorable' | null;
  createdAt: string;
}

export const DEFAULT_CATEGORIES: CriteriaCategory[] = [
  {
    id: 'communication',
    name: 'Communication',
    criteria: [
      { id: 'presentation', name: 'General Presentation', description: 'Appearance, posture, professionalism', weight: 1 },
      { id: 'expression', name: 'Quality of Expression', description: 'Clarity, structure, verbal fluency', weight: 1 },
      { id: 'nonverbal', name: 'Non-Verbal Communication', description: 'Eye contact, gestures, attitude', weight: 1 },
    ],
  },
  {
    id: 'knowledge',
    name: 'Knowledge',
    criteria: [
      { id: 'analysis', name: 'Analytical Capacity', description: 'Critical thinking, reasoning, logic', weight: 1 },
      { id: 'position-knowledge', name: 'Position Knowledge', description: 'Understanding of missions & challenges', weight: 1 },
      { id: 'company-knowledge', name: 'Company Knowledge', description: 'Activity, sector, positioning', weight: 1 },
    ],
  },
  {
    id: 'behavior',
    name: 'Behavior',
    criteria: [
      { id: 'motivation', name: 'Motivation', description: 'Genuine interest, projection, engagement', weight: 1 },
      { id: 'adaptability', name: 'Adaptability', description: 'Reactivity, flexibility, handling surprises', weight: 1 },
    ],
  },
  {
    id: 'profile',
    name: 'Profile',
    criteria: [
      { id: 'career-quality', name: 'Career Quality', description: 'Coherence, valuation of experiences', weight: 1 },
      { id: 'profile-fit', name: 'Profile / Position Fit', description: 'Skills vs position requirements', weight: 2 },
    ],
  },
];

export const DEFAULT_JOB_ROLES: JobRoleConfig[] = [
  { id: 'general', name: 'General', categories: DEFAULT_CATEGORIES, scaleMax: 4 },
  { id: 'engineering', name: 'Engineering', categories: DEFAULT_CATEGORIES, scaleMax: 4 },
  { id: 'management', name: 'Management', categories: DEFAULT_CATEGORIES, scaleMax: 4 },
];

export const MOCK_CANDIDATES: Candidate[] = [
  { id: '1', firstName: 'Youssef', lastName: 'Benali', jobTitle: 'Process Engineer', department: 'Operations', email: 'y.benali@email.com', source: 'external', status: 'WC' },
  { id: '2', firstName: 'Fatima', lastName: 'El Amrani', jobTitle: 'HR Manager', department: 'Human Resources', email: 'f.elamrani@email.com', source: 'internal', status: 'BC' },
  { id: '3', firstName: 'Karim', lastName: 'Tazi', jobTitle: 'Financial Analyst', department: 'Finance', email: 'k.tazi@email.com', source: 'external', status: 'WC' },
  { id: '4', firstName: 'Sara', lastName: 'Idrissi', jobTitle: 'Quality Engineer', department: 'Quality', email: 's.idrissi@email.com', source: 'external', status: 'WC' },
  { id: '5', firstName: 'Ahmed', lastName: 'Chraibi', jobTitle: 'Plant Manager', department: 'Production', email: 'a.chraibi@email.com', source: 'internal', status: 'BC' },
];
