import { useEffect, useRef, type ReactNode } from 'react';
import { X } from 'lucide-react';

interface DialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  onClose: () => void;
  /** Bloquea cerrar con Esc mientras se guarda. */
  busy?: boolean;
  children: ReactNode;
  /** Botones de abajo. */
  footer?: ReactNode;
  width?: number;
}

/** Diálogo modal para formularios cortos. Usa <dialog> nativo. */
export function Dialog({ open, title, description, onClose, busy, children, footer, width = 480 }: DialogProps) {
  const ref = useRef<HTMLDialogElement>(null);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) d.showModal();
    else if (!open && d.open) d.close();
  }, [open]);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onClose();
      }}
      style={{ width: `min(${width}px, calc(100vw - 32px))` }}
      className="m-auto rounded-card bg-surface p-0 text-text shadow-pop backdrop:bg-primary-deep/40"
    >
      <div className="flex flex-col gap-5 p-6">
        <div className="flex items-start justify-between gap-4">
          <div>
            <h2 className="font-display text-lg leading-tight font-semibold">{title}</h2>
            {description && <div className="mt-1 text-text-muted">{description}</div>}
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={busy}
            aria-label="Cerrar"
            className="grid size-8 shrink-0 place-items-center rounded-full text-text-muted hover:bg-surface-muted"
          >
            <X size={18} />
          </button>
        </div>
        {children}
        {footer && <div className="flex flex-wrap justify-end gap-2">{footer}</div>}
      </div>
    </dialog>
  );
}
