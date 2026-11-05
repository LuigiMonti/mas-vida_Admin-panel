import { useState, type ButtonHTMLAttributes, type ReactNode } from 'react';
import type { LucideIcon } from 'lucide-react';
import { cx } from '@/lib/cx';
import { ConfirmDialog } from './ConfirmDialog';

type Variant = 'primary' | 'secondary' | 'ghost' | 'danger';
type Size = 'sm' | 'md';

const variants: Record<Variant, string> = {
  primary: 'bg-primary text-white hover:bg-primary-deep disabled:bg-border disabled:text-text-muted',
  secondary:
    'bg-surface text-primary border border-primary-soft hover:bg-primary-tint disabled:text-text-muted disabled:border-border',
  ghost: 'text-primary hover:bg-primary-tint disabled:text-text-muted',
  danger: 'bg-danger text-white hover:brightness-90 disabled:bg-border disabled:text-text-muted',
};

const sizes: Record<Size, string> = {
  sm: 'h-8 px-3.5 text-[13px] gap-1.5',
  md: 'h-10 px-5 text-sm gap-2',
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Exclude<Variant, 'danger'>;
  size?: Size;
  icon?: LucideIcon;
}

/** Botón pastilla. Para acciones destructivas usa <DangerButton>, que siempre confirma. */
export function Button({ variant = 'primary', size = 'md', icon: Icon, className, children, ...rest }: ButtonProps) {
  return (
    <button
      type="button"
      className={cx(
        'inline-flex shrink-0 items-center justify-center rounded-full font-semibold whitespace-nowrap transition-colors disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className,
      )}
      {...rest}
    >
      {Icon && <Icon size={size === 'sm' ? 15 : 17} strokeWidth={2} aria-hidden />}
      {children}
    </button>
  );
}

export interface DangerButtonProps extends Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'onClick'> {
  size?: Size;
  icon?: LucideIcon;
  /** Título del diálogo, en pregunta: "¿Cerrar todas las sesiones?" */
  confirmTitle: string;
  /** Qué pasa exactamente, en una o dos frases. */
  confirmBody: ReactNode;
  /** Texto del botón que confirma: "Cerrar sesiones". */
  confirmLabel: string;
  /** Pide escribir este texto antes de confirmar (p. ej. el usuario_id). */
  typeToConfirm?: string;
  onConfirm: () => void | Promise<void>;
}

/** Botón rojo. Nunca ejecuta directo: abre una confirmación. */
export function DangerButton({
  size = 'md',
  icon: Icon,
  className,
  children,
  confirmTitle,
  confirmBody,
  confirmLabel,
  typeToConfirm,
  onConfirm,
  ...rest
}: DangerButtonProps) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        className={cx(
          'inline-flex shrink-0 items-center justify-center rounded-full font-semibold whitespace-nowrap transition disabled:cursor-not-allowed',
          variants.danger,
          sizes[size],
          className,
        )}
        onClick={() => setOpen(true)}
        {...rest}
      >
        {Icon && <Icon size={size === 'sm' ? 15 : 17} strokeWidth={2} aria-hidden />}
        {children}
      </button>
      <ConfirmDialog
        open={open}
        title={confirmTitle}
        body={confirmBody}
        confirmLabel={confirmLabel}
        typeToConfirm={typeToConfirm}
        onCancel={() => setOpen(false)}
        onConfirm={async () => {
          await onConfirm();
          setOpen(false);
        }}
      />
    </>
  );
}
