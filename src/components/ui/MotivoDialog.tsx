import { useEffect, useState, type ReactNode } from 'react';
import { Button } from './Button';
import { Dialog } from './Dialog';
import { TextAreaField } from './Field';
import { Alert } from './States';
import { ErrorPanel } from '@/datos/red';

interface MotivoDialogProps {
  open: boolean;
  title: string;
  description?: ReactNode;
  /** Lo que va antes del motivo: otros campos, o el detalle de lo que va a pasar. */
  children?: ReactNode;
  confirmLabel: string;
  /** Botón rojo: para lo que no se deshace. */
  peligro?: boolean;
  /** Hay que escribir este texto para confirmar (lo que no se deshace). */
  escribir?: string;
  /** Botones con motivos frecuentes. */
  sugerencias?: string[];
  /** Si falta algo más que el motivo (otro campo), el botón queda apagado. */
  bloqueado?: boolean;
  onClose: () => void;
  /** Rechaza con un ErrorPanel para mostrar el error aquí mismo. */
  onConfirm: (motivo: string) => Promise<void>;
  /** Errores de los otros campos, para que quien llama los pinte. */
  onError?: (e: ErrorPanel | undefined) => void;
}

/**
 * Una acción que pide motivo: queda en la bitácora con quien la hizo.
 * Para las que no se deshacen, además hay que escribir un texto.
 */
export function MotivoDialog({ open, title, description, children, confirmLabel, peligro, escribir, sugerencias, bloqueado, onClose, onConfirm, onError }: MotivoDialogProps) {
  const [motivo, setMotivo] = useState('');
  const [escrito, setEscrito] = useState('');
  const [error, setError] = useState<ErrorPanel>();
  const [ocupado, setOcupado] = useState(false);

  useEffect(() => {
    if (open) {
      setMotivo('');
      setEscrito('');
      setError(undefined);
      setOcupado(false);
    }
  }, [open]);

  const falta = motivo.trim().length < 5 || (escribir !== undefined && escrito.trim() !== escribir) || bloqueado;

  const confirmar = async () => {
    setOcupado(true);
    setError(undefined);
    onError?.(undefined);
    try {
      await onConfirm(motivo.trim());
      onClose();
    } catch (e) {
      const err = e instanceof ErrorPanel ? e : new ErrorPanel('No se pudo completar.');
      setError(err);
      onError?.(err);
    } finally {
      setOcupado(false);
    }
  };

  // Un error que no es del motivo ni de un campo de quien llama se muestra entero.
  const general = error && !error.campos?.motivo && (!error.campos || !onError) ? error.message : undefined;

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={ocupado}
      title={title}
      description={description}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={ocupado}>
            Cancelar
          </Button>
          {peligro ? (
            <button
              type="button"
              disabled={falta || ocupado}
              onClick={confirmar}
              className="h-10 rounded-full bg-danger px-5 text-sm font-semibold text-white hover:brightness-90 disabled:cursor-not-allowed disabled:bg-border disabled:text-text-muted"
            >
              {ocupado ? 'Un momento…' : confirmLabel}
            </button>
          ) : (
            <Button onClick={confirmar} disabled={falta || ocupado}>
              {ocupado ? 'Un momento…' : confirmLabel}
            </Button>
          )}
        </>
      }
    >
      <div className="flex flex-col gap-4">
        {children}
        <div>
          <TextAreaField
            label="Motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Qué pasó y por qué se hace"
            error={error?.campos?.motivo}
            hint="Queda en la bitácora, con tu correo."
          />
          {sugerencias && (
            <div className="mt-2 flex flex-wrap gap-1.5">
              {sugerencias.map((s) => (
                <button key={s} type="button" onClick={() => setMotivo(s)} className="rounded-full bg-surface-muted px-2.5 py-1 text-[12px] font-semibold text-text-muted hover:bg-primary-tint hover:text-primary">
                  {s}
                </button>
              ))}
            </div>
          )}
        </div>
        {escribir !== undefined && (
          <label className="flex flex-col gap-1.5 text-[13px] font-semibold">
            <span>
              Escribe <code className="rounded bg-surface-muted px-1.5 py-0.5 font-mono">{escribir}</code> para confirmar
            </span>
            <input value={escrito} onChange={(e) => setEscrito(e.target.value)} className="h-10 rounded-field border border-border bg-surface px-3 font-mono text-sm outline-none focus:border-danger" />
          </label>
        )}
        {general && <Alert tone="danger">{general}</Alert>}
      </div>
    </Dialog>
  );
}
