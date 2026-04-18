-- Enum pour le type de fiche
CREATE TYPE public.signature_doc_type AS ENUM ('evaluation', 'fiche_embauche', 'fiche_poste', 'plan_integration');
CREATE TYPE public.signature_request_status AS ENUM ('pending', 'accepted', 'declined');

CREATE TABLE public.signature_requests (
  id UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  doc_type public.signature_doc_type NOT NULL,
  doc_id UUID NOT NULL,
  doc_title TEXT NOT NULL DEFAULT '',
  requester_id UUID NOT NULL,
  recipient_id UUID NOT NULL,
  status public.signature_request_status NOT NULL DEFAULT 'pending',
  message TEXT,
  signature_url TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  responded_at TIMESTAMPTZ
);

CREATE INDEX idx_signature_requests_recipient ON public.signature_requests(recipient_id, status);
CREATE INDEX idx_signature_requests_doc ON public.signature_requests(doc_type, doc_id);

ALTER TABLE public.signature_requests ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own requests"
  ON public.signature_requests
  FOR SELECT
  TO authenticated
  USING (auth.uid() = requester_id OR auth.uid() = recipient_id);

CREATE POLICY "Users can create requests as requester"
  ON public.signature_requests
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = requester_id);

CREATE POLICY "Recipients can update their requests"
  ON public.signature_requests
  FOR UPDATE
  TO authenticated
  USING (auth.uid() = recipient_id)
  WITH CHECK (auth.uid() = recipient_id);

CREATE POLICY "Requesters can delete their requests"
  ON public.signature_requests
  FOR DELETE
  TO authenticated
  USING (auth.uid() = requester_id);

-- Realtime
ALTER TABLE public.signature_requests REPLICA IDENTITY FULL;
ALTER PUBLICATION supabase_realtime ADD TABLE public.signature_requests;