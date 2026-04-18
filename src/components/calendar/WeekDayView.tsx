import { useMemo, useRef, useEffect } from 'react';
import {
  startOfWeek,
  addDays,
  format,
  isSameDay,
  parseISO,
  differenceInMinutes,
  startOfDay,
} from 'date-fns';
import { fr } from 'date-fns/locale';
import { useDroppable } from '@dnd-kit/core';
import { cn } from '@/lib/utils';
import type { CalendarEvent } from '@/hooks/useCalendar';
import { KIND_COLORS } from '@/hooks/useCalendar';

interface Props {
  cursor: Date;
  view: 'week' | 'day';
  events: CalendarEvent[];
  onSelectEvent?: (e: CalendarEvent) => void;
  onSelectSlot?: (date: Date) => void;
  droppable?: boolean;
}

const HOUR_HEIGHT = 48; // px per hour
const HOURS = Array.from({ length: 24 }, (_, i) => i);

export function WeekDayView({ cursor, view, events, onSelectEvent, onSelectSlot, droppable }: Props) {
  const days = useMemo(() => {
    if (view === 'day') return [cursor];
    const start = startOfWeek(cursor, { weekStartsOn: 1 });
    return Array.from({ length: 7 }, (_, i) => addDays(start, i));
  }, [cursor, view]);

  const scrollRef = useRef<HTMLDivElement>(null);
  // Auto-scroll to 8:00 on mount
  useEffect(() => {
    if (scrollRef.current) scrollRef.current.scrollTop = 8 * HOUR_HEIGHT - 20;
  }, []);

  return (
    <div className="flex flex-col h-[600px] border-t">
      {/* Header with day names */}
      <div className={cn('grid border-b bg-muted/30', view === 'day' ? 'grid-cols-[60px_1fr]' : 'grid-cols-[60px_repeat(7,1fr)]')}>
        <div />
        {days.map((d) => {
          const isToday = isSameDay(d, new Date());
          return (
            <div key={d.toISOString()} className="text-center py-2 border-l">
              <div className="text-[10px] uppercase text-muted-foreground font-semibold">
                {format(d, 'EEE', { locale: fr })}
              </div>
              <div
                className={cn(
                  'text-sm font-semibold inline-flex items-center justify-center w-7 h-7 rounded-full mt-0.5',
                  isToday && 'bg-primary text-primary-foreground',
                )}
              >
                {format(d, 'd')}
              </div>
            </div>
          );
        })}
      </div>

      {/* Scrollable grid */}
      <div ref={scrollRef} className="flex-1 overflow-y-auto">
        <div className={cn('grid relative', view === 'day' ? 'grid-cols-[60px_1fr]' : 'grid-cols-[60px_repeat(7,1fr)]')}>
          {/* Hour gutter */}
          <div className="border-r">
            {HOURS.map((h) => (
              <div key={h} style={{ height: HOUR_HEIGHT }} className="text-[10px] text-muted-foreground text-right pr-1 -mt-2">
                {h > 0 ? `${String(h).padStart(2, '0')}:00` : ''}
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((d) => (
            <DayColumn
              key={d.toISOString()}
              date={d}
              events={events.filter((e) => isSameDay(parseISO(e.start_at), d))}
              onSelectEvent={onSelectEvent}
              onSelectSlot={onSelectSlot}
              droppable={droppable}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

interface DayColumnProps {
  date: Date;
  events: CalendarEvent[];
  onSelectEvent?: (e: CalendarEvent) => void;
  onSelectSlot?: (date: Date) => void;
  droppable?: boolean;
}

function DayColumn({ date, events, onSelectEvent, onSelectSlot, droppable }: DayColumnProps) {
  const id = `cal-day-${format(date, 'yyyy-MM-dd')}`;
  const { setNodeRef, isOver } = useDroppable({
    id,
    data: { date: format(date, 'yyyy-MM-dd') },
    disabled: !droppable,
  });

  const handleClick = (e: React.MouseEvent<HTMLDivElement>) => {
    if (!onSelectSlot) return;
    const rect = e.currentTarget.getBoundingClientRect();
    const y = e.clientY - rect.top;
    const minutes = Math.floor((y / HOUR_HEIGHT) * 60);
    const slot = new Date(date);
    slot.setHours(0, 0, 0, 0);
    slot.setMinutes(Math.max(0, Math.round(minutes / 15) * 15));
    onSelectSlot(slot);
  };

  return (
    <div
      ref={setNodeRef}
      onClick={handleClick}
      className={cn('relative border-l cursor-pointer', isOver && 'bg-primary/10')}
      style={{ height: HOUR_HEIGHT * 24 }}
    >
      {/* Hour grid lines */}
      {HOURS.map((h) => (
        <div key={h} style={{ top: h * HOUR_HEIGHT, height: HOUR_HEIGHT }} className="absolute inset-x-0 border-b border-border/40" />
      ))}

      {/* Events */}
      {events.map((ev) => {
        const start = parseISO(ev.start_at);
        const end = parseISO(ev.end_at);
        const top = (differenceInMinutes(start, startOfDay(start)) / 60) * HOUR_HEIGHT;
        const height = Math.max(20, (differenceInMinutes(end, start) / 60) * HOUR_HEIGHT);
        return (
          <button
            key={ev.id}
            onClick={(e) => {
              e.stopPropagation();
              onSelectEvent?.(ev);
            }}
            className="absolute left-1 right-1 rounded px-1.5 py-0.5 text-[10px] text-white text-left overflow-hidden shadow-sm hover:shadow-md transition-shadow"
            style={{ top, height, backgroundColor: ev.color || KIND_COLORS[ev.kind] }}
            title={ev.title}
          >
            <div className="font-semibold truncate">{ev.title}</div>
            <div className="opacity-90 text-[9px]">
              {format(start, 'HH:mm')} – {format(end, 'HH:mm')}
            </div>
          </button>
        );
      })}
    </div>
  );
}
