
CREATE TABLE public.fiches_embauche (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.fiches_embauche ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to fiches_embauche"
ON public.fiches_embauche FOR ALL
USING (true) WITH CHECK (true);

CREATE TABLE public.fiches_poste (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.fiches_poste ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to fiches_poste"
ON public.fiches_poste FOR ALL
USING (true) WITH CHECK (true);

CREATE TABLE public.plans_integration (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.plans_integration ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to plans_integration"
ON public.plans_integration FOR ALL
USING (true) WITH CHECK (true);

CREATE TABLE public.cvs_retenus (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  data JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cvs_retenus ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to cvs_retenus"
ON public.cvs_retenus FOR ALL
USING (true) WITH CHECK (true);

CREATE TRIGGER update_fiches_embauche_updated_at
BEFORE UPDATE ON public.fiches_embauche
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_fiches_poste_updated_at
BEFORE UPDATE ON public.fiches_poste
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_plans_integration_updated_at
BEFORE UPDATE ON public.plans_integration
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_cvs_retenus_updated_at
BEFORE UPDATE ON public.cvs_retenus
FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();
