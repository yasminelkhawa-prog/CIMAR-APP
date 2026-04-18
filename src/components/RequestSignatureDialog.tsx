import { useState } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogFooter } from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Badge } from '@/components/ui/badge';
import { PenLine, Send, Check } from 'lucide-react';
import { useSignatureRequests, type SignatureDocType, type SignatureRequest } from '@/hooks/useSignatureRequests';
import { toast } from 'sonner';

interface Props {
  docType: SignatureDocType;
  docId: string | null;
  docTitle: string;
  /** When true, hides the trigger button — use externalOpen to control. */
  buttonVariant?: 'default' | 'outline' | 'ghost' | 'secondary';
  buttonSize?: 'default' | 'sm' | 'lg' | 'icon';
  /** Existing request statuses for this doc (to display under the button). */
  existingForDoc?: SignatureRequest[];
}

export function RequestSignatureDialog({ docType, docId, docTitle, buttonVariant = 'outline', buttonSize = 'sm', existingForDoc = [] }: Props) {
  const { approvedUsers, sendRequest, outgoing } = useSignatureRequests();
  const [open, setOpen] = useState(false);
  const [recipientId, setRecipientId] = useState<string>('');
  const [message, setMessage] = useState('');
  const [sending, setSending] = useState(false);

  // Combine outgoing + provided existing for status pills
  const docRequests = [
    ...existingForDoc,
    ...outgoing.filter((r) => r.doc_type === docType && r.doc_id === docId && !existingForDoc.find((x) => x.id === r.id)),
  ];

  const handleSend = async () => {
    if (!docId) {
      toast.error('Veuillez d\'abord enregistrer la fiche avant de demander une signature.');
      return;
    }
    if (!recipientId) {
      toast.error('Sélectionnez un destinataire.');
      return;
    }
    setSending(true);
    try {
      await sendRequest({ doc_type: docType, doc_id: docId, doc_title: docTitle || 'Sans titre', recipient_id: recipientId, message });
      toast.success('Demande de signature envoyée');
      setOpen(false);
      setRecipientId('');
      setMessage('');
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur lors de l\'envoi');
    } finally {
      setSending(false);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogTrigger asChild>
          <Button variant={buttonVariant} size={buttonSize} disabled={!docId}>
            <PenLine className="h-4 w-4 mr-1" /> Demander signature
          </Button>
        </DialogTrigger>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Demander une signature électronique</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="text-sm text-muted-foreground">
              Document : <span className="font-medium text-foreground">{docTitle || 'Sans titre'}</span>
            </div>
            <div>
              <Label>Destinataire</Label>
              <Select value={recipientId} onValueChange={setRecipientId}>
                <SelectTrigger><SelectValue placeholder="Sélectionner un utilisateur..." /></SelectTrigger>
                <SelectContent>
                  {approvedUsers.length === 0 && (
                    <div className="p-2 text-xs text-muted-foreground">Aucun autre utilisateur approuvé.</div>
                  )}
                  {approvedUsers.map((u) => (
                    <SelectItem key={u.user_id} value={u.user_id}>
                      <div className="flex items-center gap-2">
                        <span className="font-medium">{u.full_name || '(sans nom)'}</span>
                        {u.title && <span className="text-xs text-muted-foreground">— {u.title}</span>}
                        {!u.signature_url && <Badge variant="outline" className="text-[10px]">sans signature</Badge>}
                      </div>
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div>
              <Label>Message (optionnel)</Label>
              <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={3} placeholder="Bonjour, merci de bien vouloir signer ce document..." />
            </div>
          </div>
          <DialogFooter>
            <Button variant="ghost" onClick={() => setOpen(false)}>Annuler</Button>
            <Button onClick={handleSend} disabled={sending || !recipientId}>
              <Send className="h-4 w-4 mr-1" /> Envoyer la demande
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {docRequests.length > 0 && (
        <div className="flex flex-wrap gap-1 justify-end max-w-xs">
          {docRequests.map((r) => (
            <Badge
              key={r.id}
              variant={r.status === 'accepted' ? 'default' : r.status === 'declined' ? 'destructive' : 'secondary'}
              className="text-[10px] gap-1"
            >
              {r.status === 'accepted' && <Check className="h-2.5 w-2.5" />}
              {r.status === 'pending' ? 'En attente' : r.status === 'accepted' ? 'Signé' : 'Refusé'}
            </Badge>
          ))}
        </div>
      )}
    </div>
  );
}
