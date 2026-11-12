import { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { SearchX, Users } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Chip, FilterChip } from '@/components/ui/Chip';
import { SearchInput } from '@/components/ui/Field';
import { LevelBadge } from '@/components/ui/Niveles';
import { PageTitle } from '@/components/ui/PageTitle';
import { Avatar } from '@/components/ui/Progress';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { DataTable, type Column } from '@/components/ui/Table';
import { contarPorEstado, listarUsuarios, type EstadoPoliza, type FilaUsuario } from '@/datos/cuentas';
import { useConsulta } from '@/datos/useConsulta';
import { numero } from '@/lib/formato';
import { EstadoPolizaChip, motivoRechazo, NOMBRE_ESTADO, UltimoSync } from './comun';

const FILTROS: Array<EstadoPoliza | 'todos'> = ['todos', 'pendiente', 'verificada', 'rechazada', 'sin_poliza'];

const COLUMNAS: Column<FilaUsuario>[] = [
  {
    key: 'usuario',
    header: 'Usuario',
    render: (u) => (
      <div className="flex items-center gap-2.5">
        <Avatar name={u.nombre} seed={u.usuario_id} size="sm" />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{u.nombre}</span>
            {u.dado_de_baja ? <Chip tone="danger">Baja</Chip> : !u.is_active ? <Chip tone="neutral">Desactivada</Chip> : null}
          </div>
          <div className="truncate text-[12px] text-text-muted">{u.dado_de_baja ? u.usuario_id : u.correo}</div>
        </div>
      </div>
    ),
  },
  {
    key: 'miembro',
    header: 'Nombre de miembro',
    render: (u) => (u.nombre_de_miembro ? <span className="font-mono text-[12.5px]">{u.nombre_de_miembro}</span> : <span className="text-[12.5px] text-text-muted">Sin elegir</span>),
  },
  { key: 'poliza', header: 'Póliza', render: (u) => <span className="font-mono text-[12.5px]">{u.policy_number ?? '—'}</span> },
  {
    key: 'estado',
    header: 'Estado',
    render: (u) => (
      <div className="flex flex-col items-start gap-1">
        <EstadoPolizaChip estado={u.estado_poliza} />
        {u.estado_poliza === 'rechazada' && <span className="text-[12px] text-text-muted">{motivoRechazo(u.motivo_rechazo)}</span>}
      </div>
    ),
  },
  { key: 'nivel', header: 'Nivel', render: (u) => <LevelBadge nivel={u.nivel} /> },
  { key: 'puntos', header: 'Puntos del año', numeric: true, render: (u) => <span className="font-semibold">{numero(u.puntos_anio)}</span> },
  { key: 'monedas', header: 'Monedas', numeric: true, render: (u) => <span className="font-semibold text-coin">{numero(u.saldo_monedas)}</span> },
  { key: 'sync', header: 'Último sync', align: 'right', render: (u) => <UltimoSync iso={u.ultimo_sync} /> },
];

export function ListaUsuarios() {
  const [params, setParams] = useSearchParams();
  const q = params.get('q') ?? '';
  const estado = (params.get('estado') as EstadoPoliza | 'todos' | null) ?? 'todos';
  const [texto, setTexto] = useState(q);
  const ir = useNavigate();

  useEffect(() => setTexto(q), [q]);

  // Busca mientras se escribe, con una pausa corta.
  useEffect(() => {
    const t = setTimeout(() => {
      if (texto === q) return;
      const p = new URLSearchParams(params);
      if (texto) p.set('q', texto);
      else p.delete('q');
      setParams(p, { replace: true });
    }, 250);
    return () => clearTimeout(t);
  }, [texto, q, params, setParams]);

  const usuarios = useConsulta(() => listarUsuarios({ q, estado }), [q, estado]);
  const conteo = useConsulta(contarPorEstado);

  const elegir = (e: EstadoPoliza | 'todos') => {
    const p = new URLSearchParams(params);
    if (e === 'todos') p.delete('estado');
    else p.set('estado', e);
    setParams(p, { replace: true });
  };

  return (
    <>
      <PageTitle title="Usuarios" description="Busca una cuenta para ver su póliza, sus puntos, sus monedas y su sync, y para atenderla: cerrar sus sesiones, desactivarla o darla de baja." />
      <Card>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTROS.map((f) => (
              <FilterChip key={f} selected={estado === f} onClick={() => elegir(f)} count={conteo.datos?.[f]}>
                {f === 'todos' ? 'Todos' : NOMBRE_ESTADO[f]}
              </FilterChip>
            ))}
          </div>
          <SearchInput
            value={texto}
            onChange={(e) => setTexto(e.target.value)}
            placeholder="Nombre, correo, nombre de miembro o póliza"
            className="w-full sm:w-72"
            aria-label="Buscar usuario"
          />
        </div>

        {usuarios.estado === 'error' ? (
          <ErrorState description={usuarios.error} onRetry={usuarios.recargar} />
        ) : !usuarios.datos ? (
          <div className="flex flex-col gap-2" aria-busy>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-inner bg-surface-muted" />
            ))}
          </div>
        ) : (
          <div className={usuarios.estado === 'cargando' ? 'opacity-60 transition-opacity' : undefined}>
            <DataTable
              columns={COLUMNAS}
              rows={usuarios.datos}
              rowKey={(u) => u.usuario_id}
              onRowClick={(u) => ir(`/usuarios/${u.usuario_id}`)}
              caption="Usuarios"
              empty={
                q ? (
                  <EmptyState icon={SearchX} title="No hay cuentas con esa búsqueda" description="Prueba con el correo, el nombre de miembro, el usuario_id o el número de póliza." />
                ) : (
                  <EmptyState icon={Users} title="No hay cuentas en este estado" />
                )
              }
            />
          </div>
        )}
      </Card>
    </>
  );
}
