import { useEffect, useRef, useState, type ReactNode } from 'react';
import { TriangleAlert } from 'lucide-react';

interface ConfirmDialogProps {
  open: boolean;
  title: string;
  body: ReactNode;
  confirmLabel: string;
  typeToConfirm?: string;
  onCancel: () => void;
  onConfirm: () => void | Promise<void>;
}

/** Confirmación de una acción destructiva. Usa <dialog> nativo: foco, Esc y fondo vienen del navegador. */
export function ConfirmDialog({ open, title, body, confirmLabel, typeToConfirm, onCancel, onConfirm }: ConfirmDialogProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const [typed, setTyped] = useState('');
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (open && !d.open) {
      setTyped('');
      d.showModal();
    } else if (!open && d.open) d.close();
  }, [open]);

  const blocked = busy || (typeToConfirm !== undefined && typed.trim() !== typeToConfirm);

  return (
    <dialog
      ref={ref}
      onCancel={(e) => {
        e.preventDefault();
        if (!busy) onCancel();
      }}
      className="m-auto w-[min(440px,calc(100vw-32px))] rounded-card bg-surface p-0 text-text shadow-pop backdrop:bg-primary-deep/40"
    >
      <div className="flex flex-col gap-4 p-6">
        <div className="flex items-start gap-3">
          <span className="grid size-10 shrink-0 place-items-center rounded-full bg-danger-tint text-danger">
            <TriangleAlert size={20} aria-hidden />
          </span>
          <div className="flex flex-col gap-1 pt-1">
            <h2 className="font-display text-lg leading-tight font-semibold">{title}</h2>
            <div className="text-text-muted">{body}</div>
          </div>
        </div>
        {typeToConfirm !== undefined && (
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            <span>
              Escribe <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono">{typeToConfirm}</code> para confirmar
            </span>
            <input
              autoFocus
              value={typed}
              onChange={(e) => setTyped(e.target.value)}
              className="h-10 rounded-field border border-border bg-surface px-3 font-mono text-sm outline-none focus:border-danger"
            />
          </label>
        )}
        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            onClick={onCancel}
            disabled={busy}
            className="h-10 rounded-full border border-primary-soft px-5 text-sm font-semibold text-primary hover:bg-primary-tint"
          >
            Cancelar
          </button>
          <button
            type="button"
            disabled={blocked}
            onClick={async () => {
              setBusy(true);
              try {
                await onConfirm();
              } finally {
                setBusy(false);
              }
            }}
            className="h-10 rounded-full bg-danger px-5 text-sm font-semibold text-white hover:brightness-90 disabled:cursor-not-allowed disabled:bg-border disabled:text-text-muted"
          >
            {busy ? 'Un momento…' : confirmLabel}
          </button>
        </div>
      </div>
    </dialog>
  );
}
