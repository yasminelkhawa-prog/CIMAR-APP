import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import type { SignatureDocType } from '@/hooks/useSignatureRequests';

/**
 * Returns whether a given document is locked because at least one signature
 * request has been accepted on it. Subscribes to realtime updates so the lock
 * applies instantly across sessions.
 */
export function useDocumentLock(docType: SignatureDocType, docId: string | null | undefined) {
  const [locked, setLocked] = useState(false);
  const [loading, setLoading] = useState(false);

  const check = useCallback(async () => {
    if (!docId) {
      setLocked(false);
      return;
    }
    setLoading(true);
    const { data } = await supabase
      .from('signature_requests')
      .select('id')
      .eq('doc_type', docType)
      .eq('doc_id', docId)
      .eq('status', 'accepted')
      .limit(1);
    setLocked(!!data && data.length > 0);
    setLoading(false);
  }, [docType, docId]);

  useEffect(() => {
    check();
    if (!docId) return;
    const channel = supabase
      .channel(`doc-lock-${docType}-${docId}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'signature_requests', filter: `doc_id=eq.${docId}` },
        () => check(),
      )
      .subscribe();
    return () => {
      supabase.removeChannel(channel);
    };
  }, [docType, docId, check]);

  return { locked, loading, refresh: check };
}
