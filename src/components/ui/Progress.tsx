import { cx } from '@/lib/cx';
import { iniciales } from '@/lib/formato';

interface ProgressBarProps {
  value: number;
  max: number;
  label?: string;
  size?: 'sm' | 'md';
  className?: string;
}

/** Barra redondeada en azul rey sobre gris claro. */
export function ProgressBar({ value, max, label, size = 'md', className }: ProgressBarProps) {
  const pct = max > 0 ? Math.min(100, Math.max(0, (value / max) * 100)) : 0;
  return (
    <div
      role="progressbar"
      aria-valuemin={0}
      aria-valuemax={max}
      aria-valuenow={value}
      aria-label={label}
      className={cx('w-full overflow-hidden rounded-full bg-surface-muted', size === 'sm' ? 'h-1.5' : 'h-2.5', className)}
    >
      <div className="h-full rounded-full bg-primary transition-[width] duration-500" style={{ width: `${pct}%` }} />
    </div>
  );
}

const avatarColors = ['bg-primary', 'bg-secondary', 'bg-level-3', 'bg-primary-deep', 'bg-level-1'];

function hash(s: string): number {
  let h = 0;
  for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) | 0;
  return Math.abs(h);
}

interface AvatarProps {
  name: string;
  /** Lo que fija el color: el usuario_id, para que no cambie si cambia el nombre. */
  seed?: string;
  size?: 'sm' | 'md' | 'lg';
}

/** Iniciales en un círculo de color. Nunca foto ni ilustración. */
export function Avatar({ name, seed, size = 'md' }: AvatarProps) {
  const box = { sm: 'size-7 text-[11px]', md: 'size-9 text-[13px]', lg: 'size-12 text-base' }[size];
  const color = avatarColors[hash(seed ?? name) % avatarColors.length];
  return (
    <span
      aria-hidden
      className={cx('grid shrink-0 place-items-center rounded-full font-display font-semibold text-white', box, color)}
    >
      {iniciales(name) || '?'}
    </span>
  );
}

interface StepNumberProps {
  n: number;
  /** El último paso va en dorado, como "Recibes" en la web. */
  last?: boolean;
}

/** Paso numerado en círculo, como "Te mueves / Sumas / Recibes". */
export function StepNumber({ n, last }: StepNumberProps) {
  return (
    <span
      className={cx(
        'grid size-9 shrink-0 place-items-center rounded-full font-display text-[15px] font-bold',
        last ? 'bg-accent text-on-accent' : 'bg-primary-deep text-white',
      )}
    >
      {n}
    </span>
  );
}
