import { useState, type ReactNode } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import { ArrowLeft, Coins, FileCheck2, Footprints, Lock, Plus, Smartphone, Watch, CircleHelp, Gem, RefreshCw, Trophy, Inbox } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, MetricCard } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { LevelBadge, NIVELES } from '@/components/ui/Niveles';
import { PageTitle } from '@/components/ui/PageTitle';
import { Alert, EmptyState, ErrorState } from '@/components/ui/States';
import { DataTable, type Column } from '@/components/ui/Table';
import { Tabs } from '@/components/ui/Tabs';
import {
  listarLedgerMonedas,
  listarLedgerPuntos,
  nombreDe,
  NOMBRE_TIPO_LEDGER,
  NOMBRE_TIPO_MONEDA,
  obtenerFicha,
  obtenerSync,
  type Dispositivo,
  type FichaUsuario as Ficha,
  type FilaLedger,
  type FilaMonedas,
  type SoporteSync,
} from '@/datos/cuentas';
import { puede } from '@/datos/sesion';
import { useConsulta } from '@/datos/useConsulta';
import { cx } from '@/lib/cx';
import { conSigno, fecha, fechaCorta, fechaHora, haceCuanto, numero } from '@/lib/formato';
import { AjusteDialog } from './AjusteDialog';
import { CuponesDeCuenta } from './CuponesDeCuenta';
import { diasSinSync, EstadoPolizaChip, motivoRechazo, RetroactivoChip, UltimoSync } from './comun';

type Pestana = 'resumen' | 'puntos' | 'monedas' | 'cupones' | 'sync';

function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] font-semibold text-text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

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

function Resumen({ f }: { f: Ficha }) {
  const p = f.usuario.poliza;
  return (
    <div className="grid gap-5 lg:grid-cols-[1.3fr_1fr]">
      <Card>
        <CardHeader
          title="Póliza"
          icon={FileCheck2}
          action={
            p?.estado_verificacion === 'pendiente' ? (
              <Link to={`/polizas?u=${f.usuario.usuario_id}`} className="inline-flex h-8 items-center rounded-full bg-primary px-3.5 text-[13px] font-semibold text-white hover:bg-primary-deep">
                Verificar
              </Link>
            ) : undefined
          }
        />
        {!p ? (
          <EmptyState icon={FileCheck2} title="No ha vinculado una póliza" description="Gana puntos y monedas, pero no canjea ni entra a La Liga." />
        ) : (
          <>
            <div className="mb-4 flex flex-wrap items-center gap-2">
              <EstadoPolizaChip estado={f.estado_poliza} />
              <RetroactivoChip r={p.retroactivo} />
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
          </>
        )}
      </Card>
      <Card>
        <CardHeader title="Cuenta" />
        <dl className="grid gap-4">
          <Dato label="usuario_id">
            <span className="font-mono">{f.usuario.usuario_id}</span>
          </Dato>
          <Dato label="Correo">{f.usuario.correo}</Dato>
          <Dato label="Creada">{fechaHora(f.usuario.creado_en)}</Dato>
          <Dato label="Estado">{f.usuario.is_active ? <Chip tone="success" dot>Activa</Chip> : <Chip tone="neutral" dot>Desactivada</Chip>}</Dato>
          <Dato label="Nivel">
            <LevelBadge nivel={f.nivel} withCashback />
          </Dato>
        </dl>
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

function Ledger({ cual, usuario_id, vuelta, onAjustar }: { cual: 'puntos' | 'monedas'; usuario_id: string; vuelta: number; onAjustar: () => void }) {
  const puntos = useConsulta(() => listarLedgerPuntos(usuario_id), [usuario_id, vuelta, cual]);
  const monedas = useConsulta(() => listarLedgerMonedas(usuario_id), [usuario_id, vuelta, cual]);
  const q = cual === 'puntos' ? puntos : monedas;
  return (
    <Card>
      <CardHeader
        title={cual === 'puntos' ? 'Ledger de puntos' : 'Ledger de monedas'}
        description="Solo lectura. Una corrección es una fila nueva de ajuste."
        icon={Lock}
        action={
          puede('ajustar_ledger') ? (
            <Button size="sm" icon={Plus} onClick={onAjustar}>
              Agregar ajuste
            </Button>
          ) : (
            <Chip tone="neutral">Solo admin puede ajustar</Chip>
          )
        }
      />
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
          </dl>
        </Card>
        <Card>
          <CardHeader title="Diagnóstico" description="Lo primero que revisar si dice “no me cuenta mis pasos”." />
          <Diagnostico s={d} />
        </Card>
      </div>

      <Card>
        <CardHeader title="Últimos 14 días" icon={Footprints} description={`${conDatos} días con datos · ${d.ventana.length - conDatos} ausentes. Es la ventana en la que un dato atrasado todavía cuenta.`} />
        <ol className="grid grid-cols-7 gap-2 xl:grid-cols-14">
          {d.ventana.map((dia) => (
            <li
              key={dia.fecha}
              className={cx('flex flex-col items-center gap-0.5 rounded-inner px-1 py-2.5 text-center', dia.con_datos ? 'bg-primary-tint' : 'bg-danger-tint')}
            >
              <span className="text-[11px] font-semibold text-text-muted">{fechaCorta(dia.fecha).split(' ').slice(0, 2).join(' ')}</span>
              <span className={cx('font-display text-[13px] font-bold tabular-nums', dia.con_datos ? 'text-primary' : 'text-danger')}>
                {dia.con_datos && dia.pasos !== null ? numero(dia.pasos) : 'Sin datos'}
              </span>
            </li>
          ))}
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
  return (
    <>
      {volver}
      <PageTitle
        title={nombreDe(f.usuario)}
        description={
          <span className="flex flex-wrap items-center gap-2">
            <span className="font-mono text-[13px]">{f.usuario.usuario_id}</span> · {f.usuario.correo} · <EstadoPolizaChip estado={f.estado_poliza} />
          </span>
        }
      />

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

      {pestana === 'resumen' && <Resumen f={f} />}
      {(pestana === 'puntos' || pestana === 'monedas') && (
        <>
          <Ledger cual={pestana} usuario_id={f.usuario.usuario_id} vuelta={vuelta} onAjustar={() => setAjuste(true)} />
          <AjusteDialog
            open={ajuste}
            ledger={pestana}
            usuario_id={f.usuario.usuario_id}
            onClose={() => setAjuste(false)}
            onGuardado={(m) => {
              setAviso(m);
              setVuelta((v) => v + 1);
            }}
          />
        </>
      )}
      {pestana === 'cupones' && <CuponesDeCuenta usuario_id={f.usuario.usuario_id} />}
      {pestana === 'sync' && <Sync usuario_id={f.usuario.usuario_id} />}
    </>
  );
}
