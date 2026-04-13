import { cn } from '@/lib/utils';

const SCORE_LABELS = ['', 'Insufficient', 'Passable', 'Good', 'Excellent'];
const SCORE_COLORS = [
  '',
  'bg-destructive/10 text-destructive border-destructive/30 hover:bg-destructive/20',
  'bg-warning/10 text-warning border-warning/30 hover:bg-warning/20',
  'bg-success/10 text-success border-success/30 hover:bg-success/20',
  'bg-primary/10 text-primary border-primary/30 hover:bg-primary/20',
];
const SCORE_ACTIVE = [
  '',
  'bg-destructive text-destructive-foreground border-destructive',
  'bg-warning text-warning-foreground border-warning',
  'bg-success text-success-foreground border-success',
  'bg-primary text-primary-foreground border-primary',
];

interface ScoreButtonProps {
  value: number;
  selected: boolean;
  onClick: () => void;
}

export function ScoreButton({ value, selected, onClick }: ScoreButtonProps) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        'flex flex-col items-center justify-center rounded-lg border px-3 py-2 text-xs font-medium transition-all min-w-[80px]',
        selected ? SCORE_ACTIVE[value] : SCORE_COLORS[value],
        selected && 'ring-2 ring-offset-1 ring-offset-background shadow-sm',
        !selected && 'opacity-70'
      )}
    >
      <span className="text-lg font-bold">{value}</span>
      <span className="text-[10px] mt-0.5">{SCORE_LABELS[value]}</span>
    </button>
  );
}
