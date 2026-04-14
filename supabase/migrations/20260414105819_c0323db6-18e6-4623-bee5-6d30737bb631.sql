
-- Create assessment status enum
CREATE TYPE public.assessment_status AS ENUM ('pending', 'completed', 'analyzed');

-- Create assessments table
CREATE TABLE public.assessments (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  uuid_token UUID NOT NULL DEFAULT gen_random_uuid() UNIQUE,
  candidate_name TEXT NOT NULL DEFAULT '',
  candidate_email TEXT DEFAULT '',
  job_role TEXT DEFAULT '',
  evaluation_id UUID REFERENCES public.evaluations(id) ON DELETE SET NULL,
  ocean_scores JSONB DEFAULT NULL,
  ai_analysis JSONB DEFAULT NULL,
  status assessment_status NOT NULL DEFAULT 'pending',
  created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
  completed_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT now()
);

-- Enable RLS
ALTER TABLE public.assessments ENABLE ROW LEVEL SECURITY;

-- Authenticated users can view all assessments
CREATE POLICY "Authenticated users can view assessments"
ON public.assessments FOR SELECT TO authenticated
USING (true);

-- Authenticated users can create assessments
CREATE POLICY "Authenticated users can create assessments"
ON public.assessments FOR INSERT TO authenticated
WITH CHECK (auth.uid() = created_by);

-- Authenticated users can update assessments
CREATE POLICY "Authenticated users can update assessments"
ON public.assessments FOR UPDATE TO authenticated
USING (true);

-- Authenticated users can delete assessments
CREATE POLICY "Authenticated users can delete assessments"
ON public.assessments FOR DELETE TO authenticated
USING (true);

-- Anonymous access by token (for candidates filling questionnaire)
CREATE POLICY "Anonymous can view assessment by token"
ON public.assessments FOR SELECT TO anon
USING (true);

CREATE POLICY "Anonymous can submit assessment by token"
ON public.assessments FOR UPDATE TO anon
USING (status = 'pending')
WITH CHECK (status = 'completed');

-- Trigger for updated_at
CREATE TRIGGER update_assessments_updated_at
BEFORE UPDATE ON public.assessments
FOR EACH ROW
EXECUTE FUNCTION public.update_updated_at_column();

-- Enable realtime
ALTER PUBLICATION supabase_realtime ADD TABLE public.assessments;
