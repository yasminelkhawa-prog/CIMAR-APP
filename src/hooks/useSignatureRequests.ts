import { useEffect, useState, useCallback } from 'react';
import { supabase } from '@/integrations/supabase/client';
import { useAuth } from '@/hooks/useAuth';
import { toast } from 'sonner';

export type SignatureDocType = 'evaluation' | 'fiche_embauche' | 'fiche_poste' | 'plan_integration';
export type SignatureRequestStatus = 'pending' | 'accepted' | 'declined';

export interface SignatureRequest {
  id: string;
  doc_type: SignatureDocType;
  doc_id: string;
  doc_title: string;
  requester_id: string;
  recipient_id: string;
  status: SignatureRequestStatus;
  message: string | null;
  signature_url: string | null;
  created_at: string;
  responded_at: string | null;
}

export interface ApprovedUser {
  user_id: string;
  full_name: string;
  title: string;
  signature_url: string | null;
}

export function useSignatureRequests() {
  const { user, profile } = useAuth();
  const [incoming, setIncoming] = useState<SignatureRequest[]>([]);
  const [outgoing, setOutgoing] = useState<SignatureRequest[]>([]);
  const [approvedUsers, setApprovedUsers] = useState<ApprovedUser[]>([]);

  const refresh = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('signature_requests')
      .select('*')
      .or(`requester_id.eq.${user.id},recipient_id.eq.${user.id}`)
      .order('created_at', { ascending: false });
    if (data) {
      setIncoming(data.filter((r) => r.recipient_id === user.id) as SignatureRequest[]);
      setOutgoing(data.filter((r) => r.requester_id === user.id) as SignatureRequest[]);
    }
  }, [user]);

  const refreshUsers = useCallback(async () => {
    if (!user) return;
    const { data } = await supabase
      .from('profiles')
      .select('user_id, full_name, title, signature_url, is_approved')
      .eq('is_approved', true);
    if (data) {
      setApprovedUsers(
        data
          .filter((p) => p.user_id !== user.id)
          .map((p) => ({
            user_id: p.user_id,
            full_name: p.full_name,
            title: p.title,
            signature_url: p.signature_url,
          })),
      );
    }
  }, [user]);

  useEffect(() => {
    if (!user) return;
    refresh();
    refreshUsers();

    const channel = supabase
      .channel(`sig-req-${user.id}`)
      .on(
        'postgres_changes',
        { event: '*', schema: 'public', table: 'signature_requests' },
        (payload) => {
          const row = (payload.new || payload.old) as SignatureRequest | undefined;
          if (!row) return;
          if (row.recipient_id === user.id || row.requester_id === user.id) {
            refresh();
            if (payload.eventType === 'INSERT' && row.recipient_id === user.id) {
              toast.info('Nouvelle demande de signature reçue');
            }
          }
        },
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [user, refresh, refreshUsers]);

  const sendRequest = useCallback(
    async (params: {
      doc_type: SignatureDocType;
      doc_id: string;
      doc_title: string;
      recipient_id: string;
      message?: string;
    }) => {
      if (!user) throw new Error('Not authenticated');
      const { error } = await supabase.from('signature_requests').insert({
        doc_type: params.doc_type,
        doc_id: params.doc_id,
        doc_title: params.doc_title,
        recipient_id: params.recipient_id,
        requester_id: user.id,
        message: params.message ?? null,
        status: 'pending',
      });
      if (error) throw error;
      await refresh();
    },
    [user, refresh],
  );

  const acceptRequest = useCallback(
    async (req: SignatureRequest) => {
      if (!user) return;
      if (!profile?.signature_url) {
        toast.error("Vous n'avez pas de signature enregistrée. Allez dans Profile & Signature pour en téléverser une.");
        return;
      }
      const { error } = await supabase
        .from('signature_requests')
        .update({
          status: 'accepted',
          signature_url: profile.signature_url,
          responded_at: new Date().toISOString(),
        })
        .eq('id', req.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Signature apposée sur le document');
      await refresh();
    },
    [user, profile, refresh],
  );

  const declineRequest = useCallback(
    async (req: SignatureRequest) => {
      const { error } = await supabase
        .from('signature_requests')
        .update({ status: 'declined', responded_at: new Date().toISOString() })
        .eq('id', req.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      toast.success('Demande refusée');
      await refresh();
    },
    [refresh],
  );

  const cancelRequest = useCallback(
    async (req: SignatureRequest) => {
      const { error } = await supabase.from('signature_requests').delete().eq('id', req.id);
      if (error) {
        toast.error(error.message);
        return;
      }
      await refresh();
    },
    [refresh],
  );

  const pendingCount = incoming.filter((r) => r.status === 'pending').length;

  return {
    incoming,
    outgoing,
    approvedUsers,
    pendingCount,
    sendRequest,
    acceptRequest,
    declineRequest,
    cancelRequest,
    refresh,
  };
}

/** Fetch accepted signature requests for a specific document. */
export async function fetchAcceptedSignatures(
  doc_type: SignatureDocType,
  doc_id: string,
): Promise<Array<{ recipient_id: string; signature_url: string; recipient_name: string; recipient_title: string; responded_at: string | null }>> {
  const { data: reqs } = await supabase
    .from('signature_requests')
    .select('recipient_id, signature_url, responded_at')
    .eq('doc_type', doc_type)
    .eq('doc_id', doc_id)
    .eq('status', 'accepted');
  if (!reqs || reqs.length === 0) return [];
  const ids = Array.from(new Set(reqs.map((r) => r.recipient_id)));
  const { data: profiles } = await supabase
    .from('profiles')
    .select('user_id, full_name, title')
    .in('user_id', ids);
  const profileMap = new Map((profiles || []).map((p) => [p.user_id, p]));
  return reqs
    .filter((r) => !!r.signature_url)
    .map((r) => {
      const p = profileMap.get(r.recipient_id);
      return {
        recipient_id: r.recipient_id,
        signature_url: r.signature_url as string,
        recipient_name: p?.full_name || '',
        recipient_title: p?.title || '',
        responded_at: r.responded_at,
      };
    });
}
