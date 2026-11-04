import type { ReactNode } from 'react';
import { CircleAlert, CircleCheck, Info, TriangleAlert, type LucideIcon } from 'lucide-react';
import { cx } from '@/lib/cx';

interface EmptyStateProps {
  icon: LucideIcon;
  title: string;
  description?: string;
  action?: ReactNode;
}

/** Estado vacío: un ícono lucide y un texto corto. Nada de ilustraciones. */
export function EmptyState({ icon: Icon, title, description, action }: EmptyStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-primary-tint text-primary">
        <Icon size={22} aria-hidden />
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        {description && <p className="mt-0.5 text-[13px] text-text-muted">{description}</p>}
      </div>
      {action}
    </div>
  );
}

interface ErrorStateProps {
  title?: string;
  description: string;
  onRetry?: () => void;
}

/** Algo falló al cargar. */
export function ErrorState({ title = 'No se pudo cargar', description, onRetry }: ErrorStateProps) {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-10 text-center">
      <span className="grid size-12 place-items-center rounded-full bg-danger-tint text-danger">
        <CircleAlert size={22} aria-hidden />
      </span>
      <div>
        <p className="font-semibold">{title}</p>
        <p className="mt-0.5 text-[13px] text-text-muted">{description}</p>
      </div>
      {onRetry && (
        <button
          type="button"
          onClick={onRetry}
          className="h-8 rounded-full border border-primary-soft px-3.5 text-[13px] font-semibold text-primary hover:bg-primary-tint"
        >
          Reintentar
        </button>
      )}
    </div>
  );
}

type AlertTone = 'info' | 'success' | 'warning' | 'danger';

const alertTone: Record<AlertTone, { box: string; icon: LucideIcon }> = {
  info: { box: 'bg-primary-tint text-primary', icon: Info },
  success: { box: 'bg-success-tint text-success', icon: CircleCheck },
  warning: { box: 'bg-warning-tint text-warning', icon: TriangleAlert },
  danger: { box: 'bg-danger-tint text-danger', icon: CircleAlert },
};

/** Aviso en línea: "No se puede editar: la semana ya empezó". */
export function Alert({ tone = 'info', children, className }: { tone?: AlertTone; children: ReactNode; className?: string }) {
  const t = alertTone[tone];
  const Icon = t.icon;
  return (
    <div role={tone === 'danger' ? 'alert' : 'status'} className={cx('flex items-start gap-2.5 rounded-inner px-4 py-3 text-[13.5px] font-medium', t.box, className)}>
      <Icon size={17} className="mt-px shrink-0" aria-hidden />
      <div>{children}</div>
    </div>
  );
}
