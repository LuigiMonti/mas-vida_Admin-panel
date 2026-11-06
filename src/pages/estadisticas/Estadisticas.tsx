import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router';
import { BadgeCheck, ChartColumn, Coins, Hourglass, Inbox, Ticket } from 'lucide-react';
import { Card, CardHeader, MetricCard } from '@/components/ui/Card';
import { FilterChip } from '@/components/ui/Chip';
import { LogoComercio } from '@/components/ui/Logo';
import { PageTitle } from '@/components/ui/PageTitle';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { DataTable, type Column } from '@/components/ui/Table';
import { NOMBRE_ORIGEN, obtenerEstadisticas, type EstadisticasCanje, type FilaEstadistica, type OrigenCupon, type Periodo } from '@/datos/cupones';
import { useConsulta } from '@/datos/useConsulta';
import { fechaCorta, numero, porcentaje } from '@/lib/formato';

const PERIODOS: Array<{ k: Periodo; label: string }> = [
  { k: '7', label: 'Últimos 7 días' },
  { k: '30', label: 'Últimos 30 días' },
  { k: 'season', label: 'Esta season' },
  { k: 'todo', label: 'Todo' },
];

/* ----------------------------------------------------------------- canjes por día */

/** Barras de una sola serie: canjes por día. Tooltip al pasar el mouse; la tabla de abajo es la vista accesible. */
function CanjesPorDia({ dias }: { dias: EstadisticasCanje['por_dia'] }) {
  const [activo, setActivo] = useState<number | null>(null);
  const max = Math.max(1, ...dias.map((d) => d.canjeados));
  // Una línea de guía en un número redondo.
  const guia = max <= 4 ? max : Math.ceil(max / 2 / 5) * 5 || max;
  const alto = 160;
  const cada = Math.max(1, Math.ceil(dias.length / 8));
  const d = activo !== null ? dias[activo] : null;

  return (
    <div>
      <div className="relative" style={{ height: alto + 28 }} onMouseLeave={() => setActivo(null)}>
        {/* Guía recesiva */}
        <div className="pointer-events-none absolute inset-x-0 border-t border-dashed border-border" style={{ top: alto - (guia / max) * alto }}>
          <span className="absolute -top-2.5 right-0 bg-surface pl-1 text-[11px] text-text-muted tabular-nums">{guia}</span>
        </div>
        <div className="absolute inset-x-0 border-t border-border" style={{ top: alto }} />
        <ol className="absolute inset-x-0 top-0 flex items-end gap-[2px]" style={{ height: alto }} aria-label="Canjes por día">
          {dias.map((x, i) => (
            <li
              key={x.fecha}
              className="flex h-full flex-1 cursor-default items-end"
              onMouseEnter={() => setActivo(i)}
              onFocus={() => setActivo(i)}
              tabIndex={0}
              aria-label={`${fechaCorta(x.fecha)}: ${x.canjeados} canjes`}
            >
              <span
                className={`block w-full rounded-t-[4px] transition-colors ${activo === i ? 'bg-primary-deep' : 'bg-primary'}`}
                style={{ height: x.canjeados ? Math.max(3, (x.canjeados / max) * alto) : 0 }}
              />
            </li>
          ))}
        </ol>
        <div className="absolute inset-x-0 flex" style={{ top: alto + 8 }}>
          {dias.map((x, i) => (
            <span key={x.fecha} className="flex-1 text-center text-[11px] whitespace-nowrap text-text-muted">
              {i % cada === 0 ? fechaCorta(x.fecha).split(' ').slice(1).join(' ') : ''}
            </span>
          ))}
        </div>
        {d && activo !== null && (
          <div
            className="pointer-events-none absolute z-10 -translate-x-1/2 rounded-inner bg-text px-3 py-2 text-[12.5px] whitespace-nowrap text-white shadow-pop"
            style={{ left: `${((activo + 0.5) / dias.length) * 100}%`, top: Math.max(0, alto - (d.canjeados / max) * alto - 52) }}
            role="status"
          >
            <div className="font-semibold">{fechaCorta(d.fecha)}</div>
            <div className="tabular-nums">{d.canjeados === 1 ? '1 canje' : `${d.canjeados} canjes`}</div>
          </div>
        )}
      </div>
    </div>
  );
}

/* ----------------------------------------------------------------- página */

export function Estadisticas() {
  const [periodo, setPeriodo] = useState<Periodo>('30');
  const est = useConsulta(() => obtenerEstadisticas(periodo), [periodo]);
  const ir = useNavigate();
  const e = est.datos;
  const maxPremio = useMemo(() => Math.max(1, ...(e?.premios ?? []).map((p) => p.canjeados)), [e]);

  const columnas: Column<FilaEstadistica>[] = [
    {
      key: 'premio',
      header: 'Premio',
      render: (p) => (
        <div className="flex items-center gap-3">
          <LogoComercio foto={p.logo} fondo={p.fondo} nombre={p.nombre} size="sm" />
          <div>
            <div className="font-semibold">{p.nombre}</div>
            <div className="text-[12px] text-text-muted">{p.categoria}</div>
          </div>
        </div>
      ),
    },
    {
      key: 'canjeados',
      header: 'Canjeados',
      render: (p) => (
        <div className="flex min-w-36 items-center gap-2.5">
          <span className="h-2.5 rounded-r-[4px] bg-primary" style={{ width: `${Math.max(4, (p.canjeados / maxPremio) * 100)}%` }} aria-hidden />
          <span className="font-display font-bold tabular-nums">{p.canjeados}</span>
        </div>
      ),
    },
    {
      key: 'origen',
      header: 'Comprados · ganados',
      render: (p) => (
        <span className="tabular-nums">
          {p.comprados} · {p.ganados}
        </span>
      ),
    },
    {
      key: 'uso',
      header: 'Usados',
      numeric: true,
      render: (p) => (
        <span className="tabular-nums">
          <strong>{p.usados}</strong> <span className="text-text-muted">· {porcentaje(p.usados, p.canjeados)}</span>
        </span>
      ),
    },
    { key: 'vencidos', header: 'Vencidos', numeric: true, render: (p) => <span className="tabular-nums">{p.vencidos}</span> },
    { key: 'activos', header: 'Activos', numeric: true, render: (p) => <span className="tabular-nums">{p.activos}</span> },
    { key: 'monedas', header: 'Monedas', numeric: true, render: (p) => <span className="font-semibold text-coin tabular-nums">{numero(p.monedas_gastadas)}</span> },
    {
      key: 'cupo',
      header: 'Cupo',
      numeric: true,
      render: (p) =>
        p.cupo ? (
          <span className={p.canjeados_total >= p.cupo ? 'font-semibold text-danger' : 'tabular-nums'} title={`${p.canjeados_total} de ${p.cupo} en total`}>
            {p.canjeados_total >= p.cupo ? 'Lleno' : `quedan ${p.cupo - p.canjeados_total}`}
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
  ];

  return (
    <>
      <PageTitle title="Estadísticas de" accent="canje" description="Cuánto se canjea cada premio, cuántos cupones se usan en el comercio y cuántos se dejan vencer." />
      <div className="mb-5 flex flex-wrap gap-2" role="group" aria-label="Periodo">
        {PERIODOS.map((p) => (
          <FilterChip key={p.k} selected={periodo === p.k} onClick={() => setPeriodo(p.k)}>
            {p.label}
          </FilterChip>
        ))}
      </div>

      {est.estado === 'error' ? (
        <Card>
          <ErrorState description={est.error} onRetry={est.recargar} />
        </Card>
      ) : !e ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[132px] animate-pulse rounded-card bg-surface shadow-card" />
          ))}
        </div>
      ) : e.totales.canjeados === 0 ? (
        <Card>
          <EmptyState icon={Inbox} title="No hubo canjes en este periodo" />
        </Card>
      ) : (
        <div className={est.estado === 'cargando' ? 'opacity-60 transition-opacity' : undefined}>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard variant="feature" label="Cupones canjeados" value={numero(e.totales.canjeados)} icon={Ticket} detail={`${e.totales.activos} siguen activos`} />
            <MetricCard label="Usados en el comercio" value={porcentaje(e.totales.usados, e.totales.canjeados)} icon={BadgeCheck} detail={`${numero(e.totales.usados)} cupones`} />
            <MetricCard label="Se dejaron vencer" value={porcentaje(e.totales.vencidos, e.totales.canjeados)} icon={Hourglass} detail={`${numero(e.totales.vencidos)} cupones`} />
            <MetricCard label="Monedas gastadas" value={numero(e.totales.monedas_gastadas)} icon={Coins} detail="Solo en la Tienda" />
          </div>

          <div className="mt-5 grid items-start gap-5 xl:grid-cols-[1fr_300px]">
            <Card>
              <CardHeader icon={ChartColumn} title="Canjes por día" description="Comprados en la Tienda y ganados (semanas patrocinadas y La Liga)." />
              <CanjesPorDia dias={e.por_dia} />
            </Card>
            <Card>
              <CardHeader title="De dónde salen" />
              <ul className="flex flex-col gap-2">
                {(Object.keys(e.por_origen) as OrigenCupon[]).map((o) => (
                  <li key={o} className="flex items-center justify-between rounded-inner bg-surface-muted px-4 py-2.5">
                    <span className="text-[13.5px]">{NOMBRE_ORIGEN[o]}</span>
                    <span className="tabular-nums">
                      <strong className="font-display">{numero(e.por_origen[o])}</strong>{' '}
                      <span className="text-[12px] text-text-muted">{porcentaje(e.por_origen[o], e.totales.canjeados)}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </Card>
          </div>

          <Card className="mt-5">
            <CardHeader title="Por premio" description="Del más canjeado al menos. Haz clic para ver sus cupones." />
            <DataTable columns={columnas} rows={e.premios} rowKey={(p) => String(p.premio_id)} onRowClick={(p) => ir(`/cupones?premio=${p.premio_id}`)} caption="Canjes por premio" />
          </Card>
        </div>
      )}
    </>
  );
}
