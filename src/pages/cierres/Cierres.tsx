import { useEffect, useState } from 'react';
import { Activity, CalendarClock, CalendarX, History, Loader2, Play, TimerReset } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, MetricCard } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { PageTitle } from '@/components/ui/PageTitle';
import { Alert, ErrorState } from '@/components/ui/States';
import { DataTable, type Column } from '@/components/ui/Table';
import { CUANDO_CORRE, correrPonerseAlDia, MAX_INTENTOS, NOMBRE_CORRIDA, obtenerEstadoProgramador, type Corrida } from '@/datos/cierres';
import { obtenerSeason, type SemanaDeSeason } from '@/datos/objetivos';
import { ErrorPanel } from '@/datos/red';
import { puede } from '@/datos/sesion';
import { useConsulta } from '@/datos/useConsulta';
import { fechaCorta, fechaHora, haceCuanto } from '@/lib/formato';

/** Más de 10 min sin latido = el servicio del programador está caído. */
const LATIDO_MAX_MS = 10 * 60 * 1000;

function duracion(c: Corrida): string {
  if (!c.termino) return 'en curso';
  const s = Math.round((new Date(c.termino).getTime() - new Date(c.empezo).getTime()) / 1000);
  return s < 60 ? `${s} s` : `${Math.round(s / 60)} min`;
}

const COLUMNAS: Column<Corrida>[] = [
  {
    key: 'tipo',
    header: 'Corrida',
    render: (c) => (
      <div>
        <div className="font-semibold whitespace-nowrap">{NOMBRE_CORRIDA[c.tipo]}</div>
        <div className="text-[12px] text-text-muted">{c.origen === 'programador' ? 'Programador' : `A mano · ${c.origen}`}</div>
      </div>
    ),
  },
  {
    key: 'cuando',
    header: 'Empezó',
    render: (c) => (
      <div className="whitespace-nowrap">
        <div>{fechaHora(c.empezo)}</div>
        <div className="text-[12px] text-text-muted">{duracion(c)}</div>
      </div>
    ),
  },
  {
    key: 'estado',
    header: 'Estado',
    render: (c) =>
      c.estado === 'en_curso' ? (
        <Chip tone="primary" icon={Loader2}>
          En curso
        </Chip>
      ) : c.estado === 'fallo' ? (
        <Chip tone="danger" dot>
          Falló
        </Chip>
      ) : (
        <Chip tone="success" dot>
          Bien
        </Chip>
      ),
  },
  {
    key: 'intentos',
    header: 'Intentos',
    numeric: true,
    render: (c) => <span className={c.intentos > 1 ? 'font-semibold text-warning' : 'text-text-muted'}>{c.intentos} de {MAX_INTENTOS}</span>,
  },
  {
    key: 'resumen',
    header: 'Qué hizo',
    render: (c) => (
      <div className="max-w-[420px]">
        <div>{c.resumen}</div>
        {c.error && <div className="mt-0.5 font-mono text-[11.5px] text-danger">{c.error}</div>}
      </div>
    ),
  },
];

const pendiente = (s: SemanaDeSeason) => s.estado === 'pendiente_cierre';

export function Cierres() {
  const prog = useConsulta(obtenerEstadoProgramador);
  const season = useConsulta(obtenerSeason);
  const [confirmar, setConfirmar] = useState(false);
  const [corriendo, setCorriendo] = useState(false);
  const [resultado, setResultado] = useState<{ tono: 'success' | 'danger'; texto: string }>();
  const admin = puede('correr_cierre');
  const enCurso = !!prog.datos?.hay_cierre_en_curso;

  // Mientras haya un cierre corriendo, se consulta cada 3 s hasta que termine.
  useEffect(() => {
    if (!enCurso) return;
    const t = setTimeout(() => {
      prog.recargar();
      season.recargar();
    }, 3000);
    return () => clearTimeout(t);
  }, [enCurso, prog.datos, prog.recargar, season.recargar]);

  const correr = async () => {
    setConfirmar(false);
    setCorriendo(true);
    setResultado(undefined);
    // Refresca para que se vea la corrida en curso (y el candado).
    setTimeout(prog.recargar, 100);
    try {
      const c = await correrPonerseAlDia();
      setResultado({ tono: 'success', texto: c.resumen });
    } catch (e) {
      setResultado({ tono: 'danger', texto: e instanceof ErrorPanel ? e.message : 'No se pudo correr el cierre.' });
    } finally {
      setCorriendo(false);
      prog.recargar();
      season.recargar();
    }
  };

  const p = prog.datos;
  const semanas = season.datos?.semanas ?? [];
  const sinCerrar = semanas.filter(pendiente);
  const ultimaCerrada = [...semanas].reverse().find((s) => s.estado === 'cerrada');
  const enRevision = semanas.find((s) => s.estado === 'en_revision');
  const latidoViejo = p ? Date.now() - new Date(p.ultimo_latido).getTime() > LATIDO_MAX_MS : false;
  const ultima = p?.corridas.find((c) => c.estado !== 'en_curso');
  const proximoCierre = p?.proximas.find((x) => x.tipo === 'cierre');

  return (
    <>
      <PageTitle title="Estado del" accent="cierre" description="Si el programador corrió, qué semanas quedaron cerradas y qué viene. Lo primero que revisar el martes." />

      {prog.estado === 'error' ? (
        <Card>
          <ErrorState description={prog.error} onRetry={prog.recargar} />
        </Card>
      ) : !p ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          {[0, 1, 2, 3].map((i) => (
            <div key={i} className="h-[132px] animate-pulse rounded-card bg-surface shadow-card" />
          ))}
        </div>
      ) : (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard
              variant="feature"
              label="Programador"
              value={latidoViejo ? 'Caído' : 'Activo'}
              icon={Activity}
              detail={`Último latido ${haceCuanto(p.ultimo_latido)}`}
            />
            <MetricCard
              label="Última corrida"
              value={ultima ? (ultima.estado === 'ok' ? 'Bien' : 'Falló') : '—'}
              icon={History}
              detail={ultima ? `${NOMBRE_CORRIDA[ultima.tipo]} · ${haceCuanto(ultima.empezo)}` : 'Nunca ha corrido'}
            />
            <MetricCard
              label="Semanas sin cerrar"
              value={season.datos ? String(sinCerrar.length) : '—'}
              icon={CalendarX}
              detail={ultimaCerrada ? `Última cerrada: semana ${ultimaCerrada.numero}` : 'Ninguna cerrada todavía'}
            />
            <MetricCard
              label="Próximo cierre"
              value={proximoCierre ? fechaCorta(proximoCierre.cuando) : '—'}
              icon={CalendarClock}
              detail="00:00, hora de Guatemala"
            />
          </div>

          <div className="mt-5 flex flex-col gap-2.5">
            {latidoViejo && <Alert tone="danger">El programador no da señales desde {fechaHora(p.ultimo_latido)}. Revisa el servicio: sin él, los martes no se cierra nada.</Alert>}
            {ultima?.estado === 'fallo' && (
              <Alert tone="danger">
                {NOMBRE_CORRIDA[ultima.tipo]} falló después de {ultima.intentos} intentos: {ultima.error}
              </Alert>
            )}
            {sinCerrar.length > 0 && (
              <Alert tone="warning">
                {sinCerrar.length === 1 ? 'Hay 1 semana que ya pasó y no se cerró' : `Hay ${sinCerrar.length} semanas que ya pasaron y no se cerraron`}:{' '}
                {sinCerrar.map((s) => `semana ${s.numero}`).join(', ')}. Ponte al día para pagar las monedas.
              </Alert>
            )}
            {enRevision && <Alert tone="info">La semana {enRevision.numero} está en revisión: hoy es lunes, el día de los datos atrasados. Se cierra mañana a las 00:00.</Alert>}
            {resultado && <Alert tone={resultado.tono}>{resultado.texto}</Alert>}
          </div>

          <div className="mt-5 grid items-start gap-5 lg:grid-cols-[1fr_360px]">
            <Card>
              <CardHeader icon={History} title="Historial de corridas" description={`Si una corrida falla, se reintenta cada 5 minutos hasta ${MAX_INTENTOS} veces.`} />
              <DataTable columns={COLUMNAS} rows={p.corridas} rowKey={(c) => String(c.id)} caption="Historial de corridas" />
            </Card>

            <div className="flex flex-col gap-5">
              <Card>
                <CardHeader icon={TimerReset} title="Ponerse al día" description="Cierra todas las semanas que ya pasaron y no se cerraron. Retoma a quienes faltaban, sin pagar dos veces." />
                <div className="mb-4 rounded-inner bg-surface-muted px-4 py-3 font-mono text-[12.5px]">cerrar_semana --ponerse-al-dia</div>
                {admin ? (
                  <Button icon={corriendo ? Loader2 : Play} className="w-full" disabled={corriendo || p.hay_cierre_en_curso} onClick={() => setConfirmar(true)}>
                    {corriendo || p.hay_cierre_en_curso ? 'Hay un cierre en curso…' : 'Correr ahora'}
                  </Button>
                ) : (
                  <Alert tone="info">Solo admin puede correr cierres.</Alert>
                )}
              </Card>

              <Card>
                <CardHeader icon={CalendarClock} title="Próximas corridas" />
                <ul className="flex flex-col gap-2">
                  {p.proximas.map((x) => (
                    <li key={x.tipo} className="flex items-center justify-between gap-3 rounded-inner bg-surface-muted px-4 py-2.5">
                      <div>
                        <div className="text-[13.5px] font-semibold">{NOMBRE_CORRIDA[x.tipo]}</div>
                        <div className="text-[12px] text-text-muted">{CUANDO_CORRE[x.tipo]}</div>
                      </div>
                      <span className="text-[13px] whitespace-nowrap">{fechaHora(x.cuando)}</span>
                    </li>
                  ))}
                </ul>
              </Card>
            </div>
          </div>
        </>
      )}

      <Dialog
        open={confirmar}
        onClose={() => setConfirmar(false)}
        title="¿Ponerse al día ahora?"
        description={
          sinCerrar.length > 0
            ? `Se cierran ${sinCerrar.length === 1 ? 'la semana' : 'las semanas'} ${sinCerrar.map((s) => s.numero).join(', ')} y se pagan sus monedas. Lo pagado no se deshace.`
            : 'No hay semanas pendientes: el comando no va a cerrar nada, pero queda registrado.'
        }
        footer={
          <>
            <Button variant="secondary" onClick={() => setConfirmar(false)}>
              Cancelar
            </Button>
            <Button icon={Play} onClick={correr}>
              Correr cierre
            </Button>
          </>
        }
      >
        <Alert tone="info">Mientras corre, ningún otro cierre puede empezar (ni el del programador).</Alert>
      </Dialog>
    </>
  );
}
