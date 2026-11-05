import { useEffect, useState } from 'react';
import { Minus, Plus } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { FilterChip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { TextAreaField, TextField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/States';
import { agregarAjuste, HOY } from '@/datos/cuentas';
import { ErrorPanel } from '@/datos/red';
import { conSigno, fecha as fmtFecha } from '@/lib/formato';

const MOTIVOS_RAPIDOS: Record<'puntos' | 'monedas', string[]> = {
  puntos: ['Chequeo médico', 'Corrección: el sync no contó el día', 'Revertir un día mal acreditado', 'Ajuste del demo'],
  monedas: ['Corrección de un error', 'Compensación por un cupón que falló', 'Ajuste del demo'],
};

interface AjusteDialogProps {
  open: boolean;
  ledger: 'puntos' | 'monedas';
  usuario_id: string;
  onClose: () => void;
  onGuardado: (mensaje: string) => void;
}

/** Ajuste = una fila nueva con motivo. Nunca edita ni borra una fila existente. */
export function AjusteDialog({ open, ledger, usuario_id, onClose, onGuardado }: AjusteDialogProps) {
  const [signo, setSigno] = useState<1 | -1>(1);
  const [cantidad, setCantidad] = useState('');
  const [dia, setDia] = useState(HOY);
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<ErrorPanel>();
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (open) {
      setSigno(1);
      setCantidad('');
      setDia(HOY);
      setMotivo('');
      setError(undefined);
    }
  }, [open]);

  const n = Number(cantidad);
  const valor = Number.isFinite(n) ? signo * Math.trunc(Math.abs(n)) : 0;
  const unidad = ledger === 'puntos' ? 'pts' : 'monedas';

  const guardar = async () => {
    setGuardando(true);
    setError(undefined);
    try {
      await agregarAjuste(usuario_id, { ledger, cantidad: valor, fecha: dia, motivo });
      onGuardado(`Ajuste guardado: ${conSigno(valor)} ${unidad}.`);
      onClose();
    } catch (e) {
      setError(e instanceof ErrorPanel ? e : new ErrorPanel('No se pudo guardar el ajuste.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={guardando}
      title={ledger === 'puntos' ? 'Ajustar puntos' : 'Ajustar monedas'}
      description="Se agrega una fila nueva al ledger. Lo que ya está no se edita ni se borra."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando || valor === 0}>
            {guardando ? 'Guardando…' : 'Agregar fila'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <div className="flex gap-2" role="group" aria-label="Sumar o descontar">
          <FilterChip selected={signo === 1} onClick={() => setSigno(1)}>
            <Plus size={14} aria-hidden /> Sumar
          </FilterChip>
          <FilterChip selected={signo === -1} onClick={() => setSigno(-1)}>
            <Minus size={14} aria-hidden /> Descontar
          </FilterChip>
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField
            label={ledger === 'puntos' ? 'Puntos' : 'Monedas'}
            type="number"
            min={1}
            step={1}
            inputMode="numeric"
            value={cantidad}
            onChange={(e) => setCantidad(e.target.value)}
            error={error?.campos?.cantidad}
          />
          <TextField
            label={ledger === 'puntos' ? 'Día al que corresponde' : 'Fecha'}
            type="date"
            max={HOY}
            value={dia}
            onChange={(e) => setDia(e.target.value)}
            error={error?.campos?.fecha}
          />
        </div>
        <div>
          <TextAreaField
            label="Motivo"
            value={motivo}
            onChange={(e) => setMotivo(e.target.value)}
            placeholder="Qué pasó y por qué se ajusta"
            error={error?.campos?.motivo}
            hint="Queda en la fila y en la bitácora, con tu correo."
          />
          <div className="mt-2 flex flex-wrap gap-1.5">
            {MOTIVOS_RAPIDOS[ledger].map((m) => (
              <button
                key={m}
                type="button"
                onClick={() => setMotivo(m)}
                className="rounded-full bg-surface-muted px-2.5 py-1 text-[12px] font-semibold text-text-muted hover:bg-primary-tint hover:text-primary"
              >
                {m}
              </button>
            ))}
          </div>
        </div>
        {valor !== 0 && (
          <Alert tone="info">
            Fila nueva: <strong>{conSigno(valor)} {unidad}</strong>
            {ledger === 'puntos' ? ` el ${fmtFecha(dia)}` : ''}, tipo ajuste manual.
          </Alert>
        )}
        {error && !error.campos && <Alert tone="danger">{error.message}</Alert>}
      </div>
    </Dialog>
  );
}
