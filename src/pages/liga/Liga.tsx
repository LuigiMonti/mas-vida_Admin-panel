import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router';
import { Lock, Medal, Save, Trophy, Users, Wand2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { TextField } from '@/components/ui/Field';
import { PageTitle } from '@/components/ui/PageTitle';
import { LigaBanner } from '@/components/ui/Preview';
import { Avatar } from '@/components/ui/Progress';
import { Alert, EmptyState, ErrorState } from '@/components/ui/States';
import { DataTable, type Column } from '@/components/ui/Table';
import {
  guardarPodio,
  LARGO_MAXIMO_NOMBRE,
  listarMeses,
  NOMBRE_ESTADO_MES,
  obtenerPodio,
  obtenerTabla,
  renombrarMes,
  validarNombre,
  type EstadoMes,
  type FilaTabla,
  type MesLiga,
} from '@/datos/liga';
import { urlLogo } from '@/datos/premios';
import { ErrorPanel } from '@/datos/red';
import { puede } from '@/datos/sesion';
import { useConsulta } from '@/datos/useConsulta';
import { cx } from '@/lib/cx';
import { fecha, numero } from '@/lib/formato';

const TONO_MES: Record<EstadoMes, ChipTone> = { futuro: 'neutral', en_curso: 'primary', por_cerrar: 'warning', cerrado: 'warning', pagado: 'success' };

const fmtMes = new Intl.DateTimeFormat('es-GT', { month: 'long', timeZone: 'UTC' });
const fmtMesAnio = new Intl.DateTimeFormat('es-GT', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const nombreMes = (m: string) => fmtMes.format(new Date(`${m}T12:00:00Z`));
const nombreMesAnio = (m: string) => {
  const t = fmtMesAnio.format(new Date(`${m}T12:00:00Z`)).replace(' de ', ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/* ----------------------------------------------------------------- nombre del mes */

function EditarNombre({ m, onGuardado }: { m: MesLiga; onGuardado: (m: MesLiga, aviso: string) => void }) {
  const [nombre, setNombre] = useState(m.nombre);
  const [error, setError] = useState<string>();
  const [guardando, setGuardando] = useState(false);
  useEffect(() => {
    setNombre(m.nombre);
    setError(undefined);
  }, [m.mes, m.nombre]);

  const cerrado = !!m.cerrada_en;
  const admin = puede('editar_liga');
  const cambiado = nombre.trim() !== m.nombre;
  const vivo = validarNombre(nombre);
  const sugerido = m.patrocinio ? `Liga ${m.patrocinio.comercio}` : null;

  const guardar = async () => {
    setGuardando(true);
    setError(undefined);
    try {
      const nuevo = await renombrarMes(m.mes, nombre);
      onGuardado(nuevo, nuevo.nombre ? `Ahora se llama «${nuevo.nombre}».` : 'Vuelve a llamarse La Liga.');
    } catch (e) {
      setError(e instanceof ErrorPanel ? (e.campos?.nombre ?? e.message) : 'No se pudo guardar.');
    } finally {
      setGuardando(false);
    }
  };

  return (
    <div className="flex flex-col gap-4">
      <LigaBanner
        mes={nombreMes(m.mes)}
        nombre={nombre}
        podio={m.podio}
        cierre={`Cierra el ${fecha(m.cierre)} · las monedas llegan el ${fecha(m.pago)}`}
        cuponPatrocinador={m.patrocinio ? { comercio: m.patrocinio.comercio, cupon: m.patrocinio.cupon, logo: urlLogo(m.patrocinio.logo), fondo: m.patrocinio.fondo || undefined } : undefined}
      />
      {cerrado ? (
        <Alert tone="info">
          <span className="inline-flex items-center gap-1.5">
            <Lock size={14} aria-hidden /> No se puede cambiar el nombre: este mes ya se cerró.
          </span>
        </Alert>
      ) : !admin ? (
        <Alert tone="info">Tu rol solo puede ver La Liga.</Alert>
      ) : (
        <div className="flex flex-col gap-2">
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-0 flex-1">
              <TextField
                label="Nombre de este mes"
                value={nombre}
                maxLength={LARGO_MAXIMO_NOMBRE + 10}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Vacío: «La Liga»"
                error={error ?? vivo ?? undefined}
                hint={`${nombre.trim().length} de ${LARGO_MAXIMO_NOMBRE}. Abajo de «La Liga · ${nombreMes(m.mes)}» en la app.`}
              />
            </div>
            <Button icon={Save} onClick={guardar} disabled={!cambiado || guardando || !!vivo} className="mb-[26px]">
              {guardando ? 'Guardando…' : 'Guardar'}
            </Button>
          </div>
          {sugerido && nombre.trim() !== sugerido && (
            <button type="button" onClick={() => setNombre(sugerido)} className="inline-flex w-fit items-center gap-1.5 rounded-full bg-primary-tint px-3 py-1 text-[12.5px] font-semibold text-primary hover:bg-primary-tint-strong">
              <Wand2 size={13} aria-hidden /> Usar «{sugerido}» (patrocina este mes)
            </button>
          )}
        </div>
      )}
    </div>
  );
}

/* ----------------------------------------------------------------- monedas del podio */

function Podio({ onGuardado }: { onGuardado: () => void }) {
  const podio = useConsulta(obtenerPodio);
  const [v, setV] = useState(['', '', '']);
  const [error, setError] = useState<ErrorPanel>();
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string>();
  const admin = puede('editar_liga');
  useEffect(() => {
    if (podio.datos) setV(podio.datos.map(String));
  }, [podio.datos]);
  const cambiado = podio.datos && v.some((x, i) => Number(x) !== podio.datos![i]);

  const guardar = async () => {
    setGuardando(true);
    setError(undefined);
    try {
      await guardarPodio(v.map(Number) as [number, number, number]);
      setAviso('Montos guardados. Valen para los meses que todavía no se cierran.');
      podio.recargar();
      onGuardado();
    } catch (e) {
      setError(e instanceof ErrorPanel ? e : new ErrorPanel('No se pudo guardar.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card>
      <CardHeader icon={Medal} title="Monedas del podio" description="Se fijan al cerrar cada mes: cambiarlas no toca los meses ya cerrados." />
      {podio.estado === 'error' ? (
        <ErrorState description={podio.error} onRetry={podio.recargar} />
      ) : (
        <div className="flex flex-col gap-3">
          <div className="grid grid-cols-3 gap-2">
            {['1.º', '2.º', '3.º'].map((p, i) => (
              <TextField
                key={p}
                label={`${p} lugar`}
                type="number"
                min={0}
                value={v[i]}
                disabled={!admin}
                onChange={(e) => setV(v.map((x, j) => (j === i ? e.target.value : x)))}
                error={error?.campos?.[`puesto_${i + 1}`]}
              />
            ))}
          </div>
          {aviso && !cambiado && <Alert tone="success">{aviso}</Alert>}
          {admin && (
            <Button size="sm" className="self-end" disabled={!cambiado || guardando} onClick={guardar}>
              {guardando ? 'Guardando…' : 'Guardar montos'}
            </Button>
          )}
        </div>
      )}
    </Card>
  );
}

/* ----------------------------------------------------------------- tabla */

const COLUMNAS: Column<FilaTabla>[] = [
  {
    key: 'pos',
    header: '#',
    render: (f) => (
      <span className={cx('grid size-7 place-items-center rounded-full font-display text-[13px] font-bold tabular-nums', f.posicion === 1 ? 'bg-accent text-on-accent' : f.posicion <= 3 ? 'bg-primary-tint text-primary' : 'text-text-muted')}>
        {f.posicion}
      </span>
    ),
  },
  {
    key: 'nombre',
    header: 'Persona',
    render: (f) => (
      <div className="flex items-center gap-2.5">
        <Avatar name={f.nombre} seed={f.usuario_id} size="sm" />
        <div>
          <div className="font-semibold">{f.nombre}</div>
          <div className="font-mono text-[11.5px] text-text-muted">{f.usuario_id}</div>
        </div>
      </div>
    ),
  },
  { key: 'puntos', header: 'Puntos del mes', numeric: true, render: (f) => <span className="font-display font-bold">{numero(f.puntos_mes)}</span> },
  { key: 'pasos', header: 'Pasos (1.er desempate)', numeric: true, render: (f) => numero(f.pasos_acumulados_mes) },
  { key: 'workouts', header: 'Workouts (2.º)', numeric: true, render: (f) => f.workouts_acumulados_mes },
  { key: 'monedas', header: 'Monedas', numeric: true, render: (f) => (f.monedas ? <span className="font-semibold text-coin">+{f.monedas}</span> : <span className="text-text-muted">—</span>) },
];

/* ----------------------------------------------------------------- página */

export function Liga() {
  const [params, setParams] = useSearchParams();
  const [vuelta, setVuelta] = useState(0);
  const [aviso, setAviso] = useState<string>();
  const meses = useConsulta(listarMeses, [vuelta]);
  const lista = meses.datos ?? [];
  const elegido = lista.find((m) => m.mes === params.get('mes')) ?? lista.find((m) => m.estado === 'en_curso') ?? lista[0];
  const tabla = useConsulta(() => (elegido ? obtenerTabla(elegido.mes) : Promise.resolve([])), [elegido?.mes, vuelta]);

  return (
    <>
      <PageTitle
        title="La"
        accent="Liga"
        description="Un solo grupo con todos los que tienen póliza verificada. Compite por puntos del mes; se cierra el día 2 y el podio se paga el día 9."
      />
      {aviso && (
        <Alert tone="success" className="mb-5">
          {aviso}
        </Alert>
      )}
      {meses.estado === 'error' ? (
        <Card>
          <ErrorState description={meses.error} onRetry={meses.recargar} />
        </Card>
      ) : !meses.datos || !elegido ? (
        <div className="h-80 animate-pulse rounded-card bg-surface shadow-card" />
      ) : (
        <div className="grid items-start gap-5 xl:grid-cols-[300px_1fr]">
          <div className="flex flex-col gap-5">
            <Card className="p-3">
              <ul className="flex flex-col gap-1">
                {lista.map((m) => (
                  <li key={m.mes}>
                    <button
                      type="button"
                      onClick={() => {
                        setParams({ mes: m.mes }, { replace: true });
                        setAviso(undefined);
                      }}
                      className={cx('flex w-full items-center justify-between gap-3 rounded-inner px-3 py-2.5 text-left transition-colors', m.mes === elegido.mes ? 'bg-primary-tint' : 'hover:bg-surface-muted')}
                      aria-current={m.mes === elegido.mes ? 'true' : undefined}
                    >
                      <div className="min-w-0">
                        <div className="font-semibold">{nombreMesAnio(m.mes)}</div>
                        <div className="truncate text-[12px] text-text-muted">{m.nombre || 'La Liga'}</div>
                      </div>
                      <Chip tone={TONO_MES[m.estado]} dot>
                        {NOMBRE_ESTADO_MES[m.estado]}
                      </Chip>
                    </button>
                  </li>
                ))}
              </ul>
            </Card>
            <Podio onGuardado={() => setVuelta((v) => v + 1)} />
          </div>

          <div className="flex flex-col gap-5">
            <Card>
              <CardHeader
                icon={Trophy}
                title={nombreMesAnio(elegido.mes)}
                description={
                  elegido.estado === 'pagado'
                    ? `Cerrado el ${fecha(elegido.cerrada_en!)} · pagado el ${fecha(elegido.pagada_en!)}`
                    : elegido.estado === 'cerrado'
                      ? `Cerrado el ${fecha(elegido.cerrada_en!)} · el podio se paga el ${fecha(elegido.pago)}`
                      : `Se cierra el ${fecha(elegido.cierre)} · el podio se paga el ${fecha(elegido.pago)}`
                }
                action={
                  elegido.total_participantes ? (
                    <Chip icon={Users} tone="neutral">
                      {elegido.total_participantes} participantes
                    </Chip>
                  ) : undefined
                }
              />
              <EditarNombre
                m={elegido}
                onGuardado={(_, texto) => {
                  setAviso(texto);
                  setVuelta((v) => v + 1);
                }}
              />
            </Card>

            <Card>
              <CardHeader
                title={elegido.estado === 'en_curso' || elegido.estado === 'por_cerrar' ? 'Tabla provisional' : 'Tabla final'}
                description={elegido.estado === 'en_curso' ? 'Va cambiando con cada sync. La final se fija el día 2.' : 'Puntos del mes; a igualdad, más pasos y después más workouts.'}
              />
              {tabla.estado === 'error' ? (
                <ErrorState description={tabla.error} onRetry={tabla.recargar} />
              ) : !tabla.datos ? (
                <div className="h-48 animate-pulse rounded-inner bg-surface-muted" />
              ) : (
                <DataTable
                  columns={COLUMNAS}
                  rows={tabla.datos}
                  rowKey={(f) => f.usuario_id}
                  caption="Tabla de La Liga"
                  empty={<EmptyState icon={Trophy} title="Este mes todavía no empieza" />}
                />
              )}
            </Card>
          </div>
        </div>
      )}
    </>
  );
}
