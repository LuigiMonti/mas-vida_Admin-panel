import { useEffect, useState } from 'react';
import { CalendarCheck, Footprints, Lock, Pencil, Plus, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/Field';
import { PageTitle } from '@/components/ui/PageTitle';
import { Alert, ErrorState } from '@/components/ui/States';
import { DataTable, type Column } from '@/components/ui/Table';
import {
  guardarMetasPorEdad,
  guardarObjetivo,
  listarMetasPorEdad,
  obtenerSeason,
  type EstadoSemana,
  type MetaPasosPorEdad,
  type SemanaDeSeason,
} from '@/datos/objetivos';
import { ErrorPanel } from '@/datos/red';
import { puede } from '@/datos/sesion';
import { useConsulta } from '@/datos/useConsulta';
import { fecha, fechaCorta, numero, porcentaje } from '@/lib/formato';

const ESTADO: Record<EstadoSemana, { label: string; tone: ChipTone }> = {
  cerrada: { label: 'Cerrada', tone: 'neutral' },
  pendiente_cierre: { label: 'Sin cerrar', tone: 'danger' },
  en_revision: { label: 'En revisión', tone: 'warning' },
  en_curso: { label: 'En curso', tone: 'primary' },
  futura: { label: 'Definida', tone: 'success' },
  sin_crear: { label: 'Sin definir', tone: 'neutral' },
};

const editable = (s: SemanaDeSeason) => s.estado === 'futura' || s.estado === 'sin_crear';

/* ----------------------------------------------------------------- editar semana */

function EditarSemana({ s, hayMas, onClose, onGuardado }: { s: SemanaDeSeason | null; hayMas: boolean; onClose: () => void; onGuardado: (m: string) => void }) {
  const base = s ? (s.objetivo ?? s.heredado) : null;
  const [v, setV] = useState({ meta_workouts: '', monedas_pasos: '', monedas_workouts: '', meta_pasos: '' });
  const [enAdelante, setEnAdelante] = useState(false);
  const [error, setError] = useState<ErrorPanel>();
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (base) {
      setV({
        meta_workouts: String(base.meta_workouts),
        monedas_pasos: String(base.monedas_pasos),
        monedas_workouts: String(base.monedas_workouts),
        meta_pasos: String(base.meta_pasos),
      });
      setEnAdelante(false);
      setError(undefined);
    }
  }, [s?.fecha_inicio]);

  if (!s) return null;
  const nuevo = s.objetivo === null;

  const guardar = async () => {
    setGuardando(true);
    setError(undefined);
    try {
      const n = await guardarObjetivo(
        s.fecha_inicio,
        { meta_workouts: Number(v.meta_workouts), monedas_pasos: Number(v.monedas_pasos), monedas_workouts: Number(v.monedas_workouts), meta_pasos: Number(v.meta_pasos) },
        enAdelante,
      );
      onGuardado(n > 1 ? `Guardado en la semana ${s.numero} y las ${n - 1} siguientes.` : `Semana ${s.numero} guardada.`);
      onClose();
    } catch (e) {
      setError(e instanceof ErrorPanel ? e : new ErrorPanel('No se pudo guardar.'));
    } finally {
      setGuardando(false);
    }
  };

  const campo = (k: keyof typeof v, label: string, hint?: string) => (
    <TextField label={label} type="number" min={0} step={1} inputMode="numeric" value={v[k]} onChange={(e) => setV({ ...v, [k]: e.target.value })} error={error?.campos?.[k]} hint={hint} />
  );

  return (
    <Dialog
      open
      onClose={onClose}
      busy={guardando}
      title={`${nuevo ? 'Definir' : 'Editar'} semana ${s.numero}`}
      description={`Del lunes ${fecha(s.fecha_inicio)} al domingo ${fecha(s.fecha_fin)}.${nuevo ? ' Arranca con los valores de la semana anterior.' : ''}`}
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
        <div className="grid gap-4 sm:grid-cols-2">
          {campo('meta_workouts', 'Meta de workouts', 'En la semana.')}
          {campo('meta_pasos', 'Meta de pasos (respaldo)', 'Solo si la tabla por edad está vacía.')}
          {campo('monedas_pasos', 'Monedas por cumplir pasos')}
          {campo('monedas_workouts', 'Monedas por cumplir workouts')}
        </div>
        {hayMas && (
          <label className="flex items-start gap-2.5 rounded-inner bg-surface-muted px-4 py-3 text-[13.5px]">
            <input type="checkbox" checked={enAdelante} onChange={(e) => setEnAdelante(e.target.checked)} className="mt-0.5 size-4 accent-[var(--color-primary)]" />
            <span>
              <strong>Aplicar también a las semanas siguientes</strong> que ya están definidas. Las que no están definidas lo heredan solas.
            </span>
          </label>
        )}
        {error && !error.campos && <Alert tone="danger">{error.message}</Alert>}
      </div>
    </Dialog>
  );
}

/* ----------------------------------------------------------------- metas por edad */

function MetasPorEdad() {
  const metas = useConsulta(listarMetasPorEdad);
  const [filas, setFilas] = useState<Array<{ edad_desde: string; meta_pasos: string }>>([]);
  const [error, setError] = useState<ErrorPanel>();
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string>();
  const admin = puede('editar_objetivo');

  const reiniciar = (d: MetaPasosPorEdad[]) => setFilas(d.map((m) => ({ edad_desde: String(m.edad_desde), meta_pasos: String(m.meta_pasos) })));
  useEffect(() => {
    if (metas.datos) reiniciar(metas.datos);
  }, [metas.datos]);

  const cambiado = metas.datos && JSON.stringify(filas) !== JSON.stringify(metas.datos.map((m) => ({ edad_desde: String(m.edad_desde), meta_pasos: String(m.meta_pasos) })));

  const guardar = async () => {
    setGuardando(true);
    setError(undefined);
    try {
      await guardarMetasPorEdad(filas.map((f) => ({ edad_desde: Number(f.edad_desde), meta_pasos: Number(f.meta_pasos) })));
      setAviso('Metas guardadas.');
      metas.recargar();
    } catch (e) {
      setError(e instanceof ErrorPanel ? e : new ErrorPanel('No se pudo guardar.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card>
      <CardHeader icon={Footprints} title="Meta de pasos por edad" description="La meta semanal de cada persona según su edad del lunes. Cada fila vale hasta la siguiente." />
      {metas.estado === 'error' ? (
        <ErrorState description={metas.error} onRetry={metas.recargar} />
      ) : !metas.datos ? (
        <div className="h-40 animate-pulse rounded-inner bg-surface-muted" />
      ) : (
        <div className="flex flex-col gap-3">
          <Alert tone="warning">Vale para toda semana que todavía no se cierra, incluida la que está en curso.</Alert>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,1.3fr)_auto] items-center gap-x-3 gap-y-2">
            <span className="text-[12px] font-semibold text-text-muted">Desde (años)</span>
            <span className="text-[12px] font-semibold text-text-muted">Pasos por semana</span>
            <span />
            {filas.map((f, i) => {
              const sig = filas[i + 1];
              return (
                <div key={i} className="contents">
                  {admin ? (
                    <>
                      <input
                        aria-label={`Edad desde, fila ${i + 1}`}
                        type="number"
                        value={f.edad_desde}
                        onChange={(e) => setFilas(filas.map((x, j) => (j === i ? { ...x, edad_desde: e.target.value } : x)))}
                        className={`h-9 w-full min-w-0 rounded-field border bg-surface px-3 text-sm tabular-nums outline-none focus:border-primary ${error?.campos?.[`edad_${i}`] ? 'border-danger' : 'border-border'}`}
                      />
                      <input
                        aria-label={`Meta de pasos, fila ${i + 1}`}
                        type="number"
                        step={500}
                        value={f.meta_pasos}
                        onChange={(e) => setFilas(filas.map((x, j) => (j === i ? { ...x, meta_pasos: e.target.value } : x)))}
                        className={`h-9 w-full min-w-0 rounded-field border bg-surface px-3 text-sm tabular-nums outline-none focus:border-primary ${error?.campos?.[`meta_${i}`] ? 'border-danger' : 'border-border'}`}
                      />
                      <button
                        type="button"
                        aria-label={`Quitar fila ${i + 1}`}
                        onClick={() => setFilas(filas.filter((_, j) => j !== i))}
                        className="grid size-9 place-items-center rounded-full text-text-muted hover:bg-danger-tint hover:text-danger"
                      >
                        <Trash2 size={16} />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="tabular-nums">
                        {f.edad_desde}
                        {sig ? `–${Number(sig.edad_desde) - 1}` : '+'}
                      </span>
                      <span className="font-display font-bold tabular-nums">{numero(Number(f.meta_pasos))}</span>
                      <span />
                    </>
                  )}
                </div>
              );
            })}
          </div>
          {error && <Alert tone="danger">{error.campos?.tabla ?? error.message}</Alert>}
          {aviso && !cambiado && <Alert tone="success">{aviso}</Alert>}
          {admin && (
            <div className="flex flex-wrap justify-between gap-2">
              <Button size="sm" variant="ghost" icon={Plus} onClick={() => setFilas([...filas, { edad_desde: '', meta_pasos: '' }])}>
                Agregar fila
              </Button>
              <div className="flex gap-2">
                {cambiado && (
                  <Button size="sm" variant="secondary" onClick={() => metas.datos && reiniciar(metas.datos)}>
                    Descartar
                  </Button>
                )}
                <Button size="sm" disabled={!cambiado || guardando} onClick={guardar}>
                  {guardando ? 'Guardando…' : 'Guardar metas'}
                </Button>
              </div>
            </div>
          )}
        </div>
      )}
    </Card>
  );
}

/* ----------------------------------------------------------------- página */

export function Objetivos() {
  const season = useConsulta(obtenerSeason);
  const [editando, setEditando] = useState<SemanaDeSeason | null>(null);
  const [aviso, setAviso] = useState<string>();
  const admin = puede('editar_objetivo');

  const columnas: Column<SemanaDeSeason>[] = [
    {
      key: 'semana',
      header: 'Semana',
      render: (s) => (
        <div>
          <div className="font-semibold">
            Semana {s.numero} <span className="font-normal text-text-muted">· ISO {s.iso}</span>
          </div>
          <div className="text-[12px] text-text-muted">
            {fechaCorta(s.fecha_inicio)} – {fechaCorta(s.fecha_fin)}
          </div>
        </div>
      ),
    },
    { key: 'estado', header: 'Estado', render: (s) => <Chip tone={ESTADO[s.estado].tone} dot>{ESTADO[s.estado].label}</Chip> },
    {
      key: 'workouts',
      header: 'Workouts',
      numeric: true,
      render: (s) => (s.objetivo ? <span className="font-semibold">{s.objetivo.meta_workouts}</span> : <span className="text-text-muted">{s.heredado?.meta_workouts ?? '—'}*</span>),
    },
    {
      key: 'monedas',
      header: 'Monedas (pasos + workouts)',
      numeric: true,
      render: (s) => {
        const o = s.objetivo ?? s.heredado;
        if (!o) return <span className="text-text-muted">—</span>;
        return (
          <span className={s.objetivo ? 'font-semibold text-coin' : 'text-text-muted'}>
            {o.monedas_pasos} + {o.monedas_workouts}
            {!s.objetivo && '*'}
          </span>
        );
      },
    },
    {
      key: 'resultado',
      header: 'Completaron',
      numeric: true,
      render: (s) =>
        s.resultado ? (
          <span title={`Pasos ${s.resultado.cumplieron_pasos} · Workouts ${s.resultado.cumplieron_workouts}`}>
            <strong>{s.resultado.completaron}</strong> <span className="text-text-muted">de {s.resultado.evaluados} · {porcentaje(s.resultado.completaron, s.resultado.evaluados)}</span>
          </span>
        ) : (
          <span className="text-text-muted">—</span>
        ),
    },
    {
      key: 'accion',
      header: '',
      align: 'right',
      render: (s) =>
        editable(s) && admin ? (
          <Button size="sm" variant={s.objetivo ? 'secondary' : 'primary'} icon={s.objetivo ? Pencil : Plus} onClick={() => setEditando(s)}>
            {s.objetivo ? 'Editar' : 'Definir'}
          </Button>
        ) : !editable(s) ? (
          <span className="inline-flex items-center gap-1 text-[12px] text-text-muted" title="No se puede editar: la semana ya empezó.">
            <Lock size={13} aria-hidden /> Ya empezó
          </span>
        ) : null,
    },
  ];

  const d = season.datos;
  const enCurso = d?.semanas.find((s) => s.estado === 'en_curso');
  const sinCerrar = d?.semanas.filter((s) => s.estado === 'pendiente_cierre').length ?? 0;

  return (
    <>
      <PageTitle
        title="Semanas y"
        accent="metas"
        description="El objetivo semanal de la season: meta de workouts y monedas de cada componente. Solo se editan las semanas que todavía no empiezan."
      />
      {aviso && (
        <Alert tone="success" className="mb-5">
          {aviso}
        </Alert>
      )}
      {!admin && (
        <Alert tone="info" className="mb-5">
          Tu rol solo puede ver el objetivo semanal.
        </Alert>
      )}
      <div className="grid items-start gap-5 xl:grid-cols-[1fr_380px]">
        <Card>
          <CardHeader
            icon={CalendarCheck}
            title={d ? `Season ${d.numero} · ${d.anio}` : 'Season'}
            description={d ? `Del ${fecha(d.fecha_inicio)} al ${fecha(d.fecha_fin)} · ${d.semanas.length} semanas${enCurso ? ` · en curso: semana ${enCurso.numero}` : ''}` : undefined}
          />
          {sinCerrar > 0 && (
            <Alert tone="danger" className="mb-4">
              {sinCerrar === 1 ? 'Hay 1 semana que ya pasó y no se cerró.' : `Hay ${sinCerrar} semanas que ya pasaron y no se cerraron.`} Revísalo en Estado del cierre.
            </Alert>
          )}
          {season.estado === 'error' ? (
            <ErrorState description={season.error} onRetry={season.recargar} />
          ) : !d ? (
            <div className="flex flex-col gap-2">
              {[0, 1, 2, 3, 4].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-inner bg-surface-muted" />
              ))}
            </div>
          ) : (
            <>
              <DataTable columns={columnas} rows={d.semanas} rowKey={(s) => s.fecha_inicio} selectedKey={enCurso?.fecha_inicio} caption="Semanas de la season" />
              <p className="mt-3 text-[12.5px] text-text-muted">* Sin definir: se crea sola copiando la semana anterior.</p>
            </>
          )}
        </Card>
        <MetasPorEdad />
      </div>

      <EditarSemana
        s={editando}
        hayMas={!!d && !!editando && d.semanas.some((x) => x.fecha_inicio > editando.fecha_inicio && x.objetivo !== null)}
        onClose={() => setEditando(null)}
        onGuardado={(m) => {
          setAviso(m);
          season.recargar();
        }}
      />
    </>
  );
}
