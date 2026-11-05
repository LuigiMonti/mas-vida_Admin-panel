import { useEffect, useState, type ReactNode } from 'react';
import { Activity, Footprints, Gauge, Gem, Plus, ScrollText } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/Field';
import { LevelBadge, TierRowValores, type Nivel } from '@/components/ui/Niveles';
import { PageTitle } from '@/components/ui/PageTitle';
import { Alert, ErrorState } from '@/components/ui/States';
import { DataTable, type Column } from '@/components/ui/Table';
import { copia, ErrorPanel, hoyGT } from '@/datos/red';
import { crearVersion, diferencias, listarVersiones, MAX_VERSIONES_POR_DIA, type EstadoVersion, type TablaPuntaje, type VersionRegla } from '@/datos/reglas';
import { puede } from '@/datos/sesion';
import { useConsulta } from '@/datos/useConsulta';
import { cx } from '@/lib/cx';
import { fecha, numero } from '@/lib/formato';

const TONO_VERSION: Record<EstadoVersion, 'success' | 'primary' | 'neutral'> = { vigente: 'success', programada: 'primary', anterior: 'neutral' };
const NOMBRE_VERSION: Record<EstadoVersion, string> = { vigente: 'Vigente', programada: 'Programada', anterior: 'Anterior' };

type Fila = VersionRegla & { estado: EstadoVersion };

const pct = (n: number) => `${String(n).replace('.', ',')} %`;

function rangoPasos(t: TablaPuntaje, i: number): string {
  const p = t.pasos[i]!;
  const sig = t.pasos[i + 1];
  if (!sig) return `${numero(p.desde)} o más`;
  if (p.desde === 0) return `Menos de ${numero(sig.desde)}`;
  return `${numero(p.desde)} a ${numero(sig.desde - 1)}`;
}

/* ----------------------------------------------------------------- tabla (lectura) */

function Bloque({ icon: Icon, titulo, nota, children }: { icon: typeof Footprints; titulo: string; nota?: ReactNode; children: ReactNode }) {
  return (
    <section>
      <h3 className="mb-2.5 flex items-center gap-2 text-[13px] font-bold tracking-[0.06em] text-text-muted uppercase">
        <Icon size={15} aria-hidden /> {titulo}
      </h3>
      {children}
      {nota && <p className="mt-2 text-[12.5px] text-text-muted">{nota}</p>}
    </section>
  );
}

function Par({ label, valor }: { label: string; valor: ReactNode }) {
  return (
    <div className="flex items-center justify-between gap-3 rounded-inner bg-surface-muted px-4 py-2.5">
      <span className="text-[13.5px]">{label}</span>
      <span className="font-display font-bold tabular-nums">{valor}</span>
    </div>
  );
}

function VerTabla({ t }: { t: TablaPuntaje }) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <Bloque icon={Footprints} titulo="Pasos del día">
        <div className="flex flex-col gap-2">
          {t.pasos.map((p, i) => (
            <TierRowValores key={i} indice={i} rango={rangoPasos(t, i)} puntos={p.puntos} />
          ))}
        </div>
      </Bloque>

      <Bloque icon={Activity} titulo="Intensidad" nota={`Se acredita el escalón más alto del día; no se suman sesiones. FCmáx = ${t.fcmax_base} − edad, calculada en el servidor.`}>
        <div className="flex flex-col gap-2">
          {t.intensidad.map((x, i) => (
            <Par key={i} label={`${x.minutos} min al ${x.pct_fcmax} % de la FCmáx`} valor={x.puntos} />
          ))}
        </div>
      </Bloque>

      <Bloque icon={Gauge} titulo="Bono y techos" nota="El bono es fijo, nunca un multiplicador. El techo anual es por año de póliza, no por año calendario.">
        <div className="flex flex-col gap-2">
          <Par label={`Bono ${t.bono_edad_minima}+ sobre pasos`} valor={`+${t.bono_puntos_pasos}`} />
          <Par label={`Bono ${t.bono_edad_minima}+ sobre intensidad`} valor={`+${t.bono_puntos_intensidad}`} />
          <Par label="Techo diario" valor={numero(t.tope_diario)} />
          <Par label="Techo anual" valor={numero(t.tope_anual)} />
        </div>
      </Bloque>

      <Bloque icon={Gem} titulo="Niveles y cashback" nota="Cashback = % del nivel × prima anual, devuelto después del pago de la prima.">
        <div className="flex flex-col gap-2">
          {t.niveles.map((n, i) => {
            const sig = t.niveles[i + 1];
            return (
              <div key={n.nivel} className="flex items-center justify-between gap-3 rounded-inner bg-surface-muted px-4 py-2.5">
                <LevelBadge nivel={n.nivel as Nivel} />
                <span className="text-[13px] text-text-muted tabular-nums">
                  {sig ? `${numero(n.desde)}–${numero(sig.desde - 1)}` : `${numero(n.desde)} o más`} pts · <strong className="text-text">{pct(n.cashback_pct)}</strong>
                </span>
              </div>
            );
          })}
        </div>
      </Bloque>

      <Bloque icon={ScrollText} titulo="Datos">
        <div className="flex flex-col gap-2">
          <Par label="Ventana de datos rezagados" valor={`${t.ventana_rezagados_dias} días`} />
          <Par label="Día atípico (se marca, no se bloquea)" valor={`${numero(t.pasos_dia_atipico)} pasos`} />
          <Par label="Workout mínimo, con ritmo cardíaco" valor={`${t.workout_minutos_minimos} min`} />
        </div>
      </Bloque>
    </div>
  );
}

/* ----------------------------------------------------------------- tabla (edición) */

function Num({ valor, onChange, error, label, ancho = 'w-24', step = 1 }: { valor: number; onChange: (n: number) => void; error?: string; label: string; ancho?: string; step?: number }) {
  return (
    <span className="inline-flex flex-col">
      <input
        type="number"
        aria-label={label}
        step={step}
        value={Number.isFinite(valor) ? valor : ''}
        onChange={(e) => onChange(e.target.value === '' ? NaN : Number(e.target.value))}
        className={cx('h-9 rounded-field border bg-surface px-2.5 text-sm tabular-nums outline-none focus:border-primary', ancho, error ? 'border-danger' : 'border-border')}
      />
      {error && <span className="mt-0.5 text-[11.5px] text-danger">{error}</span>}
    </span>
  );
}

function EditarTabla({ t, set, e }: { t: TablaPuntaje; set: (t: TablaPuntaje) => void; e: Record<string, string> }) {
  const campo = <K extends keyof TablaPuntaje>(k: K, v: TablaPuntaje[K]) => set({ ...t, [k]: v });
  return (
    <div className="grid gap-6 md:grid-cols-2">
      <Bloque icon={Footprints} titulo="Pasos del día">
        <div className="flex flex-col gap-2">
          {t.pasos.map((p, i) => (
            <div key={i} className="flex flex-wrap items-start gap-2 text-[13px]">
              <span className="pt-2 text-text-muted">Desde</span>
              <Num label={`Tramo ${i + 1}, pasos desde`} valor={p.desde} ancho="w-28" step={500} error={e[`pasos_${i}_desde`]} onChange={(n) => campo('pasos', t.pasos.map((x, j) => (j === i ? { ...x, desde: n } : x)))} />
              <span className="pt-2 text-text-muted">pasos →</span>
              <Num label={`Tramo ${i + 1}, puntos`} valor={p.puntos} ancho="w-20" error={e[`pasos_${i}_puntos`]} onChange={(n) => campo('pasos', t.pasos.map((x, j) => (j === i ? { ...x, puntos: n } : x)))} />
              <span className="pt-2 text-text-muted">pts</span>
            </div>
          ))}
        </div>
      </Bloque>
      <Bloque icon={Activity} titulo="Intensidad">
        <div className="flex flex-col gap-2">
          {t.intensidad.map((x, i) => (
            <div key={i} className="flex flex-wrap items-start gap-2 text-[13px]">
              <Num label={`Escalón ${i + 1}, minutos`} valor={x.minutos} ancho="w-16" error={e[`int_${i}_minutos`]} onChange={(n) => campo('intensidad', t.intensidad.map((y, j) => (j === i ? { ...y, minutos: n } : y)))} />
              <span className="pt-2 text-text-muted">min al</span>
              <Num label={`Escalón ${i + 1}, % FCmáx`} valor={x.pct_fcmax} ancho="w-16" error={e[`int_${i}_pct`]} onChange={(n) => campo('intensidad', t.intensidad.map((y, j) => (j === i ? { ...y, pct_fcmax: n } : y)))} />
              <span className="pt-2 text-text-muted">% →</span>
              <Num label={`Escalón ${i + 1}, puntos`} valor={x.puntos} ancho="w-20" error={e[`int_${i}_puntos`]} onChange={(n) => campo('intensidad', t.intensidad.map((y, j) => (j === i ? { ...y, puntos: n } : y)))} />
              <span className="pt-2 text-text-muted">pts</span>
            </div>
          ))}
          <div className="flex items-start gap-2 text-[13px]">
            <span className="pt-2 text-text-muted">FCmáx =</span>
            <Num label="Base de la FCmáx" valor={t.fcmax_base} ancho="w-20" error={e.fcmax_base} onChange={(n) => campo('fcmax_base', n)} />
            <span className="pt-2 text-text-muted">− edad</span>
          </div>
        </div>
      </Bloque>
      <Bloque icon={Gauge} titulo="Bono y techos">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[13px]">
          <label className="flex flex-col gap-1">
            <span className="text-text-muted">Edad del bono</span>
            <Num label="Edad del bono" valor={t.bono_edad_minima} error={e.bono_edad_minima} onChange={(n) => campo('bono_edad_minima', n)} />
          </label>
          <span />
          <label className="flex flex-col gap-1">
            <span className="text-text-muted">Bono sobre pasos</span>
            <Num label="Bono sobre pasos" valor={t.bono_puntos_pasos} error={e.bono_puntos_pasos} onChange={(n) => campo('bono_puntos_pasos', n)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-text-muted">Bono sobre intensidad</span>
            <Num label="Bono sobre intensidad" valor={t.bono_puntos_intensidad} error={e.bono_puntos_intensidad} onChange={(n) => campo('bono_puntos_intensidad', n)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-text-muted">Techo diario</span>
            <Num label="Techo diario" valor={t.tope_diario} error={e.tope_diario} onChange={(n) => campo('tope_diario', n)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-text-muted">Techo anual</span>
            <Num label="Techo anual" valor={t.tope_anual} ancho="w-28" step={500} error={e.tope_anual} onChange={(n) => campo('tope_anual', n)} />
          </label>
        </div>
      </Bloque>
      <Bloque icon={Gem} titulo="Niveles y cashback">
        <div className="flex flex-col gap-2">
          {t.niveles.map((n, i) => (
            <div key={n.nivel} className="flex flex-wrap items-start gap-2 text-[13px]">
              <span className="w-16 pt-2 font-semibold">Nivel {n.nivel}</span>
              <span className="pt-2 text-text-muted">desde</span>
              <Num label={`Nivel ${n.nivel}, desde`} valor={n.desde} ancho="w-24" step={500} error={e[`niv_${i}_desde`]} onChange={(v) => campo('niveles', t.niveles.map((x, j) => (j === i ? { ...x, desde: v } : x)))} />
              <Num label={`Nivel ${n.nivel}, cashback`} valor={n.cashback_pct} ancho="w-20" step={0.5} error={e[`niv_${i}_pct`]} onChange={(v) => campo('niveles', t.niveles.map((x, j) => (j === i ? { ...x, cashback_pct: v } : x)))} />
              <span className="pt-2 text-text-muted">%</span>
            </div>
          ))}
        </div>
      </Bloque>
      <Bloque icon={ScrollText} titulo="Datos">
        <div className="grid grid-cols-2 gap-x-3 gap-y-2.5 text-[13px]">
          <label className="flex flex-col gap-1">
            <span className="text-text-muted">Ventana de rezagados (días)</span>
            <Num label="Ventana de rezagados" valor={t.ventana_rezagados_dias} error={e.ventana_rezagados_dias} onChange={(n) => campo('ventana_rezagados_dias', n)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-text-muted">Día atípico (pasos)</span>
            <Num label="Día atípico" valor={t.pasos_dia_atipico} ancho="w-28" step={1000} error={e.pasos_dia_atipico} onChange={(n) => campo('pasos_dia_atipico', n)} />
          </label>
          <label className="flex flex-col gap-1">
            <span className="text-text-muted">Workout mínimo (min)</span>
            <Num label="Workout mínimo" valor={t.workout_minutos_minimos} error={e.workout_minutos_minimos} onChange={(n) => campo('workout_minutos_minimos', n)} />
          </label>
        </div>
      </Bloque>
    </div>
  );
}

/* ----------------------------------------------------------------- nueva versión */

function NuevaVersion({ base, siguiente, onClose, onCreada }: { base: VersionRegla | null; siguiente: number; onClose: () => void; onCreada: (m: string) => void }) {
  const [desde, setDesde] = useState('');
  const [tabla, setTabla] = useState<TablaPuntaje | null>(null);
  const [error, setError] = useState<ErrorPanel>();
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (base) setTabla(copia(base.tabla));
  }, [base]);

  if (!tabla) return null;
  const cambios = base ? diferencias(base.tabla, tabla) : [];

  const crear = async () => {
    setGuardando(true);
    setError(undefined);
    try {
      const v = await crearVersion(desde, tabla);
      onCreada(`Versión v${v.version} creada: vale desde el ${fecha(v.vigente_desde)}.`);
      onClose();
    } catch (e) {
      setError(e instanceof ErrorPanel ? e : new ErrorPanel('No se pudo crear.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Dialog
      open
      width={880}
      onClose={onClose}
      busy={guardando}
      title={`Nueva versión de reglas: v${siguiente}`}
      description={`Parte de la tabla de v${base?.version ?? '—'}. Las filas desde ese día se calculan y se sellan con esta versión; las anteriores no cambian. Después de crearla no se edita.`}
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={guardando}>
            Cancelar
          </Button>
          <Button onClick={crear} disabled={guardando || !desde}>
            {guardando ? 'Creando…' : `Crear v${siguiente}`}
          </Button>
        </>
      }
    >
      <div className="flex max-h-[62vh] flex-col gap-5 overflow-y-auto pr-1">
        <div className="max-w-xs">
          <TextField label="Vigente desde" type="date" min={hoyGT()} value={desde} onChange={(e) => setDesde(e.target.value)} error={error?.campos?.vigente_desde} hint={`Hoy o un día futuro. Máximo ${MAX_VERSIONES_POR_DIA} versiones por día; si hay varias, vale la de número más alto.`} />
        </div>
        <EditarTabla t={tabla} set={setTabla} e={error?.campos ?? {}} />
      </div>
      {cambios.length > 0 ? (
        <Alert tone="warning">
          <strong>Cambia:</strong> {cambios.join('; ')}.
        </Alert>
      ) : (
        <Alert tone="info">La tabla es igual a la de v{base?.version}. Cambia algún valor o la versión nueva no tiene efecto.</Alert>
      )}
      {error && !error.campos?.vigente_desde && <Alert tone="danger">{error.message}</Alert>}
    </Dialog>
  );
}

/* ----------------------------------------------------------------- página */

export function Reglas() {
  const lista = useConsulta(listarVersiones);
  const [vista, setVista] = useState<number | null>(null);
  const [nueva, setNueva] = useState(false);
  const [aviso, setAviso] = useState<string>();
  const admin = puede('editar_reglas');

  const datos = lista.datos;
  const elegida = datos?.versiones.find((v) => v.version === (vista ?? datos.vigente)) ?? null;
  const vigente = datos?.versiones.find((v) => v.version === datos.vigente) ?? null;

  const columnas: Column<Fila>[] = [
    { key: 'version', header: 'Versión', render: (v) => <span className="font-mono font-semibold">v{v.version}</span> },
    { key: 'desde', header: 'Vigente desde', render: (v) => fecha(v.vigente_desde) },
    { key: 'estado', header: 'Estado', align: 'right', render: (v) => <Chip tone={TONO_VERSION[v.estado]} dot>{NOMBRE_VERSION[v.estado]}</Chip> },
  ];

  return (
    <>
      <PageTitle title="Reglas de" accent="puntaje" description="Con qué se calculan los puntos. Cada fila de los ledgers queda sellada con la versión vigente ese día." />
      {!admin && (
        <Alert tone="info" className="mb-5">
          Tu rol solo puede ver las reglas.
        </Alert>
      )}
      {aviso && (
        <Alert tone="success" className="mb-5">
          {aviso}
        </Alert>
      )}
      {lista.estado === 'error' ? (
        <Card>
          <ErrorState description={lista.error} onRetry={lista.recargar} />
        </Card>
      ) : !datos ? (
        <div className="h-64 animate-pulse rounded-card bg-surface shadow-card" />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[340px_1fr]">
          <Card>
            <CardHeader
              icon={ScrollText}
              title="Versiones"
              action={
                admin ? (
                  <Button size="sm" variant="secondary" icon={Plus} onClick={() => setNueva(true)}>
                    Nueva
                  </Button>
                ) : undefined
              }
            />
            {datos.vigente === null && (
              <Alert tone="danger" className="mb-4">
                No hay ninguna versión vigente hoy: el sync está respondiendo 500.
              </Alert>
            )}
            <DataTable
              columns={columnas}
              rows={datos.versiones}
              rowKey={(v) => String(v.version)}
              selectedKey={elegida ? String(elegida.version) : undefined}
              onRowClick={(v) => setVista(v.version)}
              caption="Versiones de reglas"
            />
            <p className="mt-3 text-[12.5px] text-text-muted">Haz clic en una versión para ver su tabla.</p>
          </Card>

          <Card>
            {elegida ? (
              <>
                <CardHeader
                  title={`Tabla de puntaje · v${elegida.version}`}
                  description={`Vigente desde el ${fecha(elegida.vigente_desde)}`}
                  action={<Chip tone={TONO_VERSION[elegida.estado]} dot>{NOMBRE_VERSION[elegida.estado]}</Chip>}
                />
                <VerTabla t={elegida.tabla} />
              </>
            ) : (
              <Alert tone="danger">No hay versión para mostrar.</Alert>
            )}
          </Card>
        </div>
      )}

      {nueva && datos && (
        <NuevaVersion
          base={vigente}
          siguiente={Math.max(0, ...datos.versiones.map((v) => v.version)) + 1}
          onClose={() => setNueva(false)}
          onCreada={(m) => {
            setAviso(m);
            setVista(null);
            lista.recargar();
          }}
        />
      )}
    </>
  );
}
