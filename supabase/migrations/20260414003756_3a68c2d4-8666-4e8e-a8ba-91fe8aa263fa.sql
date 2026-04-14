
-- Create cv_analyses table
CREATE TABLE public.cv_analyses (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id UUID NOT NULL DEFAULT gen_random_uuid(),
  nom_candidat TEXT NOT NULL DEFAULT '',
  email TEXT DEFAULT '',
  poste_assigne TEXT NOT NULL DEFAULT '',
  matching_score INTEGER NOT NULL DEFAULT 0,
  competences_cles JSONB NOT NULL DEFAULT '[]'::jsonb,
  synthese_ia TEXT NOT NULL DEFAULT '',
  cv_file_path TEXT DEFAULT '',
  cv_raw_text TEXT DEFAULT '',
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

ALTER TABLE public.cv_analyses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Allow all access to cv_analyses"
ON public.cv_analyses FOR ALL
USING (true) WITH CHECK (true);

CREATE TRIGGER update_cv_analyses_updated_at
BEFORE UPDATE ON public.cv_analyses
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Create storage bucket for CV uploads
INSERT INTO storage.buckets (id, name, public) VALUES ('cv-uploads', 'cv-uploads', true);

CREATE POLICY "Allow public read cv-uploads"
ON storage.objects FOR SELECT
USING (bucket_id = 'cv-uploads');

CREATE POLICY "Allow public upload cv-uploads"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'cv-uploads');

CREATE POLICY "Allow public delete cv-uploads"
ON storage.objects FOR DELETE
USING (bucket_id = 'cv-uploads');
