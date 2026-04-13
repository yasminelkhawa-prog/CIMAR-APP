import { useState, useCallback } from 'react';
import {
  JobRoleConfig,
  EvaluationForm,
  DEFAULT_JOB_ROLES,
  MOCK_CANDIDATES,
  Candidate,
  CriteriaCategory,
} from '@/types/evaluation';

const STORAGE_KEY_ROLES = 'numa-job-roles';
const STORAGE_KEY_EVALUATIONS = 'numa-evaluations';

function loadFromStorage<T>(key: string, fallback: T): T {
  try {
    const stored = localStorage.getItem(key);
    return stored ? JSON.parse(stored) : fallback;
  } catch {
    return fallback;
  }
}

function saveToStorage<T>(key: string, value: T) {
  localStorage.setItem(key, JSON.stringify(value));
}

export function useEvaluationStore() {
  const [jobRoles, setJobRoles] = useState<JobRoleConfig[]>(() =>
    loadFromStorage(STORAGE_KEY_ROLES, DEFAULT_JOB_ROLES)
  );
  const [evaluations, setEvaluations] = useState<EvaluationForm[]>(() =>
    loadFromStorage(STORAGE_KEY_EVALUATIONS, [])
  );
  const [candidates] = useState<Candidate[]>(MOCK_CANDIDATES);

  const updateJobRoles = useCallback((roles: JobRoleConfig[]) => {
    setJobRoles(roles);
    saveToStorage(STORAGE_KEY_ROLES, roles);
  }, []);

  const addJobRole = useCallback((role: JobRoleConfig) => {
    setJobRoles(prev => {
      const next = [...prev, role];
      saveToStorage(STORAGE_KEY_ROLES, next);
      return next;
    });
  }, []);

  const updateJobRole = useCallback((id: string, updates: Partial<JobRoleConfig>) => {
    setJobRoles(prev => {
      const next = prev.map(r => r.id === id ? { ...r, ...updates } : r);
      saveToStorage(STORAGE_KEY_ROLES, next);
      return next;
    });
  }, []);

  const deleteJobRole = useCallback((id: string) => {
    setJobRoles(prev => {
      const next = prev.filter(r => r.id !== id);
      saveToStorage(STORAGE_KEY_ROLES, next);
      return next;
    });
  }, []);

  const updateRoleCategories = useCallback((roleId: string, categories: CriteriaCategory[]) => {
    setJobRoles(prev => {
      const next = prev.map(r => r.id === roleId ? { ...r, categories } : r);
      saveToStorage(STORAGE_KEY_ROLES, next);
      return next;
    });
  }, []);

  const saveEvaluation = useCallback((evaluation: EvaluationForm) => {
    setEvaluations(prev => {
      const exists = prev.findIndex(e => e.id === evaluation.id);
      const next = exists >= 0
        ? prev.map(e => e.id === evaluation.id ? evaluation : e)
        : [...prev, evaluation];
      saveToStorage(STORAGE_KEY_EVALUATIONS, next);
      return next;
    });
  }, []);

  const deleteEvaluation = useCallback((id: string) => {
    setEvaluations(prev => {
      const next = prev.filter(e => e.id !== id);
      saveToStorage(STORAGE_KEY_EVALUATIONS, next);
      return next;
    });
  }, []);

  return {
    jobRoles,
    evaluations,
    candidates,
    updateJobRoles,
    addJobRole,
    updateJobRole,
    deleteJobRole,
    updateRoleCategories,
    saveEvaluation,
    deleteEvaluation,
  };
}
