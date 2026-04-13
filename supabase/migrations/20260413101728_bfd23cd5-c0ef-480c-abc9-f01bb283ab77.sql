CREATE TABLE public.job_role_configs (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  name TEXT NOT NULL,
  categories JSONB NOT NULL DEFAULT '[]'::jsonb,
  scale_max INTEGER NOT NULL DEFAULT 4,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

CREATE TABLE public.evaluations (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  candidate_name TEXT NOT NULL,
  candidate_source TEXT NOT NULL DEFAULT 'external' CHECK (candidate_source IN ('internal', 'external')),
  job_role_config_id UUID REFERENCES public.job_role_configs(id) ON DELETE SET NULL,
  interviewer_name TEXT,
  evaluation_date DATE NOT NULL DEFAULT CURRENT_DATE,
  location TEXT,
  recruitment_reason TEXT NOT NULL DEFAULT 'replacement' CHECK (recruitment_reason IN ('replacement', 'creation', 'other')),
  recruitment_type TEXT NOT NULL DEFAULT 'budgeted' CHECK (recruitment_type IN ('budgeted', 'non-budgeted')),
  scores JSONB NOT NULL DEFAULT '[]'::jsonb,
  comments TEXT,
  decision TEXT CHECK (decision IN ('favorable', 'unfavorable')),
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.job_role_configs ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evaluations ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to job_role_configs" ON public.job_role_configs FOR ALL USING (true) WITH CHECK (true);
CREATE POLICY "Allow all access to evaluations" ON public.evaluations FOR ALL USING (true) WITH CHECK (true);

CREATE OR REPLACE FUNCTION public.update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SET search_path = public;

CREATE TRIGGER update_job_role_configs_updated_at
  BEFORE UPDATE ON public.job_role_configs
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_evaluations_updated_at
  BEFORE UPDATE ON public.evaluations
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();