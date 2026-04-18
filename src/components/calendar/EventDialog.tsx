import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Trash2 } from 'lucide-react';
import type { CalendarEvent, CalendarEventKind, NewCalendarEvent } from '@/hooks/useCalendar';
import { KIND_LABELS } from '@/hooks/useCalendar';
import { format } from 'date-fns';

interface Props {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  initialDate?: Date;
  initialEvent?: CalendarEvent | null;
  onSave: (ev: NewCalendarEvent) => Promise<void> | void;
  onDelete?: (id: string) => Promise<void> | void;
  allowSharedToggle?: boolean;
}

export function EventDialog({
  open,
  onOpenChange,
  initialDate,
  initialEvent,
  onSave,
  onDelete,
  allowSharedToggle = true,
}: Props) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [date, setDate] = useState('');
  const [startTime, setStartTime] = useState('09:00');
  const [endTime, setEndTime] = useState('10:00');
  const [kind, setKind] = useState<CalendarEventKind>('meeting');
  const [shared, setShared] = useState(false);
  const [saving, setSaving] = useState(false);

  // Sync state when dialog opens
  useState(() => undefined);
  const isEdit = !!initialEvent;
  const reset = () => {
    if (initialEvent) {
      const s = new Date(initialEvent.start_at);
      const e = new Date(initialEvent.end_at);
      setTitle(initialEvent.title);
      setDescription(initialEvent.description || '');
      setDate(format(s, 'yyyy-MM-dd'));
      setStartTime(format(s, 'HH:mm'));
      setEndTime(format(e, 'HH:mm'));
      setKind(initialEvent.kind);
      setShared(initialEvent.is_shared);
    } else {
      const d = initialDate || new Date();
      setTitle('');
      setDescription('');
      setDate(format(d, 'yyyy-MM-dd'));
      setStartTime('09:00');
      setEndTime('10:00');
      setKind('meeting');
      setShared(false);
    }
  };

  // re-init on open
  if (open && date === '' && !isEdit) reset();

  const handleOpen = (o: boolean) => {
    if (o) reset();
    onOpenChange(o);
  };

  const handleSubmit = async () => {
    if (!title.trim() || !date) return;
    setSaving(true);
    try {
      await onSave({
        title: title.trim(),
        description: description.trim() || undefined,
        start_at: new Date(`${date}T${startTime}:00`).toISOString(),
        end_at: new Date(`${date}T${endTime}:00`).toISOString(),
        kind,
        is_shared: shared,
      });
      onOpenChange(false);
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpen}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>{isEdit ? "Modifier l'événement" : 'Nouvel événement'}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3 py-2">
          <div>
            <Label>Titre</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Entretien candidat..." />
          </div>
          <div className="grid grid-cols-3 gap-2">
            <div>
              <Label className="text-xs">Date</Label>
              <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Début</Label>
              <Input type="time" value={startTime} onChange={(e) => setStartTime(e.target.value)} />
            </div>
            <div>
              <Label className="text-xs">Fin</Label>
              <Input type="time" value={endTime} onChange={(e) => setEndTime(e.target.value)} />
            </div>
          </div>
          <div>
            <Label className="text-xs">Type</Label>
            <Select value={kind} onValueChange={(v) => setKind(v as CalendarEventKind)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(KIND_LABELS) as CalendarEventKind[]).map((k) => (
                  <SelectItem key={k} value={k}>
                    {KIND_LABELS[k]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label className="text-xs">Description</Label>
            <Textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2} />
          </div>
          {allowSharedToggle && (
            <label className="flex items-center gap-2 text-sm cursor-pointer">
              <Checkbox checked={shared} onCheckedChange={(v) => setShared(!!v)} />
              <span>Partager avec toute l'équipe</span>
            </label>
          )}
        </div>
        <DialogFooter className="gap-2">
          {isEdit && onDelete && initialEvent && (
            <Button
              variant="destructive"
              size="sm"
              onClick={async () => {
                await onDelete(initialEvent.id);
                onOpenChange(false);
              }}
            >
              <Trash2 className="h-4 w-4 mr-1" /> Supprimer
            </Button>
          )}
          <div className="flex-1" />
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Annuler
          </Button>
          <Button onClick={handleSubmit} disabled={saving || !title.trim() || !date}>
            {isEdit ? 'Enregistrer' : 'Créer'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
