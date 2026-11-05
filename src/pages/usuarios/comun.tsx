import { Chip } from '@/components/ui/Chip';
import { MOTIVOS_RECHAZO, type EstadoPoliza, type Retroactivo } from '@/datos/cuentas';
import { haceCuanto } from '@/lib/formato';

export const NOMBRE_ESTADO: Record<EstadoPoliza, string> = {
  sin_poliza: 'Sin póliza',
  pendiente: 'Pendiente',
  verificada: 'Verificada',
  rechazada: 'Rechazada',
};

const TONO_ESTADO = { sin_poliza: 'neutral', pendiente: 'warning', verificada: 'success', rechazada: 'danger' } as const;

export function EstadoPolizaChip({ estado }: { estado: EstadoPoliza }) {
  return (
    <Chip tone={TONO_ESTADO[estado]} dot>
      {NOMBRE_ESTADO[estado]}
    </Chip>
  );
}

export function motivoRechazo(codigo: string | null): string | null {
  return codigo ? (MOTIVOS_RECHAZO[codigo] ?? codigo) : null;
}

export function RetroactivoChip({ r }: { r: Retroactivo }) {
  if (!r) return null;
  if (r === 'aplicado') return <Chip tone="success">Retroactivo aplicado</Chip>;
  if (r === 'tolerado') return <Chip tone="primary">Retroactivo tolerado</Chip>;
  return <Chip tone="danger">Retroactivo denegado</Chip>;
}

/** Más de 3 días sin sync ya es para revisar. */
export function diasSinSync(iso: string | null, ahora = new Date()): number | null {
  if (!iso) return null;
  return Math.floor((ahora.getTime() - new Date(iso).getTime()) / 86400000);
}

export function UltimoSync({ iso }: { iso: string | null }) {
  if (!iso) return <span className="text-text-muted">Nunca</span>;
  const d = diasSinSync(iso) ?? 0;
  return <span className={d >= 3 ? 'font-semibold text-danger' : 'text-text'}>{haceCuanto(iso)}</span>;
}
