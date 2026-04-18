import { useState } from 'react';
import { Bell, Check, X, FileText, Briefcase, ClipboardList, CalendarCheck, PenLine } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useSignatureRequests, type SignatureDocType } from '@/hooks/useSignatureRequests';
import { formatDistanceToNow } from 'date-fns';
import { fr } from 'date-fns/locale';

const DOC_LABELS: Record<SignatureDocType, { label: string; icon: typeof FileText }> = {
  evaluation: { label: "Grille d'évaluation", icon: ClipboardList },
  fiche_embauche: { label: "Fiche d'embauche", icon: FileText },
  fiche_poste: { label: 'Fiche de poste', icon: Briefcase },
  plan_integration: { label: "Plan d'intégration", icon: CalendarCheck },
};

export function NotificationsBell() {
  const { incoming, pendingCount, acceptRequest, declineRequest } = useSignatureRequests();
  const [open, setOpen] = useState(false);
  const recent = incoming.slice(0, 20);

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button variant="ghost" size="icon" className="relative">
          <Bell className="h-5 w-5" />
          {pendingCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 h-4 min-w-4 px-1 rounded-full bg-destructive text-destructive-foreground text-[10px] font-bold flex items-center justify-center">
              {pendingCount > 9 ? '9+' : pendingCount}
            </span>
          )}
        </Button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-96 p-0">
        <div className="flex items-center justify-between p-3 border-b">
          <h3 className="text-sm font-semibold flex items-center gap-2">
            <PenLine className="h-4 w-4" />
            Demandes de signature
          </h3>
          {pendingCount > 0 && <Badge variant="secondary">{pendingCount} en attente</Badge>}
        </div>
        <ScrollArea className="max-h-[60vh]">
          {recent.length === 0 ? (
            <div className="text-center text-xs text-muted-foreground py-10">
              <Bell className="h-8 w-8 mx-auto mb-2 opacity-30" />
              Aucune notification
            </div>
          ) : (
            <div className="divide-y">
              {recent.map((req) => {
                const meta = DOC_LABELS[req.doc_type];
                const Icon = meta.icon;
                const isPending = req.status === 'pending';
                return (
                  <div key={req.id} className="p-3 space-y-2">
                    <div className="flex items-start gap-2">
                      <div className="mt-0.5 p-1.5 rounded bg-muted">
                        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium leading-tight">
                          Signature demandée — {meta.label}
                        </p>
                        <p className="text-xs text-muted-foreground truncate">{req.doc_title || 'Sans titre'}</p>
                        {req.message && (
                          <p className="text-[11px] italic text-muted-foreground mt-1 line-clamp-2">"{req.message}"</p>
                        )}
                        <p className="text-[10px] text-muted-foreground mt-1">
                          {formatDistanceToNow(new Date(req.created_at), { addSuffix: true, locale: fr })}
                        </p>
                      </div>
                      {!isPending && (
                        <Badge variant={req.status === 'accepted' ? 'default' : 'destructive'} className="text-[10px] shrink-0">
                          {req.status === 'accepted' ? 'Signé' : 'Refusé'}
                        </Badge>
                      )}
                    </div>
                    {isPending && (
                      <div className="flex gap-2 pl-8">
                        <Button size="sm" className="h-7 text-xs flex-1" onClick={() => acceptRequest(req)}>
                          <Check className="h-3 w-3 mr-1" /> Accepter & signer
                        </Button>
                        <Button size="sm" variant="outline" className="h-7 text-xs" onClick={() => declineRequest(req)}>
                          <X className="h-3 w-3 mr-1" /> Refuser
                        </Button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </ScrollArea>
      </PopoverContent>
    </Popover>
  );
}
