import { useState } from 'react';
import { useDraggable } from '@dnd-kit/core';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Sparkles, Plus, GripVertical, Loader2 } from 'lucide-react';
import { supabase } from '@/integrations/supabase/client';
import { toast } from 'sonner';
import { Badge } from '@/components/ui/badge';

export interface DraggableProposal {
  id: string;
  title: string;
  kind: 'meeting' | 'interview' | 'task' | 'reminder' | 'other';
  description?: string;
  duration_minutes?: number;
  source: 'ai' | 'user';
}

interface Props {
  /** Optional context to give the AI (e.g. current candidate) */
  contextHint?: string;
}

export function ProposalsPanel({ contextHint }: Props) {
  const [proposals, setProposals] = useState<DraggableProposal[]>([]);
  const [customTitle, setCustomTitle] = useState('');
  const [loading, setLoading] = useState(false);

  const generate = async () => {
    setLoading(true);
    try {
      const { data, error } = await supabase.functions.invoke('form-assistant', {
        body: {
          formType: 'cvs_retenus',
          currentData: contextHint ? { context: contextHint } : null,
          messages: [
            {
              role: 'user',
              content: `Propose 5 actions/RDV concrets à planifier cette semaine pour un recruteur RH${
                contextHint ? ` (contexte: ${contextHint})` : ''
              }. Retourne UNIQUEMENT une liste numérotée courte (1 ligne par item, max 8 mots), sans introduction.`,
            },
          ],
        },
      });
      if (error) throw error;
      if (data?.error) throw new Error(data.error);
      const text: string = data?.text || '';
      const items = text
        .split('\n')
        .map((l) => l.replace(/^[\s\d\.\-\*•]+/, '').trim())
        .filter((l) => l.length > 3 && l.length < 120)
        .slice(0, 6);
      setProposals(
        items.map((title, i) => ({
          id: `ai-${Date.now()}-${i}`,
          title,
          kind: /entretien|interview|call/i.test(title) ? 'interview' : 'task',
          source: 'ai',
        })),
      );
    } catch (e) {
      toast.error(e instanceof Error ? e.message : 'Erreur IA');
    } finally {
      setLoading(false);
    }
  };

  const addCustom = () => {
    if (!customTitle.trim()) return;
    setProposals((p) => [
      { id: `user-${Date.now()}`, title: customTitle.trim(), kind: 'task', source: 'user' },
      ...p,
    ]);
    setCustomTitle('');
  };

  const remove = (id: string) => setProposals((p) => p.filter((x) => x.id !== id));

  return (
    <Card className="h-full flex flex-col">
      <CardHeader className="pb-3 border-b">
        <CardTitle className="text-sm flex items-center gap-2">
          <Sparkles className="h-4 w-4 text-primary" />
          Propositions à glisser
        </CardTitle>
        <p className="text-[11px] text-muted-foreground">
          Glissez ces cartes vers une date du calendrier pour planifier rapidement.
        </p>
      </CardHeader>
      <CardContent className="flex-1 flex flex-col gap-3 p-3 overflow-hidden">
        <Button onClick={generate} disabled={loading} size="sm" variant="outline" className="w-full">
          {loading ? <Loader2 className="h-4 w-4 mr-2 animate-spin" /> : <Sparkles className="h-4 w-4 mr-2" />}
          Générer avec l'IA
        </Button>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            addCustom();
          }}
          className="flex gap-1.5"
        >
          <Input
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder="Action personnalisée..."
            className="text-xs h-8"
          />
          <Button type="submit" size="icon" className="h-8 w-8" disabled={!customTitle.trim()}>
            <Plus className="h-4 w-4" />
          </Button>
        </form>

        <div className="flex-1 overflow-y-auto space-y-1.5 pr-1">
          {proposals.length === 0 && (
            <div className="text-center text-muted-foreground text-xs py-6">
              Aucune proposition. Générez-en avec l'IA ou créez la vôtre.
            </div>
          )}
          {proposals.map((p) => (
            <ProposalCard key={p.id} proposal={p} onRemove={() => remove(p.id)} />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

function ProposalCard({ proposal, onRemove }: { proposal: DraggableProposal; onRemove: () => void }) {
  const { attributes, listeners, setNodeRef, transform, isDragging } = useDraggable({
    id: proposal.id,
    data: proposal,
  });
  const style = transform
    ? { transform: `translate3d(${transform.x}px, ${transform.y}px, 0)`, zIndex: 50 }
    : undefined;

  return (
    <div
      ref={setNodeRef}
      style={style}
      className={`group flex items-start gap-1.5 p-2 rounded-md border bg-card hover:bg-muted/40 transition-colors ${
        isDragging ? 'opacity-60 shadow-lg' : ''
      }`}
    >
      <button {...attributes} {...listeners} className="cursor-grab active:cursor-grabbing pt-0.5" aria-label="Glisser">
        <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium leading-tight">{proposal.title}</p>
        <Badge variant={proposal.source === 'ai' ? 'default' : 'secondary'} className="text-[9px] mt-1 h-4">
          {proposal.source === 'ai' ? 'IA' : 'Manuel'}
        </Badge>
      </div>
      <button
        onClick={onRemove}
        className="opacity-0 group-hover:opacity-100 text-muted-foreground hover:text-destructive text-xs"
        aria-label="Retirer"
      >
        ×
      </button>
    </div>
  );
}
