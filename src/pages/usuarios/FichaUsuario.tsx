import { useEffect, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, Coins, FileCheck2, Footprints, Lock, Plus, Smartphone, Watch, CircleHelp, Gem, RefreshCw, Trophy, Inbox, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, MetricCard } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SelectField } from '@/components/ui/Field';
import { MotivoDialog } from '@/components/ui/MotivoDialog';
import { NIVELES } from '@/components/ui/Niveles';
import { PageTitle } from '@/components/ui/PageTitle';
import { Alert, EmptyState, ErrorState } from '@/components/ui/States';
import { DataTable, type Column } from '@/components/ui/Table';
import { Tabs } from '@/components/ui/Tabs';
import {
  HOY,
  listarLedgerMonedas,
  listarLedgerPuntos,
  nombreDe,
  NOMBRE_TIPO_LEDGER,
  NOMBRE_TIPO_MONEDA,
  obtenerFicha,
  obtenerSync,
  PASOS_DIA_ATIPICO,
  revertirDia,
  VENTANA_REZAGADOS_DIAS,
  type Dispositivo,
  type FichaUsuario as Ficha,
  type FilaLedger,
  type FilaMonedas,
  type SoporteSync,
} from '@/datos/cuentas';
import type { ErrorPanel } from '@/datos/red';
import { puede } from '@/datos/sesion';
import { sumarDias } from '@/datos/temporadas';
import { useConsulta } from '@/datos/useConsulta';
import { cx } from '@/lib/cx';
import { conSigno, fecha, fechaCorta, fechaHora, haceCuanto, numero } from '@/lib/formato';
import { AvisoBloqueos } from '../antifraude/Bloqueos';
import { ConsentimientoCard, CuentaCard, Dato } from './AccionesCuenta';
import { AjusteDialog } from './AjusteDialog';
import { CuponesDeCuenta } from './CuponesDeCuenta';
import { diasSinSync, EstadoPolizaChip, motivoRechazo, RetroactivoChip, UltimoSync } from './comun';

type Pestana = 'resumen' | 'puntos' | 'monedas' | 'cupones' | 'sync';

function Cargando() {
  return (
    <div className="flex flex-col gap-2" aria-busy>
      {[0, 1, 2, 3].map((i) => (
        <div key={i} className="h-11 animate-pulse rounded-inner bg-surface-muted" />
      ))}
    </div>
  );
}

/* ----------------------------------------------------------------- resumen */

function Resumen({ f, onCambio }: { f: Ficha; onCambio: (aviso: string) => void }) {
  const p = f.usuario.poliza;
  const baja = f.usuario.dado_de_baja_en !== null;
  return (
    <div className="grid items-start gap-5 lg:grid-cols-[1.15fr_1fr]">
      <div className="flex flex-col gap-5">
        <CuentaCard f={f} onCambio={onCambio} />
        <ConsentimientoCard c={f.consentimiento} />
      </div>
      <Card>
        <CardHeader
          title="Póliza"
          icon={FileCheck2}
          action={
            p?.estado_verificacion === 'pendiente' ? (
              <Link to={`/polizas?u=${f.usuario.usuario_id}`} className="inline-flex h-8 items-center rounded-full bg-primary px-3.5 text-[13px] font-semibold text-white hover:bg-primary-deep">
                Verificar
              </Link>
            ) : p ? (
              <Link to={`/polizas?u=${f.usuario.usuario_id}`} className="text-[13px] font-semibold text-primary hover:underline">
                Ver en Pólizas →
              </Link>
            ) : undefined
          }
        />
        {!p ? (
          <EmptyState
            icon={FileCheck2}
            title={baja ? 'La póliza quedó libre' : 'No ha vinculado una póliza'}
            description={baja ? 'Al darse de baja, su póliza queda libre para otra cuenta.' : 'Gana puntos y monedas, pero no canjea ni entra a La Liga.'}
          />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <EstadoPolizaChip estado={f.estado_poliza} />
              <RetroactivoChip r={p.retroactivo} />
              {p.retroactivo_restituido_en && <Chip tone="success">Restituido</Chip>}
            </div>

            {p.estado_verificacion === 'rechazada' && <Alert tone="danger" className="mb-4">Rechazada: {motivoRechazo(p.motivo_rechazo)}.</Alert>}
            <dl className="grid gap-4 sm:grid-cols-2">
              <Dato label="Número">
                <span className="font-mono">{p.policy_number}</span>
              </Dato>
              <Dato label="Aseguradora">{p.insurer}</Dato>
              <Dato label="Titular">{p.nombre ? `${p.nombre} ${p.apellido ?? ''}` : '—'}</Dato>
              <Dato label="Plan">{p.plan ?? '—'}</Dato>
              <Dato label="Nacimiento declarado">{fecha(f.usuario.birth_date)}</Dato>
              <Dato label="Nacimiento confirmado">
                {p.birth_date_confirmada ? (
                  <span className={p.birth_date_confirmada !== f.usuario.birth_date ? 'font-semibold text-warning' : undefined}>{fecha(p.birth_date_confirmada)}</span>
                ) : (
                  <span className="text-text-muted">Sin confirmar</span>
                )}
              </Dato>
              <Dato label="Vinculada">{fechaHora(p.fecha_vinculacion)}</Dato>
              <Dato label="Verificada">{p.fecha_verificacion ? fechaHora(p.fecha_verificacion) : '—'}</Dato>
              {p.corte_retroactivo && <Dato label="Corte del retroactivo">{fecha(p.corte_retroactivo)}</Dato>}
            </dl>
            {p.correcciones.length > 0 && (
              <div className="mt-5 border-t border-border pt-4">
                <div className="mb-2 text-[12px] font-bold tracking-[0.08em] text-text-muted uppercase">Correcciones de la aseguradora</div>
                <ol className="flex flex-col gap-2">
                  {p.correcciones.map((c) => (
                    <li key={c.creado_en} className="rounded-inner bg-surface-muted px-3 py-2.5 text-[13px]">
                      <strong>
                        {fecha(c.fecha_anterior)} → {fecha(c.fecha_nueva)}
                      </strong>
                      , vale desde el {fecha(c.desde)}. <span className="text-text-muted">{c.motivo} · {c.autor}</span>
                    </li>
                  ))}
                </ol>
              </div>
            )}
          </>
        )}
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------------- ledgers */

const TONO_TIPO: Record<string, 'primary' | 'neutral' | 'danger' | 'warning' | 'coin' | 'success'> = {
  pasos: 'primary',
  intensidad: 'primary',
  chequeo_medico: 'success',
  ajuste_manual: 'warning',
  retroactivo_denegado: 'danger',
  objetivo_cumplido: 'coin',
  liga_mensual: 'coin',
  canje: 'neutral',
  expiracion: 'neutral',
};

function Monto({ n }: { n: number }) {
  return <span className={cx('font-display font-bold tabular-nums', n < 0 ? 'text-danger' : 'text-text')}>{conSigno(n)}</span>;
}

function Motivo({ motivo, autor }: { motivo?: string; autor?: string }) {
  if (!motivo) return <span className="text-text-muted">—</span>;
  return (
    <div className="max-w-[260px]">
      <div className="truncate" title={motivo}>
        {motivo}
      </div>
      {autor && <div className="truncate text-[11.5px] text-text-muted">{autor}</div>}
    </div>
  );
}

const COL_PUNTOS: Column<FilaLedger>[] = [
  { key: 'fecha', header: 'Día', render: (f) => <span className="whitespace-nowrap">{fechaCorta(f.fecha)}</span> },
  { key: 'tipo', header: 'Tipo', render: (f) => <Chip tone={TONO_TIPO[f.tipo]}>{NOMBRE_TIPO_LEDGER[f.tipo]}</Chip> },
  { key: 'puntos', header: 'Puntos', numeric: true, render: (f) => <Monto n={f.puntos} /> },
  {
    key: 'tope',
    header: 'Tope',
    render: (f) => (f.tope_diario_aplicado ? <Chip tone="neutral">Tope 200</Chip> : <span className="text-text-muted">—</span>),
  },
  { key: 'version', header: 'Versión', render: (f) => <span className="font-mono text-[12.5px]">{f.version_regla}</span> },
  { key: 'motivo', header: 'Motivo', render: (f) => <Motivo motivo={f.motivo} autor={f.autor} /> },
  { key: 'creado', header: 'Registrada', align: 'right', render: (f) => <span className="whitespace-nowrap text-text-muted">{fechaHora(f.creado_en)}</span> },
];

const COL_MONEDAS: Column<FilaMonedas>[] = [
  { key: 'fecha', header: 'Fecha', render: (f) => <span className="whitespace-nowrap">{fechaCorta(f.fecha)}</span> },
  { key: 'tipo', header: 'Tipo', render: (f) => <Chip tone={TONO_TIPO[f.tipo]}>{NOMBRE_TIPO_MONEDA[f.tipo]}</Chip> },
  { key: 'cantidad', header: 'Monedas', numeric: true, render: (f) => <Monto n={f.cantidad} /> },
  { key: 'vence', header: 'Vence', render: (f) => (f.fecha_expiracion ? fecha(f.fecha_expiracion) : <span className="text-text-muted">—</span>) },
  { key: 'motivo', header: 'Motivo', render: (f) => <Motivo motivo={f.motivo} autor={f.autor} /> },
  { key: 'creado', header: 'Registrada', align: 'right', render: (f) => <span className="whitespace-nowrap text-text-muted">{fechaHora(f.creado_en)}</span> },
];

/** Los días de la ventana que todavía tienen puntos acreditados: los que se pueden revertir. */
function diasConPuntos(filas: FilaLedger[]): Array<{ fecha: string; puntos: number }> {
  const limite = sumarDias(HOY, -VENTANA_REZAGADOS_DIAS);
  const porDia = new Map<string, number>();
  for (const f of filas) if (f.fecha >= limite && f.fecha <= HOY) porDia.set(f.fecha, (porDia.get(f.fecha) ?? 0) + f.puntos);
  return [...porDia.entries()]
    .filter(([, puntos]) => puntos > 0)
    .map(([fecha, puntos]) => ({ fecha, puntos }))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/** Deja un día en 0 con una fila de ajuste de signo contrario. */
function RevertirDiaDialog({ open, dias, inicial, usuario_id, onClose, onGuardado }: { open: boolean; dias: Array<{ fecha: string; puntos: number }>; inicial?: string; usuario_id: string; onClose: () => void; onGuardado: (m: string) => void }) {
  const [dia, setDia] = useState('');
  const [error, setError] = useState<ErrorPanel>();
  useEffect(() => {
    if (open) {
      setDia(inicial && dias.some((d) => d.fecha === inicial) ? inicial : '');
      setError(undefined);
    }
  }, [open, inicial, dias]);
  const elegido = dias.find((d) => d.fecha === dia);
  return (
    <MotivoDialog
      open={open}
      title="Revertir un día"
      description={`Agrega una fila de ajuste que deja ese día en 0. Solo los últimos ${VENTANA_REZAGADOS_DIAS} días; las muestras no se tocan.`}
      confirmLabel="Revertir el día"
      sugerencias={['Día atípico: pasos imposibles', 'Datos de otra persona', 'Workout que no fue']}
      bloqueado={!elegido}
      onClose={onClose}
      onError={setError}
      onConfirm={async (motivo) => {
        const r = await revertirDia(usuario_id, dia, motivo);
        onGuardado(`Día revertido: −${r.puntos} pts el ${fecha(dia)}.`);
      }}
    >
      <SelectField label="Día" value={dia} onChange={(e) => setDia(e.target.value)} error={error?.campos?.fecha} hint={dias.length === 0 ? 'No hay días con puntos en la ventana.' : undefined}>
        <option value="" disabled>
          Elige el día
        </option>
        {dias.map((d) => (
          <option key={d.fecha} value={d.fecha}>
            {fechaCorta(d.fecha)} · {d.puntos} pts
          </option>
        ))}
      </SelectField>
      {elegido && (
        <Alert tone="info">
          Fila nueva: <strong>−{elegido.puntos} pts</strong> el {fecha(elegido.fecha)}, tipo ajuste manual. Si ese día ya entró a una semana o a una liga cerrada, eso no se reabre.
        </Alert>
      )}
    </MotivoDialog>
  );
}

function Ledger({ cual, usuario_id, vuelta, bloqueada, revertirInicial, onAjustar, onGuardado }: { cual: 'puntos' | 'monedas'; usuario_id: string; vuelta: number; bloqueada: boolean; revertirInicial?: string; onAjustar: () => void; onGuardado: (m: string) => void }) {
  const puntos = useConsulta(() => listarLedgerPuntos(usuario_id), [usuario_id, vuelta, cual]);
  const monedas = useConsulta(() => listarLedgerMonedas(usuario_id), [usuario_id, vuelta, cual]);
  const q = cual === 'puntos' ? puntos : monedas;
  const [revertir, setRevertir] = useState(false);
  const [abierto, setAbierto] = useState(false);
  const puedeAjustar = puede('ajustar_ledger');
  const dias = diasConPuntos(puntos.datos ?? []);

  // Llegó desde Antifraude con ?revertir=AAAA-MM-DD: se abre una vez, con ese día elegido.
  useEffect(() => {
    if (revertirInicial && cual === 'puntos' && puedeAjustar && !bloqueada && puntos.datos && !abierto) {
      setAbierto(true);
      setRevertir(true);
    }
  }, [revertirInicial, cual, puedeAjustar, bloqueada, puntos.datos, abierto]);

  return (
    <Card>
      <CardHeader
        title={cual === 'puntos' ? 'Ledger de puntos' : 'Ledger de monedas'}
        description="Solo lectura. Una corrección es una fila nueva de ajuste."
        icon={Lock}
        action={
          bloqueada ? (
            <Chip tone="neutral">Cuenta dada de baja</Chip>
          ) : puedeAjustar ? (
            <div className="flex flex-wrap justify-end gap-2">
              {cual === 'puntos' && (
                <Button size="sm" variant="secondary" icon={Undo2} onClick={() => setRevertir(true)} disabled={!puntos.datos}>
                  Revertir un día
                </Button>
              )}
              <Button size="sm" icon={Plus} onClick={onAjustar}>
                Agregar ajuste
              </Button>
            </div>
          ) : (
            <Chip tone="neutral">Solo admin puede ajustar</Chip>
          )
        }
      />
      <RevertirDiaDialog open={revertir} dias={dias} inicial={revertirInicial} usuario_id={usuario_id} onClose={() => setRevertir(false)} onGuardado={onGuardado} />
      {q.estado === 'error' ? (
        <ErrorState description={q.error} onRetry={q.recargar} />
      ) : !q.datos ? (
        <Cargando />
      ) : cual === 'puntos' ? (
        <DataTable columns={COL_PUNTOS} rows={puntos.datos ?? []} rowKey={(f) => String(f.id)} caption="Ledger de puntos" empty={<EmptyState icon={Inbox} title="Todavía no tiene puntos" />} />
      ) : (
        <DataTable columns={COL_MONEDAS} rows={monedas.datos ?? []} rowKey={(f) => String(f.id)} caption="Ledger de monedas" empty={<EmptyState icon={Inbox} title="Todavía no tiene monedas" />} />
      )}
    </Card>
  );
}

/* ----------------------------------------------------------------- sync */

const ICONO_DISP: Record<Dispositivo['tipo'], typeof Smartphone> = { telefono: Smartphone, reloj: Watch, anillo: Gem, desconocido: CircleHelp };
const VERSION_ACTUAL_APP = '1.1.0';

function Diagnostico({ s }: { s: SoporteSync }) {
  const avisos: Array<{ tone: 'danger' | 'warning' | 'info' | 'success'; texto: string }> = [];
  const dias = diasSinSync(s.ultimo_sincronizado_en);
  const ausentes = s.ventana.filter((d) => !d.con_datos).length;
  if (dias === null) avisos.push({ tone: 'danger', texto: 'Nunca ha sincronizado. Revisa que haya dado permiso a Salud y que haya abierto la app.' });
  else if (dias >= 3) avisos.push({ tone: 'danger', texto: `No sincroniza desde hace ${dias} días. El sync corre al abrir la app: pídele que la abra. Pasados 14 días, esos días ya no se pueden recuperar.` });
  if (s.app_version && s.app_version !== VERSION_ACTUAL_APP) avisos.push({ tone: 'warning', texto: `Tiene la versión ${s.app_version}; la actual es ${VERSION_ACTUAL_APP}.` });
  if (s.manda_pasos_por_hora === false)
    avisos.push({
      tone: 'warning',
      texto: 'Su app no manda el total de Apple Salud (pasos_por_hora): sus pasos se calculan con las muestras, que pueden contar de más con relojes que las reescriben (Amazfit). Con la app nueva, el número es el mismo que ve en Salud.',
    });
  const atipicos = s.ventana.filter((d) => (d.pasos ?? 0) > PASOS_DIA_ATIPICO).length;
  if (atipicos > 0) avisos.push({ tone: 'warning', texto: `${atipicos === 1 ? 'Un día tiene' : `${atipicos} días tienen`} más de ${numero(PASOS_DIA_ATIPICO)} pasos: revísalo en Antifraude.` });
  if (s.dispositivos.length > 0 && !s.dispositivos.some((d) => d.mide_ritmo)) avisos.push({ tone: 'info', texto: 'No ha llegado ningún dispositivo con ritmo cardíaco: sus workouts no cuentan.' });
  if (s.descartadas.sesiones_sin_ritmo_cardiaco > 0) avisos.push({ tone: 'info', texto: `Se descartaron ${s.descartadas.sesiones_sin_ritmo_cardiaco} sesiones sin ritmo cardíaco (escritas a mano en Salud o sin reloj).` });
  if (dias !== null && dias < 3 && ausentes > 0) avisos.push({ tone: 'warning', texto: `${ausentes} de los últimos 14 días llegaron sin datos.` });
  if (avisos.length === 0) avisos.push({ tone: 'success', texto: 'El sync está al día y sin días ausentes.' });
  return (
    <div className="flex flex-col gap-2.5">
      {avisos.map((a, i) => (
        <Alert key={i} tone={a.tone}>
          {a.texto}
        </Alert>
      ))}
    </div>
  );
}

function Sync({ usuario_id }: { usuario_id: string }) {
  const s = useConsulta(() => obtenerSync(usuario_id), [usuario_id]);
  if (s.estado === 'error')
    return (
      <Card>
        <ErrorState description={s.error} onRetry={s.recargar} />
      </Card>
    );
  if (!s.datos)
    return (
      <Card>
        <Cargando />
      </Card>
    );
  const d = s.datos;
  const conDatos = d.ventana.filter((x) => x.con_datos).length;
  return (
    <div className="flex flex-col gap-5">
      <div className="grid gap-5 lg:grid-cols-[1fr_1.2fr]">
        <Card>
          <CardHeader title="Último sync" icon={RefreshCw} />
          <dl className="grid grid-cols-2 gap-4">
            <Dato label="sincronizado_en">{d.ultimo_sincronizado_en ? <UltimoSync iso={d.ultimo_sincronizado_en} /> : 'Nunca'}</Dato>
            <Dato label="Fecha y hora">{d.ultimo_sincronizado_en ? fechaHora(d.ultimo_sincronizado_en) : '—'}</Dato>
            <Dato label="app_version">
              <span className="font-mono">{d.app_version ?? '—'}</span>
            </Dato>
            <Dato label="Zona horaria">
              <span className="font-mono text-[13px]">{d.zona_horaria ?? '—'}</span>
            </Dato>
            <Dato label="Sesiones sin ritmo cardíaco">{numero(d.descartadas.sesiones_sin_ritmo_cardiaco)}</Dato>
            <Dato label="Datos imposibles">{numero(d.descartadas.datos_imposibles)}</Dato>
            <Dato label="Total de Apple Salud (pasos_por_hora)">
              {d.manda_pasos_por_hora === null ? '—' : d.manda_pasos_por_hora ? <Chip tone="success">Lo manda</Chip> : <Chip tone="warning">No lo manda</Chip>}
            </Dato>
          </dl>
        </Card>
        <Card>
          <CardHeader title="Diagnóstico" description="Lo primero que revisar si dice “no me cuenta mis pasos”." />
          <Diagnostico s={d} />
        </Card>
      </div>

      <Card>
        <CardHeader
          title="Últimos 14 días"
          icon={Footprints}
          description={`${conDatos} días con datos · ${d.ventana.length - conDatos} ausentes · ${d.ventana.filter((x) => x.cubierto).length} con el total de Salud. Es la ventana en la que un dato atrasado todavía cuenta.`}
        />
        <ol className="grid grid-cols-7 gap-2 xl:grid-cols-14">
          {d.ventana.map((dia) => {
            const atipico = (dia.pasos ?? 0) > PASOS_DIA_ATIPICO;
            return (
              <li
                key={dia.fecha}
                className={cx('flex flex-col items-center gap-0.5 rounded-inner px-1 py-2.5 text-center', !dia.con_datos ? 'bg-danger-tint' : atipico ? 'bg-warning-tint' : 'bg-primary-tint')}
                title={!dia.con_datos ? 'No llegó nada de este día' : dia.cubierto ? 'Pasos = el total de Apple Salud' : 'Pasos calculados con las muestras (regla por bloques)'}
              >
                <span className="text-[11px] font-semibold text-text-muted">{fechaCorta(dia.fecha).split(' ').slice(0, 2).join(' ')}</span>
                <span className={cx('font-display text-[13px] font-bold tabular-nums', !dia.con_datos ? 'text-danger' : atipico ? 'text-warning' : 'text-primary')}>
                  {dia.con_datos && dia.pasos !== null ? numero(dia.pasos) : 'Sin datos'}
                </span>
                {dia.con_datos && <span className="text-[10.5px] font-semibold text-text-muted">{dia.cubierto ? 'Salud' : 'muestras'}</span>}
              </li>
            );
          })}
        </ol>
      </Card>

      <Card>
        <CardHeader title="Dispositivos y fuentes" description="Los que mandaron muestras. Nombres de dispositivo: dato personal." />
        {d.dispositivos.length === 0 ? (
          <EmptyState icon={Smartphone} title="No ha llegado ninguna muestra" />
        ) : (
          <ul className="flex flex-col gap-2">
            {d.dispositivos.map((x) => {
              const Icono = ICONO_DISP[x.tipo];
              return (
                <li key={x.nombre} className="flex items-center gap-3 rounded-inner bg-surface-muted px-4 py-3">
                  <span className="grid size-9 place-items-center rounded-full bg-primary-tint text-primary">
                    <Icono size={18} aria-hidden />
                  </span>
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold">{x.nombre}</div>
                    <div className="font-mono text-[12px] text-text-muted">
                      {x.modelo} · {x.fuente_bundle}
                    </div>
                  </div>
                  <span className="text-[13px] text-text-muted">Última muestra {haceCuanto(x.ultima_muestra)}</span>
                </li>
              );
            })}
          </ul>
        )}
      </Card>
    </div>
  );
}

/* ----------------------------------------------------------------- página */

export function FichaUsuario() {
  const { usuarioId = '' } = useParams();
  const [params, setParams] = useSearchParams();
  const pestana = (params.get('tab') as Pestana | null) ?? 'resumen';
  const [vuelta, setVuelta] = useState(0);
  const [ajuste, setAjuste] = useState(false);
  const [aviso, setAviso] = useState<string>();
  const ficha = useConsulta(() => obtenerFicha(usuarioId), [usuarioId, vuelta]);

  const cambiar = (t: Pestana) => {
    const p = new URLSearchParams(params);
    if (t === 'resumen') p.delete('tab');
    else p.set('tab', t);
    setParams(p, { replace: true });
    setAviso(undefined);
  };

  const volver = (
    <Link to="/usuarios" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-muted hover:text-primary">
      <ArrowLeft size={15} aria-hidden /> Usuarios
    </Link>
  );

  if (ficha.estado === 'error' && !ficha.datos)
    return (
      <>
        {volver}
        <Card>
          <ErrorState title="No se encontró la cuenta" description={ficha.error} onRetry={ficha.recargar} />
        </Card>
      </>
    );
  if (!ficha.datos)
    return (
      <>
        {volver}
        <Cargando />
      </>
    );

  const f = ficha.datos;
  const nivelSig = NIVELES[f.nivel + 1];
  const baja = f.usuario.dado_de_baja_en;
  const guardado = (m: string) => {
    setAviso(m);
    setVuelta((v) => v + 1);
  };
  return (
    <>
      {volver}
      <PageTitle
        title={nombreDe(f.usuario)}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px]">{f.usuario.usuario_id}</span>
            {f.usuario.nombre_de_miembro && (
              <>
                · <span className="font-mono text-[13px]">{f.usuario.nombre_de_miembro}</span>
              </>
            )}
            {!baja && <>· {f.usuario.correo}</>} · <EstadoPolizaChip estado={f.estado_poliza} />
            {!baja && !f.usuario.is_active && (
              <Chip tone="neutral" dot>
                Desactivada
              </Chip>
            )}
          </span>
        }
      />

      {baja && (
        <Alert tone="warning" className="mb-5">
          Esta cuenta se dio de baja el {fechaHora(baja)}. Lo personal ya no existe; quedan los puntos, las monedas y los cupones, sin nada que diga de quién son. Ya no se puede cambiar.
        </Alert>
      )}
      {!baja && <AvisoBloqueos usuario_id={f.usuario.usuario_id} onCambio={guardado} className="mb-5" />}

      <div className="mb-6 grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard
          variant="feature"
          label="Puntos del año"
          value={numero(f.puntos_anio)}
          icon={Trophy}
          detail={nivelSig ? `${numero(nivelSig.desde - f.puntos_anio)} para el Nivel ${nivelSig.nivel}` : 'Nivel máximo'}
        />
        <MetricCard label="Nivel" value={`Nivel ${f.nivel}`} icon={Gem} detail={`${NIVELES[f.nivel]!.cashback} de cashback`} />
        <MetricCard label="Monedas" value={numero(f.saldo_monedas)} icon={Coins} detail="Saldo de la season" />
        <MetricCard label="Versión de reglas" value={f.version_regla_activa} icon={FileCheck2} detail="Activa" />
      </div>

      <Tabs
        label="Secciones de la cuenta"
        active={pestana}
        onChange={cambiar}
        tabs={[
          { key: 'resumen', label: 'Resumen' },
          { key: 'puntos', label: 'Puntos' },
          { key: 'monedas', label: 'Monedas' },
          { key: 'cupones', label: 'Cupones' },
          { key: 'sync', label: 'Sync' },
        ]}
      />

      {aviso && (
        <Alert tone="success" className="mb-4">
          {aviso}
        </Alert>
      )}

      {pestana === 'resumen' && <Resumen f={f} onCambio={guardado} />}
      {(pestana === 'puntos' || pestana === 'monedas') && (
        <>
          <Ledger
            cual={pestana}
            usuario_id={f.usuario.usuario_id}
            vuelta={vuelta}
            bloqueada={!!baja}
            revertirInicial={params.get('revertir') ?? undefined}
            onAjustar={() => setAjuste(true)}
            onGuardado={guardado}
          />
          <AjusteDialog open={ajuste} ledger={pestana} usuario_id={f.usuario.usuario_id} onClose={() => setAjuste(false)} onGuardado={guardado} />
        </>
      )}
      {pestana === 'cupones' && <CuponesDeCuenta usuario_id={f.usuario.usuario_id} />}
      {pestana === 'sync' && <Sync usuario_id={f.usuario.usuario_id} />}
    </>
  );
}
