import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from '@/lib/cx';

export type ChipTone = 'primary' | 'neutral' | 'success' | 'danger' | 'warning' | 'coin';

const tones: Record<ChipTone, string> = {
  primary: 'bg-primary-tint text-primary',
  neutral: 'bg-surface-muted text-text-muted',
  success: 'bg-success-tint text-success',
  danger: 'bg-danger-tint text-danger',
  warning: 'bg-warning-tint text-warning',
  coin: 'bg-coin-tint text-coin',
};

interface ChipProps {
  tone?: ChipTone;
  icon?: LucideIcon;
  /** Punto de color a la izquierda, para estados ("Verificada"). */
  dot?: boolean;
  children: ReactNode;
  className?: string;
}

/** Badge pastilla para estados y etiquetas. */
export function Chip({ tone = 'primary', icon: Icon, dot, children, className }: ChipProps) {
  return (
    <span
      className={cx(
        'inline-flex items-center gap-1.5 rounded-full px-2.5 py-0.5 text-[12px] font-semibold whitespace-nowrap',
        tones[tone],
        className,
      )}
    >
      {dot && <span className="size-1.5 rounded-full bg-current" aria-hidden />}
      {Icon && <Icon size={13} strokeWidth={2.25} aria-hidden />}
      {children}
    </span>
  );
}

interface FilterChipProps {
  selected: boolean;
  onClick: () => void;
  count?: number;
  children: ReactNode;
}

/** Chip de filtro: seleccionado se ve azul claro con texto azul. */
export function FilterChip({ selected, onClick, count, children }: FilterChipProps) {
  return (
    <button
      type="button"
      aria-pressed={selected}
      onClick={onClick}
      className={cx(
        'inline-flex h-8 items-center gap-1.5 rounded-full border px-3.5 text-[13px] font-semibold transition-colors',
        selected
          ? 'border-transparent bg-primary-tint-strong text-primary'
          : 'border-border bg-surface text-text-muted hover:border-primary-soft hover:text-primary',
      )}
    >
      {children}
      {count !== undefined && (
        <span className={cx('tabular-nums', selected ? 'text-primary' : 'text-text-muted/80')}>{count}</span>
      )}
    </button>
  );
}
