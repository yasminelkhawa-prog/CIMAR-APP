-- Calendar events table (personal + shared, optional candidate link)
CREATE TYPE public.calendar_event_kind AS ENUM ('meeting','interview','onboarding','task','reminder','other');

CREATE TABLE public.calendar_events (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  owner_id UUID NOT NULL,
  title TEXT NOT NULL,
  description TEXT,
  start_at TIMESTAMPTZ NOT NULL,
  end_at TIMESTAMPTZ NOT NULL,
  all_day BOOLEAN NOT NULL DEFAULT false,
  kind public.calendar_event_kind NOT NULL DEFAULT 'other',
  color TEXT,
  is_shared BOOLEAN NOT NULL DEFAULT false,
  candidate_name TEXT,
  plan_integration_id UUID,
  plan_entry_id TEXT,
  source TEXT NOT NULL DEFAULT 'manual',
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_calendar_events_owner ON public.calendar_events(owner_id);
CREATE INDEX idx_calendar_events_start ON public.calendar_events(start_at);
CREATE INDEX idx_calendar_events_plan ON public.calendar_events(plan_integration_id);

ALTER TABLE public.calendar_events ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users see own + shared events"
ON public.calendar_events FOR SELECT
TO authenticated
USING (owner_id = auth.uid() OR is_shared = true);

CREATE POLICY "Users create own events"
ON public.calendar_events FOR INSERT
TO authenticated
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners update their events"
ON public.calendar_events FOR UPDATE
TO authenticated
USING (owner_id = auth.uid())
WITH CHECK (owner_id = auth.uid());

CREATE POLICY "Owners delete their events"
ON public.calendar_events FOR DELETE
TO authenticated
USING (owner_id = auth.uid());

CREATE TRIGGER update_calendar_events_updated_at
BEFORE UPDATE ON public.calendar_events
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

ALTER PUBLICATION supabase_realtime ADD TABLE public.calendar_events;
ALTER TABLE public.calendar_events REPLICA IDENTITY FULL;