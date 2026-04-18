import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type CalendarEventKind = 'meeting' | 'interview' | 'onboarding' | 'task' | 'reminder' | 'other';

export interface CalendarEvent {
  id: string;
  owner_id: string;
  title: string;
  description: string | null;
  start_at: string;
  end_at: string;
  all_day: boolean;
  kind: CalendarEventKind;
  color: string | null;
  is_shared: boolean;
  candidate_name: string | null;
  plan_integration_id: string | null;
  plan_entry_id: string | null;
  source: string;
}

export interface NewCalendarEvent {
  title: string;
  description?: string;
  start_at: string;
  end_at: string;
  all_day?: boolean;
  kind?: CalendarEventKind;
  color?: string;
  is_shared?: boolean;
  candidate_name?: string;
  plan_integration_id?: string;
  plan_entry_id?: string;
  source?: string;
}

export const KIND_COLORS: Record<CalendarEventKind, string> = {
  meeting: 'hsl(217 91% 60%)',
  interview: 'hsl(280 81% 56%)',
  onboarding: 'hsl(160 64% 43%)',
  task: 'hsl(38 92% 50%)',
  reminder: 'hsl(0 72% 51%)',
  other: 'hsl(220 9% 46%)',
};

export const KIND_LABELS: Record<CalendarEventKind, string> = {
  meeting: 'Réunion',
  interview: 'Entretien',
  onboarding: 'Onboarding',
  task: 'Tâche',
  reminder: 'Rappel',
  other: 'Autre',
};

interface UseCalendarOptions {
  /** Filter to events of a specific plan_integration_id */
  planIntegrationId?: string | null;
  /** Only fetch onboarding-source events (for the master calendar) */
  onlyOnboarding?: boolean;
}

export function useCalendar(opts: UseCalendarOptions = {}) {
  const { user } = useAuth();
  const [events, setEvents] = useState<CalendarEvent[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    if (!user) {
      setEvents([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    let q = supabase.from('calendar_events').select('*').order('start_at', { ascending: true });
    if (opts.planIntegrationId) q = q.eq('plan_integration_id', opts.planIntegrationId);
    if (opts.onlyOnboarding) q = q.eq('source', 'plan_integration');
    const { data, error } = await q;
    if (error) {
      console.error(error);
      toast.error('Erreur de chargement du calendrier');
    } else {
      setEvents((data || []) as CalendarEvent[]);
    }
    setLoading(false);
  }, [user, opts.planIntegrationId, opts.onlyOnboarding]);

  useEffect(() => {
    refresh();
    if (!user) return;
    const channel = supabase
      .channel(`calendar-${user.id}-${opts.planIntegrationId ?? 'all'}-${opts.onlyOnboarding ? 'ob' : 'all'}`)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'calendar_events' }, () => refresh())
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [refresh, user, opts.planIntegrationId, opts.onlyOnboarding]);

  const createEvent = useCallback(
    async (ev: NewCalendarEvent) => {
      if (!user) throw new Error('Not authenticated');
      const { data, error } = await supabase
        .from('calendar_events')
        .insert({
          owner_id: user.id,
          title: ev.title,
          description: ev.description ?? null,
          start_at: ev.start_at,
          end_at: ev.end_at,
          all_day: ev.all_day ?? false,
          kind: ev.kind ?? 'other',
          color: ev.color ?? null,
          is_shared: ev.is_shared ?? false,
          candidate_name: ev.candidate_name ?? null,
          plan_integration_id: ev.plan_integration_id ?? null,
          plan_entry_id: ev.plan_entry_id ?? null,
          source: ev.source ?? 'manual',
        })
        .select()
        .single();
      if (error) throw error;
      return data as CalendarEvent;
    },
    [user],
  );

  const updateEvent = useCallback(async (id: string, partial: Partial<NewCalendarEvent>) => {
    const { error } = await supabase.from('calendar_events').update(partial).eq('id', id);
    if (error) throw error;
  }, []);

  const deleteEvent = useCallback(async (id: string) => {
    const { error } = await supabase.from('calendar_events').delete().eq('id', id);
    if (error) throw error;
  }, []);

  /** Sync plan_integration entries → calendar_events for a given plan. */
  const syncPlanEntries = useCallback(
    async (
      planId: string,
      candidateName: string,
      entries: Array<{
        id: string;
        date: string;
        horaire: string;
        direction: string;
        responsable: string;
        objectifs: string;
        activityType: 'planning' | 'formation';
      }>,
    ) => {
      if (!user) return;
      // Delete existing onboarding events for this plan, then re-insert
      await supabase.from('calendar_events').delete().eq('plan_integration_id', planId).eq('source', 'plan_integration');
      const valid = entries.filter((e) => e.date);
      if (valid.length === 0) return;
      const rows = valid.map((e) => {
        const [startH, endH] = parseHoraire(e.horaire);
        const start = new Date(`${e.date}T${startH}:00`);
        const end = new Date(`${e.date}T${endH}:00`);
        return {
          owner_id: user.id,
          title: `${e.activityType === 'formation' ? '📚 ' : '📋 '}${e.objectifs || e.direction || 'Étape onboarding'}`,
          description: `Candidat: ${candidateName || '—'}\nDirection: ${e.direction || '—'}\nResponsable: ${e.responsable || '—'}`,
          start_at: start.toISOString(),
          end_at: end.toISOString(),
          all_day: false,
          kind: 'onboarding' as CalendarEventKind,
          color: e.activityType === 'formation' ? KIND_COLORS.task : KIND_COLORS.onboarding,
          is_shared: true,
          candidate_name: candidateName || null,
          plan_integration_id: planId,
          plan_entry_id: e.id,
          source: 'plan_integration',
        };
      });
      const { error } = await supabase.from('calendar_events').insert(rows);
      if (error) console.error('Sync plan→calendar failed:', error);
    },
    [user],
  );

  return { events, loading, refresh, createEvent, updateEvent, deleteEvent, syncPlanEntries };
}

function parseHoraire(h: string): [string, string] {
  // accepts "09h00-10h30" or "09:00-10:30"
  const m = (h || '').replace(/h/gi, ':').match(/(\d{1,2}):?(\d{0,2})\s*-\s*(\d{1,2}):?(\d{0,2})/);
  if (!m) return ['09:00', '10:00'];
  const pad = (s: string) => s.padStart(2, '0');
  const a = `${pad(m[1])}:${pad(m[2] || '00')}`;
  const b = `${pad(m[3])}:${pad(m[4] || '00')}`;
  return [a, b];
}
