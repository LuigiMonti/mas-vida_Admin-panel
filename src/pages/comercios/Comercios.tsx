import { useEffect, useState } from 'react';
import { Link } from 'react-router';
import { Mail, Pencil, Phone, SearchX, Store } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip, FilterChip, type ChipTone } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { SearchInput, TextAreaField, TextField } from '@/components/ui/Field';
import { LogoComercio } from '@/components/ui/Logo';
import { PageTitle } from '@/components/ui/PageTitle';
import { Alert, EmptyState, ErrorState } from '@/components/ui/States';
import { DataTable, type Column } from '@/components/ui/Table';
import { guardarComercio, listarComercios, NOMBRE_ESTADO_CONTRATO, type Comercio, type DatosComercio, type EstadoContrato } from '@/datos/comercios';
import { ErrorPanel } from '@/datos/red';
import { puede } from '@/datos/sesion';
import { useConsulta } from '@/datos/useConsulta';
import { fecha, quetzales } from '@/lib/formato';

const TONO_CONTRATO: Record<EstadoContrato, ChipTone> = { sin_contrato: 'neutral', por_empezar: 'primary', vigente: 'success', por_vencer: 'warning', vencido: 'danger' };

type Filtro = 'todos' | EstadoContrato;
const FILTROS: Filtro[] = ['todos', 'vigente', 'por_vencer', 'vencido', 'sin_contrato'];

const sinDato = <span className="text-text-muted">—</span>;

/* ----------------------------------------------------------------- editar la ficha */

function EditarFicha({ c, onClose, onGuardado }: { c: Comercio | null; onClose: () => void; onGuardado: (m: string) => void }) {
  const [d, setD] = useState<DatosComercio | null>(null);
  const [cuota, setCuota] = useState('');
  const [error, setError] = useState<ErrorPanel>();
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (c) {
      setD({ contacto_nombre: c.contacto_nombre, contacto_telefono: c.contacto_telefono, contacto_correo: c.contacto_correo, contrato_desde: c.contrato_desde, contrato_hasta: c.contrato_hasta, cuota_mensual_gtq: c.cuota_mensual_gtq, notas: c.notas });
      setCuota(c.cuota_mensual_gtq ?? '');
      setError(undefined);
    }
  }, [c]);

  if (!c || !d) return null;
  const e = error?.campos ?? {};
  const set = (x: Partial<DatosComercio>) => setD((v) => (v ? { ...v, ...x } : v));

  const guardar = async () => {
    setGuardando(true);
    setError(undefined);
    try {
      await guardarComercio(c.id, { ...d, cuota_mensual_gtq: cuota.trim() === '' ? null : cuota.trim() });
      onGuardado(`Ficha de ${c.nombre} guardada.`);
      onClose();
    } catch (x) {
      setError(x instanceof ErrorPanel ? x : new ErrorPanel('No se pudo guardar.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog
      open
      onClose={onClose}
      busy={guardando}
      width={560}
      title={`Ficha de ${c.nombre}`}
      description="Interna: la app nunca la muestra. El nombre y el logo se cambian en sus premios."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={guardar} disabled={guardando}>
            {guardando ? 'Guardando…' : 'Guardar'}
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-4">
        <TextField label="Persona de contacto" value={d.contacto_nombre} onChange={(x) => set({ contacto_nombre: x.target.value })} error={e.contacto_nombre} />
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Teléfono" type="tel" value={d.contacto_telefono} onChange={(x) => set({ contacto_telefono: x.target.value })} error={e.contacto_telefono} />
          <TextField label="Correo" type="email" value={d.contacto_correo} onChange={(x) => set({ contacto_correo: x.target.value })} error={e.contacto_correo} />
        </div>
        <div className="grid gap-4 sm:grid-cols-2">
          <TextField label="Contrato desde" type="date" value={d.contrato_desde ?? ''} onChange={(x) => set({ contrato_desde: x.target.value || null })} error={e.contrato_desde} />
          <TextField label="Contrato hasta" type="date" value={d.contrato_hasta ?? ''} onChange={(x) => set({ contrato_hasta: x.target.value || null })} error={e.contrato_hasta} hint="Vacío: sin fecha de fin." />
        </div>
        <TextField
          label="Cuota mensual (Q)"
          inputMode="decimal"
          value={cuota}
          onChange={(x) => setCuota(x.target.value)}
          error={e.cuota_mensual_gtq}
          placeholder="1500.00"
          hint="Vacío: no paga cuota (solo da el beneficio)."
        />
        <TextAreaField label="Notas" value={d.notas} onChange={(x) => set({ notas: x.target.value })} error={e.notas} placeholder="Lo acordado, pendientes, quién lleva la relación" />
        {error && !error.campos && <Alert tone="danger">{error.message}</Alert>}
      </div>
    </Dialog>
  );
}

/* ----------------------------------------------------------------- página */

export function Comercios() {
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [vuelta, setVuelta] = useState(0);
  const [editando, setEditando] = useState<Comercio | null>(null);
  const [aviso, setAviso] = useState<string>();
  const comercios = useConsulta(() => listarComercios({ q }), [q, vuelta]);
  const editar = puede('editar_comercios');
  const todos = comercios.datos ?? [];
  const filas = filtro === 'todos' ? todos : todos.filter((c) => c.estado_contrato === filtro);

  const columnas: Column<Comercio>[] = [
    {
      key: 'comercio',
      header: 'Comercio',
      render: (c) => (
        <div className="flex items-center gap-2.5">
          <LogoComercio foto={c.logo} fondo={c.fondo} nombre={c.nombre} size="sm" />
          <div>
            <div className="font-semibold">{c.nombre}</div>
            <Link to={`/premios?q=${encodeURIComponent(c.nombre)}`} className="text-[12px] text-text-muted hover:text-primary hover:underline" onClick={(e) => e.stopPropagation()}>
              {c.premios_activos} de {c.premios} {c.premios === 1 ? 'premio activo' : 'premios activos'}
              {c.patrocinios_vigentes > 0 ? ` · ${c.patrocinios_vigentes} ${c.patrocinios_vigentes === 1 ? 'patrocinio' : 'patrocinios'}` : ''}
            </Link>
          </div>
        </div>
      ),
    },
    {
      key: 'contacto',
      header: 'Contacto',
      render: (c) =>
        c.contacto_nombre || c.contacto_telefono || c.contacto_correo ? (
          <div className="text-[13px]">
            <div className="font-medium">{c.contacto_nombre || '—'}</div>
            <div className="flex flex-wrap gap-x-3 text-[12px] text-text-muted">
              {c.contacto_telefono && (
                <span className="inline-flex items-center gap-1">
                  <Phone size={12} aria-hidden /> {c.contacto_telefono}
                </span>
              )}
              {c.contacto_correo && (
                <span className="inline-flex items-center gap-1">
                  <Mail size={12} aria-hidden /> {c.contacto_correo}
                </span>
              )}
            </div>
          </div>
        ) : (
          <span className="text-[13px] text-text-muted">Sin contacto</span>
        ),
    },
    {
      key: 'contrato',
      header: 'Contrato',
      render: (c) => (
        <div className="flex flex-col items-start gap-1">
          <Chip tone={TONO_CONTRATO[c.estado_contrato]} dot>
            {NOMBRE_ESTADO_CONTRATO[c.estado_contrato]}
          </Chip>
          {c.contrato_desde && (
            <span className="text-[12px] whitespace-nowrap text-text-muted">
              {fecha(c.contrato_desde)} – {c.contrato_hasta ? fecha(c.contrato_hasta) : 'sin fin'}
            </span>
          )}
        </div>
      ),
    },
    { key: 'cuota', header: 'Cuota al mes', numeric: true, render: (c) => (c.cuota_mensual_gtq ? <span className="font-display font-bold">{quetzales(c.cuota_mensual_gtq)}</span> : sinDato) },
    {
      key: 'accion',
      header: '',
      align: 'right',
      render: (c) =>
        editar ? (
          <Button size="sm" variant="ghost" icon={Pencil} onClick={() => setEditando(c)}>
            Editar
          </Button>
        ) : null,
    },
  ];

  const cuotaTotal = todos.filter((c) => c.estado_contrato === 'vigente' || c.estado_contrato === 'por_vencer').reduce((s, c) => s + Number(c.cuota_mensual_gtq ?? 0), 0);

  return (
    <>
      <PageTitle
        title="Comercios"
        accent="aliados"
        description="La ficha de cada marca: a quién llamar, hasta cuándo va su contrato y cuánto paga al mes. Sus premios y patrocinios se manejan en sus pantallas."
      />
      {aviso && (
        <Alert tone="success" className="mb-5">
          {aviso}
        </Alert>
      )}
      <Card>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {FILTROS.map((f) => (
              <FilterChip key={f} selected={filtro === f} onClick={() => setFiltro(f)} count={comercios.datos ? (f === 'todos' ? todos.length : todos.filter((c) => c.estado_contrato === f).length) : undefined}>
                {f === 'todos' ? 'Todos' : NOMBRE_ESTADO_CONTRATO[f]}
              </FilterChip>
            ))}
          </div>
          <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Comercio o persona de contacto" className="w-full sm:w-72" aria-label="Buscar comercio" />
        </div>
        {comercios.estado === 'error' ? (
          <ErrorState description={comercios.error} onRetry={comercios.recargar} />
        ) : !comercios.datos ? (
          <div className="flex flex-col gap-2" aria-busy>
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-inner bg-surface-muted" />
            ))}
          </div>
        ) : (
          <>
            <DataTable
              columns={columnas}
              rows={filas}
              rowKey={(c) => String(c.id)}
              caption="Comercios aliados"
              empty={q ? <EmptyState icon={SearchX} title="No hay comercios con esa búsqueda" /> : <EmptyState icon={Store} title="No hay comercios en este estado" />}
            />
            {cuotaTotal > 0 && (
              <p className="mt-4 text-right text-[13px] text-text-muted">
                Cuotas de los contratos vigentes: <strong className="text-text">{quetzales(cuotaTotal)}</strong> al mes
              </p>
            )}
          </>
        )}
      </Card>
      {!editar && comercios.datos && (
        <Alert tone="info" className="mt-5">
          Tu rol solo puede ver las fichas de los comercios.
        </Alert>
      )}
      <EditarFicha
        c={editando}
        onClose={() => setEditando(null)}
        onGuardado={(m) => {
          setAviso(m);
          setVuelta((v) => v + 1);
        }}
      />
    </>
  );
}
