import { useState, useCallback, useEffect } from 'react';
import {
  JobRoleConfig,
  EvaluationForm,
  DEFAULT_JOB_ROLES,
  CriteriaCategory,
} from '@/types/evaluation';
import { supabase } from '@/integrations/supabase/client';
import type { Json } from '@/integrations/supabase/types';

export function useEvaluationStore() {
  const [jobRoles, setJobRoles] = useState<JobRoleConfig[]>(DEFAULT_JOB_ROLES);
  const [evaluations, setEvaluations] = useState<EvaluationForm[]>([]);
  const [loading, setLoading] = useState(true);

  // Load from DB
  useEffect(() => {
    const loadData = async () => {
      const [rolesRes, evalsRes] = await Promise.all([
        supabase.from('job_role_configs').select('*'),
        supabase.from('evaluations').select('*').order('created_at', { ascending: false }),
      ]);

      if (rolesRes.data && rolesRes.data.length > 0) {
        setJobRoles(rolesRes.data.map(r => ({
          id: r.id,
          name: r.name,
          categories: r.categories as unknown as CriteriaCategory[],
          scaleMax: r.scale_max,
        })));
      } else {
        // Seed default roles (let DB generate UUIDs)
        const inserted: JobRoleConfig[] = [];
        for (const role of DEFAULT_JOB_ROLES) {
          const { data: ins } = await supabase.from('job_role_configs').insert({
            name: role.name,
            categories: role.categories as unknown as Json,
            scale_max: role.scaleMax,
          }).select().single();
          if (ins) {
            inserted.push({
              id: ins.id,
              name: ins.name,
              categories: ins.categories as unknown as CriteriaCategory[],
              scaleMax: ins.scale_max,
            });
          }
        }
        if (inserted.length > 0) setJobRoles(inserted);
      }

      if (evalsRes.data) {
        setEvaluations(evalsRes.data.map(e => ({
          id: e.id,
          candidateName: e.candidate_name,
          candidateSource: e.candidate_source as 'internal' | 'external',
          jobRoleConfigId: e.job_role_config_id || '',
          interviewerName: e.interviewer_name || '',
          date: e.evaluation_date,
          location: e.location || '',
          recruitmentReason: e.recruitment_reason as 'replacement' | 'creation' | 'other',
          recruitmentType: e.recruitment_type as 'budgeted' | 'non-budgeted',
          scores: e.scores as unknown as EvaluationForm['scores'],
          comments: e.comments || '',
          decision: e.decision as 'favorable' | 'unfavorable' | null,
          createdAt: e.created_at,
        })));
      }
      setLoading(false);
    };
    loadData();
  }, []);

  const addJobRole = useCallback(async (role: JobRoleConfig) => {
    const { data: ins } = await supabase.from('job_role_configs').insert({
      name: role.name,
      categories: role.categories as unknown as Json,
      scale_max: role.scaleMax,
    }).select().single();
    const finalRole: JobRoleConfig = ins
      ? { id: ins.id, name: ins.name, categories: ins.categories as unknown as CriteriaCategory[], scaleMax: ins.scale_max }
      : role;
    setJobRoles(prev => [...prev, finalRole]);
  }, []);

  const updateJobRole = useCallback(async (id: string, updates: Partial<JobRoleConfig>) => {
    setJobRoles(prev => prev.map(r => r.id === id ? { ...r, ...updates } : r));
    const dbUpdates: { name?: string; categories?: Json; scale_max?: number } = {};
    if (updates.name) dbUpdates.name = updates.name;
    if (updates.categories) dbUpdates.categories = updates.categories as unknown as Json;
    if (updates.scaleMax) dbUpdates.scale_max = updates.scaleMax;
    await supabase.from('job_role_configs').update(dbUpdates).eq('id', id);
  }, []);

  const deleteJobRole = useCallback(async (id: string) => {
    setJobRoles(prev => prev.filter(r => r.id !== id));
    await supabase.from('job_role_configs').delete().eq('id', id);
  }, []);

  const updateRoleCategories = useCallback(async (roleId: string, categories: CriteriaCategory[]) => {
    setJobRoles(prev => prev.map(r => r.id === roleId ? { ...r, categories } : r));
    await supabase.from('job_role_configs').update({ categories: categories as unknown as Json }).eq('id', roleId);
  }, []);

  const saveEvaluation = useCallback(async (evaluation: EvaluationForm) => {
    setEvaluations(prev => {
      const exists = prev.findIndex(e => e.id === evaluation.id);
      return exists >= 0
        ? prev.map(e => e.id === evaluation.id ? evaluation : e)
        : [evaluation, ...prev];
    });

    await supabase.from('evaluations').upsert({
      id: evaluation.id,
      candidate_name: evaluation.candidateName,
      candidate_source: evaluation.candidateSource,
      job_role_config_id: evaluation.jobRoleConfigId || null,
      interviewer_name: evaluation.interviewerName || null,
      evaluation_date: evaluation.date,
      location: evaluation.location || null,
      recruitment_reason: evaluation.recruitmentReason,
      recruitment_type: evaluation.recruitmentType,
      scores: evaluation.scores as unknown as Json,
      comments: evaluation.comments || null,
      decision: evaluation.decision || null,
    });
  }, []);

  const deleteEvaluation = useCallback(async (id: string) => {
    setEvaluations(prev => prev.filter(e => e.id !== id));
    await supabase.from('evaluations').delete().eq('id', id);
  }, []);

  return {
    jobRoles,
    evaluations,
    loading,
    addJobRole,
    updateJobRole,
    deleteJobRole,
    updateRoleCategories,
    saveEvaluation,
    deleteEvaluation,
  };
}
