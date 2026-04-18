import { useState } from 'react';
import { DndContext, type DragEndEvent, PointerSensor, useSensor, useSensors } from '@dnd-kit/core';
import { MonthCalendar } from './MonthCalendar';
import { ProposalsPanel } from './ProposalsPanel';
import { EventDialog } from './EventDialog';
import { useCalendar, type CalendarEvent } from '@/hooks/useCalendar';
import { Card, CardContent } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Calendar as CalendarIcon, Users } from 'lucide-react';
import { toast } from 'sonner';
import type { DraggableProposal } from './ProposalsPanel';

export function GlobalCalendarPage() {
  const cal = useCalendar();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [initialDate, setInitialDate] = useState<Date | undefined>();
  const [editing, setEditing] = useState<CalendarEvent | null>(null);

  const sensors = useSensors(useSensor(PointerSensor, { activationConstraint: { distance: 5 } }));

  const handleDragEnd = async (e: DragEndEvent) => {
    const proposal = e.active.data.current as DraggableProposal | undefined;
    const dropped = e.over?.data.current as { date?: string } | undefined;
    if (!proposal || !dropped?.date) return;
    try {
      const start = new Date(`${dropped.date}T09:00:00`);
      const end = new Date(`${dropped.date}T10:00:00`);
      await cal.createEvent({
        title: proposal.title,
        kind: proposal.kind,
        start_at: start.toISOString(),
        end_at: end.toISOString(),
        is_shared: false,
        source: proposal.source === 'ai' ? 'ai_proposal' : 'manual',
      });
      toast.success('Événement créé');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : 'Erreur création');
    }
  };

  const sharedCount = cal.events.filter((e) => e.is_shared).length;

  return (
    <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
      <div className="space-y-4">
        <div className="flex items-center justify-between flex-wrap gap-3">
          <div>
            <h2 className="text-xl font-bold flex items-center gap-2">
              <CalendarIcon className="h-5 w-5 text-primary" />
              Calendrier
            </h2>
            <p className="text-sm text-muted-foreground">
              Planifiez vos rendez-vous, entretiens et tâches. Glissez les propositions IA sur une date.
            </p>
          </div>
          <div className="flex gap-2">
            <Badge variant="outline" className="gap-1">
              <CalendarIcon className="h-3 w-3" /> {cal.events.length} événement(s)
            </Badge>
            <Badge variant="secondary" className="gap-1">
              <Users className="h-3 w-3" /> {sharedCount} partagé(s)
            </Badge>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
          <Card>
            <CardContent className="p-0">
              <MonthCalendar
                events={cal.events}
                droppable
                onAddEvent={(d) => {
                  setEditing(null);
                  setInitialDate(d);
                  setDialogOpen(true);
                }}
                onSelectEvent={(ev) => {
                  setEditing(ev);
                  setDialogOpen(true);
                }}
              />
            </CardContent>
          </Card>
          <ProposalsPanel />
        </div>

        <EventDialog
          open={dialogOpen}
          onOpenChange={(o) => {
            setDialogOpen(o);
            if (!o) setEditing(null);
          }}
          initialDate={initialDate}
          initialEvent={editing}
          onSave={async (ev) => {
            if (editing) {
              await cal.updateEvent(editing.id, ev);
              toast.success('Événement mis à jour');
            } else {
              await cal.createEvent(ev);
              toast.success('Événement créé');
            }
          }}
          onDelete={async (id) => {
            await cal.deleteEvent(id);
            toast.success('Événement supprimé');
          }}
        />
      </div>
    </DndContext>
  );
}
