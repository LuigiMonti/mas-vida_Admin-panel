import type { ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from '@/lib/cx';

interface CardProps {
  /** `feature`: azul marino con texto blanco. Solo para resúmenes del dashboard. */
  variant?: 'default' | 'feature';
  className?: string;
  children: ReactNode;
}

export function Card({ variant = 'default', className, children }: CardProps) {
  return (
    <section
      className={cx(
        'rounded-card p-6',
        variant === 'feature' ? 'bg-primary-deep text-white' : 'bg-surface text-text shadow-card',
        className,
      )}
    >
      {children}
    </section>
  );
}

interface CardHeaderProps {
  title: string;
  description?: ReactNode;
  action?: ReactNode;
  icon?: LucideIcon;
}

export function CardHeader({ title, description, action, icon }: CardHeaderProps) {
  return (
    <header className="mb-5 flex flex-wrap items-start justify-between gap-3">
      <div className="flex items-center gap-3">
        {icon && <IconCircle icon={icon} />}
        <div>
          <h2 className="font-display text-[17px] leading-tight font-semibold tracking-tight">{title}</h2>
          {description && <p className="mt-0.5 text-[13px] text-text-muted">{description}</p>}
        </div>
      </div>
      {action}
    </header>
  );
}

interface IconCircleProps {
  icon: LucideIcon;
  size?: 'sm' | 'md' | 'lg';
  /** `inverse`: sobre una card azul marino. */
  inverse?: boolean;
}

/** Ícono de línea dentro de un círculo azul claro, como Pasos y Actividad física en la web. */
export function IconCircle({ icon: Icon, size = 'md', inverse }: IconCircleProps) {
  const box = { sm: 'size-8', md: 'size-9', lg: 'size-11' }[size];
  const px = { sm: 16, md: 18, lg: 22 }[size];
  return (
    <span
      className={cx(
        'grid shrink-0 place-items-center rounded-full',
        box,
        inverse ? 'bg-white/12 text-white' : 'bg-primary-tint text-primary',
      )}
    >
      <Icon size={px} strokeWidth={2} aria-hidden />
    </span>
  );
}

interface MetricCardProps {
  label: string;
  value: string;
  icon: LucideIcon;
  /** Línea de contexto debajo del número: "+12 esta semana". */
  detail?: ReactNode;
  variant?: 'default' | 'feature';
}

/** Card de métrica del dashboard: número grande en bold. */
export function MetricCard({ label, value, icon, detail, variant = 'default' }: MetricCardProps) {
  const feature = variant === 'feature';
  return (
    <Card variant={variant} className="flex flex-col gap-4 p-5">
      <div className="flex items-center justify-between gap-2">
        <span className={cx('text-[13px] font-semibold', feature ? 'text-white/75' : 'text-text-muted')}>{label}</span>
        <IconCircle icon={icon} size="sm" inverse={feature} />
      </div>
      <div>
        <div className="font-display text-[32px] leading-none font-bold tracking-tight tabular-nums">{value}</div>
        {detail && <div className={cx('mt-2 text-[12.5px]', feature ? 'text-white/75' : 'text-text-muted')}>{detail}</div>}
      </div>
    </Card>
  );
}
