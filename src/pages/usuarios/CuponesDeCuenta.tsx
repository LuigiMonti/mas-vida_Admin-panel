import { useState } from 'react';
import { useNavigate } from 'react-router';
import { Inbox, Ticket } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { FilterChip } from '@/components/ui/Chip';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { DataTable } from '@/components/ui/Table';
import { listarCupones, NOMBRE_ESTADO_CUPON, type EstadoCupon } from '@/datos/cupones';
import { useConsulta } from '@/datos/useConsulta';
import { COLUMNAS_CUPON } from '../cupones/Cupones';

const ESTADOS: Array<EstadoCupon | 'todos'> = ['todos', 'activo', 'usado', 'expirado'];

/** Los cupones de una cuenta, por estado. */
export function CuponesDeCuenta({ usuario_id }: { usuario_id: string }) {
  const [estado, setEstado] = useState<EstadoCupon | 'todos'>('todos');
  const cupones = useConsulta(() => listarCupones({ usuario_id }), [usuario_id]);
  const ir = useNavigate();
  const todos = cupones.datos ?? [];
  const filas = estado === 'todos' ? todos : todos.filter((c) => c.estado === estado);
  return (
    <Card>
      <CardHeader icon={Ticket} title="Cupones de la cuenta" description="Comprados en la Tienda y ganados. Haz clic en uno para validarlo." />
      <div className="mb-5 flex flex-wrap gap-2">
        {ESTADOS.map((e) => (
          <FilterChip key={e} selected={estado === e} onClick={() => setEstado(e)} count={cupones.datos ? (e === 'todos' ? todos.length : todos.filter((c) => c.estado === e).length) : undefined}>
            {e === 'todos' ? 'Todos' : NOMBRE_ESTADO_CUPON[e]}
          </FilterChip>
        ))}
      </div>
      {cupones.estado === 'error' ? (
        <ErrorState description={cupones.error} onRetry={cupones.recargar} />
      ) : !cupones.datos ? (
        <div className="h-32 animate-pulse rounded-inner bg-surface-muted" />
      ) : (
        <DataTable
          columns={COLUMNAS_CUPON.filter((c) => c.key !== 'cuenta')}
          rows={filas}
          rowKey={(c) => c.codigo}
          onRowClick={(c) => ir(`/cupones?codigo=${encodeURIComponent(c.codigo)}`)}
          caption="Cupones de la cuenta"
          empty={<EmptyState icon={Inbox} title={estado === 'todos' ? 'Esta cuenta no tiene cupones' : 'No tiene cupones en este estado'} />}
        />
      )}
    </Card>
  );
}
