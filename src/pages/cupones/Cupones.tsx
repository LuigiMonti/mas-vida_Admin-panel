import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { CheckCheck, Inbox, ScanLine, Search, SearchX, Ticket, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip, FilterChip, type ChipTone } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { SearchInput } from '@/components/ui/Field';
import { LogoComercio } from '@/components/ui/Logo';
import { PageTitle } from '@/components/ui/PageTitle';
import { Alert, EmptyState, ErrorState } from '@/components/ui/States';
import { DataTable, type Column } from '@/components/ui/Table';
import {
  buscarCupon,
  listarCupones,
  marcarUsado,
  NOMBRE_ESTADO_CUPON,
  NOMBRE_ORIGEN,
  normalizarCodigo,
  type Cupon,
  type EstadoCupon,
  type OrigenCupon,
} from '@/datos/cupones';
import { obtenerPremio } from '@/datos/premios';
import { ErrorPanel, hoyGT } from '@/datos/red';
import { puede } from '@/datos/sesion';
import { useConsulta } from '@/datos/useConsulta';
import { fecha, fechaHora } from '@/lib/formato';

export const TONO_CUPON: Record<EstadoCupon, ChipTone> = { activo: 'success', usado: 'primary', expirado: 'neutral' };

export function EstadoCuponChip({ estado }: { estado: EstadoCupon }) {
  return (
    <Chip tone={TONO_CUPON[estado]} dot>
      {NOMBRE_ESTADO_CUPON[estado]}
    </Chip>
  );
}

function diasPara(f: string): number {
  return Math.round((new Date(`${f}T12:00:00Z`).getTime() - new Date(`${hoyGT()}T12:00:00Z`).getTime()) / 86400000);
}

/* ----------------------------------------------------------------- resultado de la búsqueda */

function FichaCupon({ c, onUsado, onCerrar }: { c: Cupon; onUsado: (c: Cupon) => void; onCerrar: () => void }) {
  const [confirmar, setConfirmar] = useState(false);
  const [error, setError] = useState<string>();
  const [marcando, setMarcando] = useState(false);
  const dias = diasPara(c.fecha_expiracion_cupon);

  const marcar = async () => {
    setMarcando(true);
    setError(undefined);
    try {
      onUsado(await marcarUsado(c.codigo));
      setConfirmar(false);
    } catch (e) {
      setError(e instanceof ErrorPanel ? e.message : 'No se pudo marcar.');
      setConfirmar(false);
    } finally {
      setMarcando(false);
    }
  };

  return (
    <div className="rounded-inner border border-border p-5">
      <div className="flex flex-wrap items-start gap-4">
        <LogoComercio foto={c.logo} fondo={c.fondo} nombre={c.comercio} size="lg" />
        <div className="min-w-0 flex-1">
          <div className="font-display text-xl leading-tight font-bold">{c.beneficio}</div>
          <div className="text-[13px] font-semibold text-secondary">{c.comercio}</div>
          <div className="mt-2 flex flex-wrap items-center gap-2">
            <span className="rounded-full bg-surface-muted px-3 py-1 font-mono text-[13px] font-semibold tracking-wider">{c.codigo}</span>
            <EstadoCuponChip estado={c.estado} />
            <Chip tone={c.origen === 'tienda' ? 'coin' : 'primary'}>{c.origen === 'tienda' ? `Tienda · ${c.costo_monedas} monedas` : c.ganado_en}</Chip>
          </div>
        </div>
        <button type="button" onClick={onCerrar} aria-label="Cerrar" className="grid size-8 place-items-center rounded-full text-text-muted hover:bg-surface-muted">
          <X size={17} />
        </button>
      </div>
      <dl className="mt-4 grid gap-3 text-[13.5px] sm:grid-cols-4">
        <div>
          <dt className="text-[12px] font-semibold text-text-muted">Cuenta</dt>
          <dd>
            <Link to={`/usuarios/${c.usuario_id}?tab=cupones`} className="font-mono font-semibold text-primary hover:underline">
              {c.usuario_id}
            </Link>
          </dd>
        </div>
        <div>
          <dt className="text-[12px] font-semibold text-text-muted">Canjeado</dt>
          <dd>{fechaHora(c.fecha_canje)}</dd>
        </div>
        <div>
          <dt className="text-[12px] font-semibold text-text-muted">Vence</dt>
          <dd>
            {fecha(c.fecha_expiracion_cupon)}
            {c.estado === 'activo' && <span className={dias <= 3 ? ' font-semibold text-warning' : ' text-text-muted'}> · {dias === 0 ? 'hoy' : `en ${dias} días`}</span>}
          </dd>
        </div>
        <div>
          <dt className="text-[12px] font-semibold text-text-muted">Usado</dt>
          <dd>{c.usado_en ? `${fechaHora(c.usado_en)}${c.usado_por ? ` · ${c.usado_por}` : ''}` : '—'}</dd>
        </div>
      </dl>
      <div className="mt-4">
        {c.estado === 'activo' ? (
          puede('marcar_cupon') ? (
            <Button icon={CheckCheck} onClick={() => setConfirmar(true)} disabled={marcando}>
              Marcar como usado
            </Button>
          ) : (
            <Alert tone="info">Tu rol no puede marcar cupones.</Alert>
          )
        ) : c.estado === 'usado' ? (
          <Alert tone="warning">Este cupón ya se usó. Si el comercio lo vuelve a pedir, no lo aceptes.</Alert>
        ) : (
          <Alert tone="warning">Este cupón venció el {fecha(c.fecha_expiracion_cupon)}. No se puede usar.</Alert>
        )}
        {error && (
          <Alert tone="danger" className="mt-3">
            {error}
          </Alert>
        )}
      </div>
      <Dialog
        open={confirmar}
        onClose={() => setConfirmar(false)}
        busy={marcando}
        title="¿Marcar como usado?"
        description={`${c.beneficio} en ${c.comercio}. Después ya no se puede volver a usar.`}
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmar(false)} disabled={marcando}>
              Cancelar
            </Button>
            <Button icon={CheckCheck} onClick={marcar} disabled={marcando}>
              {marcando ? 'Marcando…' : 'Sí, se usó'}
            </Button>
          </>
        }
      >
        <div className="rounded-inner bg-surface-muted px-4 py-3 text-center font-mono text-lg font-bold tracking-wider">{c.codigo}</div>
      </Dialog>
    </div>
  );
}

/* ----------------------------------------------------------------- lista */

const ESTADOS: Array<EstadoCupon | 'todos'> = ['todos', 'activo', 'usado', 'expirado'];
const ORIGENES: Array<OrigenCupon | 'todos'> = ['todos', 'tienda', 'semana', 'liga'];

export const COLUMNAS_CUPON: Column<Cupon>[] = [
  {
    key: 'cupon',
    header: 'Cupón',
    render: (c) => (
      <div className="flex items-center gap-3">
        <LogoComercio foto={c.logo} fondo={c.fondo} nombre={c.comercio} size="sm" />
        <div className="min-w-0">
          <div className="truncate font-semibold">{c.beneficio}</div>
          <div className="text-[12px] text-text-muted">{c.comercio}</div>
        </div>
      </div>
    ),
  },
  { key: 'codigo', header: 'Código', render: (c) => <span className="font-mono text-[12.5px] font-semibold whitespace-nowrap">{c.codigo}</span> },
  { key: 'origen', header: 'Origen', render: (c) => <span className="text-[13px] whitespace-nowrap">{c.origen === 'tienda' ? `Tienda · ${c.costo_monedas}` : c.ganado_en}</span> },
  { key: 'cuenta', header: 'Cuenta', render: (c) => <span className="font-mono text-[12.5px]">{c.usuario_id}</span> },
  { key: 'canje', header: 'Canjeado', render: (c) => <span className="whitespace-nowrap">{fecha(c.fecha_canje)}</span> },
  { key: 'estado', header: 'Estado', align: 'right', render: (c) => <EstadoCuponChip estado={c.estado} /> },
];

export function Cupones() {
  const [params, setParams] = useSearchParams();
  const premioId = params.get('premio') ? Number(params.get('premio')) : undefined;
  const [codigo, setCodigo] = useState('');
  const [encontrado, setEncontrado] = useState<Cupon>();
  const [errorBusqueda, setErrorBusqueda] = useState<string>();
  const [buscando, setBuscando] = useState(false);
  const [estado, setEstado] = useState<EstadoCupon | 'todos'>('todos');
  const [origen, setOrigen] = useState<OrigenCupon | 'todos'>('todos');
  const [q, setQ] = useState('');
  const [vuelta, setVuelta] = useState(0);
  const lista = useConsulta(() => listarCupones({ q, estado, origen, premio_id: premioId }), [q, estado, origen, premioId, vuelta]);
  const premio = useConsulta(() => (premioId ? obtenerPremio(premioId) : Promise.resolve(null)), [premioId]).datos;

  // Llega desde la ficha de una cuenta con ?codigo=…
  const codigoUrl = params.get('codigo');
  useEffect(() => {
    if (codigoUrl) {
      setCodigo(codigoUrl);
      void buscar(codigoUrl);
    }
  }, [codigoUrl]);

  const buscar = async (cod = codigo) => {
    if (!cod.trim()) return;
    setBuscando(true);
    setErrorBusqueda(undefined);
    setEncontrado(undefined);
    try {
      setEncontrado(await buscarCupon(cod));
    } catch (e) {
      setErrorBusqueda(e instanceof ErrorPanel ? e.message : 'No se pudo buscar.');
    } finally {
      setBuscando(false);
    }
  };

  return (
    <>
      <PageTitle title="Cupones" description="Cuando un comercio pide validar un cupón: busca el código y márcalo como usado. Cada cupón dura 21 días." />

      <Card className="mb-5">
        <CardHeader icon={ScanLine} title="Validar un cupón" description="El código que muestra la persona en la caja, como MV-OK41-7XQ2." />
        <form
          className="flex flex-wrap gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            void buscar();
          }}
        >
          <input
            value={codigo}
            onChange={(e) => setCodigo(e.target.value)}
            onBlur={() => codigo && setCodigo(normalizarCodigo(codigo))}
            placeholder="MV-XXXX-XXXX"
            aria-label="Código del cupón"
            autoComplete="off"
            spellCheck={false}
            className="h-12 min-w-0 flex-1 rounded-full border border-border bg-surface px-5 font-mono text-lg font-semibold tracking-wider uppercase outline-none placeholder:font-normal placeholder:tracking-normal placeholder:text-text-muted/60 focus:border-primary focus:ring-3 focus:ring-primary-tint-strong"
          />
          <Button type="submit" icon={Search} className="h-12 px-6" disabled={buscando || !codigo.trim()}>
            {buscando ? 'Buscando…' : 'Buscar'}
          </Button>
        </form>
        {errorBusqueda && (
          <Alert tone="danger" className="mt-4">
            {errorBusqueda}
          </Alert>
        )}
        {encontrado && (
          <div className="mt-4">
            <FichaCupon
              c={encontrado}
              onCerrar={() => setEncontrado(undefined)}
              onUsado={(c) => {
                setEncontrado(c);
                setVuelta((v) => v + 1);
              }}
            />
          </div>
        )}
      </Card>

      <Card>
        <CardHeader
          icon={Ticket}
          title={premio ? `Cupones de ${premio.nombre}` : 'Todos los cupones'}
          action={
            premio ? (
              <Button size="sm" variant="ghost" icon={X} onClick={() => setParams({}, { replace: true })}>
                Quitar filtro
              </Button>
            ) : undefined
          }
        />
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {ESTADOS.map((e) => (
              <FilterChip key={e} selected={estado === e} onClick={() => setEstado(e)}>
                {e === 'todos' ? 'Todos' : NOMBRE_ESTADO_CUPON[e]}
              </FilterChip>
            ))}
            <span className="mx-1 w-px self-stretch bg-border" aria-hidden />
            {ORIGENES.map((o) => (
              <FilterChip key={o} selected={origen === o} onClick={() => setOrigen(o)}>
                {o === 'todos' ? 'Cualquier origen' : NOMBRE_ORIGEN[o]}
              </FilterChip>
            ))}
          </div>
          <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Código, comercio o usuario_id" className="w-full sm:w-64" aria-label="Buscar cupón" />
        </div>
        {lista.estado === 'error' ? (
          <ErrorState description={lista.error} onRetry={lista.recargar} />
        ) : !lista.datos ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-inner bg-surface-muted" />
            ))}
          </div>
        ) : (
          <>
            <DataTable
              columns={COLUMNAS_CUPON}
              rows={lista.datos.slice(0, 60)}
              rowKey={(c) => c.codigo}
              selectedKey={encontrado?.codigo}
              onRowClick={(c) => {
                setCodigo(c.codigo);
                void buscar(c.codigo);
                window.scrollTo({ top: 0, behavior: 'smooth' });
              }}
              caption="Cupones"
              empty={q ? <EmptyState icon={SearchX} title="No hay cupones con esa búsqueda" /> : <EmptyState icon={Inbox} title="No hay cupones con esos filtros" />}
            />
            {lista.datos.length > 60 && <p className="mt-3 text-[12.5px] text-text-muted">Se muestran los 60 más recientes de {lista.datos.length}. Usa los filtros o el buscador.</p>}
          </>
        )}
      </Card>
    </>
  );
}
