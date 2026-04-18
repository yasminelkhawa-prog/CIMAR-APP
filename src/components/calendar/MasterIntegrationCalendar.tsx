import { useMemo, useState } from 'react';
import { MonthCalendar } from './MonthCalendar';
import { useCalendar, type CalendarEvent } from '@/hooks/useCalendar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { CalendarCheck, User, Sparkles } from 'lucide-react';
import { format, parseISO } from 'date-fns';
import { fr } from 'date-fns/locale';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

export function MasterIntegrationCalendar() {
  const cal = useCalendar({ onlyOnboarding: true });
  const [filter, setFilter] = useState<string>('__all');
  const [selected, setSelected] = useState<CalendarEvent | null>(null);

  const candidates = useMemo(() => {
    const set = new Set<string>();
    cal.events.forEach((e) => {
      if (e.candidate_name) set.add(e.candidate_name);
    });
    return Array.from(set).sort();
  }, [cal.events]);

  const filtered = useMemo(
    () => (filter === '__all' ? cal.events : cal.events.filter((e) => e.candidate_name === filter)),
    [cal.events, filter],
  );

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h2 className="text-xl font-bold flex items-center gap-2">
            <CalendarCheck className="h-5 w-5 text-primary" />
            Calendrier d'Intégration
          </h2>
          <p className="text-sm text-muted-foreground">
            Vue centralisée de tous les plannings d'onboarding des candidats.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Badge variant="outline" className="gap-1">
            <User className="h-3 w-3" /> {candidates.length} candidat(s)
          </Badge>
          <Badge variant="secondary" className="gap-1">
            <Sparkles className="h-3 w-3" /> {filtered.length} étape(s)
          </Badge>
          <Select value={filter} onValueChange={setFilter}>
            <SelectTrigger className="w-[200px] h-9">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all">Tous les candidats</SelectItem>
              {candidates.map((c) => (
                <SelectItem key={c} value={c}>
                  {c}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      <Card>
        <CardContent className="p-0">
          <MonthCalendar events={filtered} onSelectEvent={(e) => setSelected(e)} />
        </CardContent>
      </Card>

      {candidates.length === 0 && !cal.loading && (
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground text-sm">
            Aucun plan d'intégration n'a encore d'étapes datées. Renseignez les dates dans la section{' '}
            <strong>Plan d'Intégration</strong> pour les voir apparaître ici automatiquement.
          </CardContent>
        </Card>
      )}

      <Dialog open={!!selected} onOpenChange={(o) => !o && setSelected(null)}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-base">
              <CalendarCheck className="h-4 w-4 text-primary" />
              {selected?.title}
            </DialogTitle>
          </DialogHeader>
          {selected && (
            <div className="space-y-2 text-sm">
              {selected.candidate_name && (
                <div>
                  <span className="font-medium">Candidat :</span> {selected.candidate_name}
                </div>
              )}
              <div>
                <span className="font-medium">Date :</span>{' '}
                {format(parseISO(selected.start_at), "EEEE d MMMM yyyy 'à' HH:mm", { locale: fr })} —{' '}
                {format(parseISO(selected.end_at), 'HH:mm')}
              </div>
              {selected.description && (
                <div className="whitespace-pre-line text-muted-foreground border-t pt-2">{selected.description}</div>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
}
