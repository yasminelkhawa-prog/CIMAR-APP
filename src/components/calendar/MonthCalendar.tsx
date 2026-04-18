import { useState, useMemo } from 'react';
import {
  startOfMonth,
  endOfMonth,
  startOfWeek,
  endOfWeek,
  addDays,
  format,
  isSameMonth,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { ChevronLeft, ChevronRight, Plus } from 'lucide-react';
import { useDroppable } from '@dnd-kit/core';
import type { CalendarEvent } from '@/hooks/useCalendar';
import { KIND_COLORS } from '@/hooks/useCalendar';
import { cn } from '@/lib/utils';

interface Props {
  events: CalendarEvent[];
  onSelectDay?: (date: Date) => void;
  onSelectEvent?: (event: CalendarEvent) => void;
  onAddEvent?: (date: Date) => void;
  /** Enable dnd-kit droppable cells */
  droppable?: boolean;
  /** Compact mode (mini calendar) */
  compact?: boolean;
}

export function MonthCalendar({ events, onSelectDay, onSelectEvent, onAddEvent, droppable, compact }: Props) {
  const [cursor, setCursor] = useState(new Date());

  const days = useMemo(() => {
    const monthStart = startOfMonth(cursor);
    const monthEnd = endOfMonth(monthStart);
    const start = startOfWeek(monthStart, { weekStartsOn: 1 });
    const end = endOfWeek(monthEnd, { weekStartsOn: 1 });
    const out: Date[] = [];
    let d = start;
    while (d <= end) {
      out.push(d);
      d = addDays(d, 1);
    }
    return out;
  }, [cursor]);

  const eventsByDay = useMemo(() => {
    const map = new Map<string, CalendarEvent[]>();
    events.forEach((e) => {
      const k = format(parseISO(e.start_at), 'yyyy-MM-dd');
      const arr = map.get(k) || [];
      arr.push(e);
      map.set(k, arr);
    });
    return map;
  }, [events]);

  return (
    <div className="rounded-lg border bg-card">
      <div className="flex items-center justify-between p-3 border-b">
        <h3 className={cn('font-semibold capitalize', compact ? 'text-sm' : 'text-base')}>
          {format(cursor, 'MMMM yyyy', { locale: fr })}
        </h3>
        <div className="flex items-center gap-1">
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCursor(subMonths(cursor, 1))}>
            <ChevronLeft className="h-4 w-4" />
          </Button>
          <Button variant="ghost" size="sm" className="h-7 text-xs" onClick={() => setCursor(new Date())}>
            Aujourd'hui
          </Button>
          <Button variant="ghost" size="icon" className="h-7 w-7" onClick={() => setCursor(addMonths(cursor, 1))}>
            <ChevronRight className="h-4 w-4" />
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-7 text-center text-[10px] uppercase font-semibold text-muted-foreground border-b bg-muted/30">
        {['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'].map((d) => (
          <div key={d} className="py-1.5">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7">
        {days.map((d) => (
          <DayCell
            key={d.toISOString()}
            date={d}
            inMonth={isSameMonth(d, cursor)}
            events={eventsByDay.get(format(d, 'yyyy-MM-dd')) || []}
            onSelectDay={onSelectDay}
            onSelectEvent={onSelectEvent}
            onAddEvent={onAddEvent}
            droppable={droppable}
            compact={compact}
          />
        ))}
      </div>
    </div>
  );
}

interface DayCellProps {
  date: Date;
  inMonth: boolean;
  events: CalendarEvent[];
  onSelectDay?: (d: Date) => void;
  onSelectEvent?: (e: CalendarEvent) => void;
  onAddEvent?: (d: Date) => void;
  droppable?: boolean;
  compact?: boolean;
}

function DayCell({ date, inMonth, events, onSelectDay, onSelectEvent, onAddEvent, droppable, compact }: DayCellProps) {
  const isToday = isSameDay(date, new Date());
  const id = `cal-day-${format(date, 'yyyy-MM-dd')}`;
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { date: format(date, 'yyyy-MM-dd') },
    disabled: !droppable,
  });

  return (
    <div
      ref={setNodeRef}
      onClick={() => onSelectDay?.(date)}
      className={cn(
        'group border-b border-r p-1 cursor-pointer relative transition-colors',
        compact ? 'min-h-[60px]' : 'min-h-[100px]',
        !inMonth && 'bg-muted/20 text-muted-foreground',
        isOver && 'bg-primary/10 ring-2 ring-primary ring-inset',
        'hover:bg-muted/30',
      )}
    >
      <div className="flex items-center justify-between">
        <span
          className={cn(
            'text-xs font-medium inline-flex items-center justify-center rounded-full w-6 h-6',
            isToday && 'bg-primary text-primary-foreground',
          )}
        >
          {format(date, 'd')}
        </span>
        {onAddEvent && inMonth && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onAddEvent(date);
            }}
            className="opacity-0 group-hover:opacity-100 transition-opacity"
            title="Ajouter un événement"
          >
            <Plus className="h-3 w-3 text-muted-foreground hover:text-primary" />
          </button>
        )}
      </div>
      <div className="mt-1 space-y-0.5">
        {events.slice(0, compact ? 2 : 3).map((e) => (
          <button
            key={e.id}
            onClick={(ev) => {
              ev.stopPropagation();
              onSelectEvent?.(e);
            }}
            className="w-full text-left text-[10px] px-1.5 py-0.5 rounded truncate text-white"
            style={{ backgroundColor: e.color || KIND_COLORS[e.kind] }}
            title={e.title}
          >
            {e.title}
          </button>
        ))}
        {events.length > (compact ? 2 : 3) && (
          <Badge variant="secondary" className="text-[9px] h-4">
            +{events.length - (compact ? 2 : 3)}
          </Badge>
        )}
      </div>
    </div>
  );
}
