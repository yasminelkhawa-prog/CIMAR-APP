DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM pg_type
    WHERE typname = 'cv_analysis_status'
      AND typnamespace = 'public'::regnamespace
  ) THEN
    CREATE TYPE public.cv_analysis_status AS ENUM ('pending', 'processing', 'completed', 'failed');
  END IF;
END $$;

ALTER TABLE public.cv_analyses
ADD COLUMN IF NOT EXISTS status public.cv_analysis_status NOT NULL DEFAULT 'pending',
ADD COLUMN IF NOT EXISTS error_message text,
ADD COLUMN IF NOT EXISTS started_at timestamp with time zone,
ADD COLUMN IF NOT EXISTS completed_at timestamp with time zone;

UPDATE public.cv_analyses
SET
  status = 'completed',
  started_at = COALESCE(started_at, created_at),
  completed_at = COALESCE(completed_at, updated_at)
WHERE status = 'pending';

CREATE INDEX IF NOT EXISTS idx_cv_analyses_session_status_created_at
ON public.cv_analyses (session_id, status, created_at DESC);