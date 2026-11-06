import { useEffect, useState } from 'react';
import { CalendarRange, Handshake, Plus, Power, Sparkles, Trophy } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip, FilterChip } from '@/components/ui/Chip';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { SelectField, TextField } from '@/components/ui/Field';
import { LogoComercio } from '@/components/ui/Logo';
import { PageTitle } from '@/components/ui/PageTitle';
import { Alert, ErrorState } from '@/components/ui/States';
import {
  apagarPatrocinio,
  crearPatrocinio,
  NOMBRE_TIPO_PATROCINIO,
  obtenerCalendario,
  reportePatrocinio,
  sumarDias,
  ultimoDelMes,
  type Calendario,
  type DatosPatrocinio,
  type Patrocinio,
  type TipoPatrocinio,
} from '@/datos/patrocinios';
import { listarPremios } from '@/datos/premios';
import { ErrorPanel, hoyGT } from '@/datos/red';
import { puede } from '@/datos/sesion';
import { useConsulta } from '@/datos/useConsulta';
import { cx } from '@/lib/cx';
import { fecha, fechaCorta, porcentaje } from '@/lib/formato';

const fmtMes = new Intl.DateTimeFormat('es-GT', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const nombreMes = (m: string) => {
  const t = fmtMes.format(new Date(`${m}T12:00:00Z`)).replace(' de ', ' ');
  return t.charAt(0).toUpperCase() + t.slice(1);
};

/* ----------------------------------------------------------------- vender */

function Vender({ inicial, cal, onClose, onCreado }: { inicial: Partial<DatosPatrocinio> | null; cal: Calendario; onClose: () => void; onCreado: (m: string) => void }) {
  const premios = useConsulta(() => listarPremios({ estado: 'activos' }));
  const [d, setD] = useState<DatosPatrocinio>({ tipo: 'semana', premio_id: 0, desde: '', hasta: '', cupon: '', acento: '' });
  const [error, setError] = useState<ErrorPanel>();
  const [guardando, setGuardando] = useState(false);

  useEffect(() => {
    if (inicial) {
      setD({ tipo: 'semana', premio_id: 0, desde: '', hasta: '', cupon: '', acento: '', ...inicial });
      setError(undefined);
    }
  }, [inicial]);

  if (!inicial) return null;
  const e = error?.campos ?? {};
  const set = (c: Partial<DatosPatrocinio>) => setD((x) => ({ ...x, ...c }));
  const semanasLibres = cal.semanas.filter((s) => !s.patrocinio && !s.ya_paso);
  const mesesLibres = cal.meses.filter((m) => !m.patrocinio && !m.ya_paso);
  const conLogo = (premios.datos ?? []).filter((p) => p.foto);

  const guardar = async () => {
    setGuardando(true);
    setError(undefined);
    try {
      const p = await crearPatrocinio(d);
      onCreado(`${p.comercio}: ${NOMBRE_TIPO_PATROCINIO[p.tipo].toLowerCase()} del ${fecha(p.desde)} al ${fecha(p.hasta)}.`);
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
      title="Vender un patrocinio"
      description="La marca, el logo y el fondo salen del premio del comercio."
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
        <div className="flex flex-wrap gap-2" role="group" aria-label="Qué se vende">
          {(['semana', 'liga', 'destacado'] as TipoPatrocinio[]).map((t) => (
            <FilterChip key={t} selected={d.tipo === t} onClick={() => set({ tipo: t, desde: '', hasta: '' })}>
              {NOMBRE_TIPO_PATROCINIO[t]}
            </FilterChip>
          ))}
        </div>
        <SelectField label="Comercio" value={d.premio_id || ''} onChange={(x) => set({ premio_id: Number(x.target.value) })} error={e.premio_id}>
          <option value="" disabled>
            Elige un comercio
          </option>
          {conLogo.map((p) => (
            <option key={p.id} value={p.id}>
              {p.comercio_aliado}
            </option>
          ))}
        </SelectField>
        {d.tipo === 'semana' && (
          <SelectField
            label="Semana"
            value={d.desde}
            onChange={(x) => set({ desde: x.target.value, hasta: x.target.value ? sumarDias(x.target.value, 6) : '' })}
            error={e.desde}
            hint="Solo las libres que todavía no pasan."
          >
            <option value="" disabled>
              Elige la semana
            </option>
            {semanasLibres.map((s) => (
              <option key={s.desde} value={s.desde}>
                Semana {s.numero} · {fechaCorta(s.desde)} – {fechaCorta(s.hasta)}
              </option>
            ))}
          </SelectField>
        )}
        {d.tipo === 'liga' && (
          <SelectField label="Mes de La Liga" value={d.desde} onChange={(x) => set({ desde: x.target.value, hasta: x.target.value ? ultimoDelMes(x.target.value) : '' })} error={e.desde}>
            <option value="" disabled>
              Elige el mes
            </option>
            {mesesLibres.map((m) => (
              <option key={m.mes} value={m.mes}>
                {nombreMes(m.mes)}
              </option>
            ))}
          </SelectField>
        )}
        {d.tipo === 'destacado' && (
          <div className="grid grid-cols-2 gap-3">
            <TextField label="Desde" type="date" value={d.desde} onChange={(x) => set({ desde: x.target.value })} error={e.desde} />
            <TextField label="Hasta" type="date" value={d.hasta} onChange={(x) => set({ hasta: x.target.value })} error={e.hasta} />
          </div>
        )}
        {d.tipo !== 'destacado' && (
          <TextField
            label="Cupón que se gana"
            value={d.cupon}
            onChange={(x) => set({ cupon: x.target.value })}
            error={e.cupon}
            placeholder="2x1 en sushi"
            hint={d.tipo === 'semana' ? 'Lo gana quien completa la semana.' : 'Lo gana el podio, además de sus monedas.'}
          />
        )}
        <div className="flex flex-col gap-1.5">
          <label htmlFor="acento" className="text-[13px] font-semibold">
            Color de la marca
          </label>
          <div className="flex gap-2">
            <input
              type="color"
              aria-label="Elegir color"
              value={/^#[0-9a-fA-F]{6}$/.test(d.acento) ? d.acento : '#022196'}
              onChange={(x) => set({ acento: x.target.value.toUpperCase() })}
              className="h-10 w-12 cursor-pointer rounded-field border border-border bg-surface p-1"
            />
            <input
              id="acento"
              value={d.acento}
              onChange={(x) => set({ acento: x.target.value })}
              placeholder="Vacío = el azul de +vida"
              className={`h-10 min-w-0 flex-1 rounded-field border bg-surface px-3 font-mono text-[12.5px] outline-none focus:border-primary ${e.acento ? 'border-danger' : 'border-border'}`}
            />
          </div>
          {e.acento && <p className="text-[12.5px] text-danger">{e.acento}</p>}
        </div>
        {error && !error.campos && <Alert tone="danger">{error.message}</Alert>}
      </div>
    </Dialog>
  );
}

/* ----------------------------------------------------------------- detalle */

function Detalle({ p, onClose, onApagado }: { p: Patrocinio | null; onClose: () => void; onApagado: (m: string) => void }) {
  const reporte = useConsulta(() => (p ? reportePatrocinio(p.id) : Promise.resolve(null)), [p?.id]);
  const [apagar, setApagar] = useState(false);
  const [error, setError] = useState<string>();
  if (!p) return null;
  const r = reporte.datos;
  return (
    <Dialog open onClose={onClose} title={`${p.comercio} · ${NOMBRE_TIPO_PATROCINIO[p.tipo]}`} description={`Del ${fecha(p.desde)} al ${fecha(p.hasta)}`}>
      <div className="flex flex-col gap-4">
        <div className="flex items-center gap-3">
          <LogoComercio foto={p.logo} fondo={p.fondo} nombre={p.comercio} size="lg" />
          <div>
            {p.cupon && <div className="font-display text-lg font-bold">{p.cupon}</div>}
            <div className="flex items-center gap-2 text-[13px] text-text-muted">
              {p.acento && <span className="size-3.5 rounded-full border border-border" style={{ background: p.acento }} aria-hidden />}
              {p.acento || 'Azul de +vida'}
            </div>
          </div>
        </div>
        {p.tipo !== 'destacado' && (
          <div>
            <div className="mb-2 text-[12px] font-bold tracking-[0.08em] text-text-muted uppercase">Reporte para el comercio</div>
            {reporte.estado === 'error' ? (
              <ErrorState description={reporte.error} onRetry={reporte.recargar} />
            ) : !r ? (
              <div className="h-16 animate-pulse rounded-inner bg-surface-muted" />
            ) : r.ganados === 0 ? (
              <Alert tone="info">Todavía no se ha dado ningún cupón: se dan al cerrar {p.tipo === 'semana' ? 'la semana (martes)' : 'el mes (día 9)'}.</Alert>
            ) : (
              <div className="grid grid-cols-3 gap-2">
                {[
                  ['Ganaron el cupón', r.ganados],
                  ['Lo usaron', `${r.usados} · ${porcentaje(r.usados, r.ganados)}`],
                  ['Vencidos', r.vencidos],
                ].map(([l, v]) => (
                  <div key={String(l)} className="rounded-inner bg-surface-muted px-3 py-2.5">
                    <div className="text-[12px] text-text-muted">{l}</div>
                    <div className="font-display text-lg font-bold tabular-nums">{v}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        )}
        {error && <Alert tone="danger">{error}</Alert>}
        {puede('editar_patrocinios') && p.activo && (
          <Button variant="secondary" icon={Power} onClick={() => setApagar(true)} className="self-start">
            Apagar patrocinio
          </Button>
        )}
      </div>
      <ConfirmDialog
        open={apagar}
        title="¿Apagar este patrocinio?"
        body="Sale de la app (la semana o el mes quedan libres). Los cupones que ya se ganaron siguen valiendo."
        confirmLabel="Apagar"
        onCancel={() => setApagar(false)}
        onConfirm={async () => {
          try {
            await apagarPatrocinio(p.id);
            setApagar(false);
            onApagado(`Patrocinio de ${p.comercio} apagado.`);
            onClose();
          } catch (x) {
            setError(x instanceof ErrorPanel ? x.message : 'No se pudo apagar.');
            setApagar(false);
          }
        }}
      />
    </Dialog>
  );
}

/* ----------------------------------------------------------------- página */

function Casilla({ titulo, sub, p, ya_paso, onVer, onVender }: { titulo: string; sub: string; p: Patrocinio | null; ya_paso: boolean; onVer: (p: Patrocinio) => void; onVender?: () => void }) {
  if (p)
    return (
      <button type="button" onClick={() => onVer(p)} className={cx('flex flex-col gap-2 rounded-inner border border-transparent bg-primary-tint p-3 text-left transition-colors hover:border-primary-soft', ya_paso && 'opacity-70')}>
        <div className="flex items-center justify-between gap-2">
          <span className="text-[12px] font-bold text-primary">{titulo}</span>
          <span className="text-[11px] text-text-muted">{sub}</span>
        </div>
        <div className="flex items-center gap-2">
          <LogoComercio foto={p.logo} fondo={p.fondo} nombre={p.comercio} size="sm" />
          <div className="min-w-0">
            <div className="truncate text-[13px] font-semibold">{p.comercio}</div>
            <div className="truncate text-[11.5px] text-text-muted">{p.cupon}</div>
          </div>
        </div>
      </button>
    );
  return (
    <div className={cx('flex flex-col justify-between gap-2 rounded-inner border border-dashed border-border p-3', ya_paso && 'opacity-50')}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-bold text-text-muted">{titulo}</span>
        <span className="text-[11px] text-text-muted">{sub}</span>
      </div>
      {ya_paso ? (
        <span className="text-[12.5px] text-text-muted">Pasó sin patrocinio</span>
      ) : onVender ? (
        <button type="button" onClick={onVender} className="inline-flex w-fit items-center gap-1 rounded-full px-2 py-0.5 text-[12.5px] font-semibold text-primary hover:bg-primary-tint">
          <Plus size={13} aria-hidden /> Libre: vender
        </button>
      ) : (
        <span className="text-[12.5px] font-semibold text-success">Libre</span>
      )}
    </div>
  );
}

export function Patrocinios() {
  const [vuelta, setVuelta] = useState(0);
  const cal = useConsulta(obtenerCalendario, [vuelta]);
  const [vender, setVender] = useState<Partial<DatosPatrocinio> | null>(null);
  const [viendo, setViendo] = useState<Patrocinio | null>(null);
  const [aviso, setAviso] = useState<string>();
  const admin = puede('editar_patrocinios');
  const hoy = hoyGT();
  const c = cal.datos;
  const listo = (m: string) => {
    setAviso(m);
    setVuelta((v) => v + 1);
  };

  return (
    <>
      <PageTitle
        title="Patrocinios"
        description="Lo que compran los comercios: una semana (cupón a quien la completa), un mes de La Liga (cupón al podio) o destacar su premio en la Tienda."
        actions={
          admin ? (
            <Button icon={Plus} onClick={() => setVender({})}>
              Vender patrocinio
            </Button>
          ) : undefined
        }
      />
      {aviso && (
        <Alert tone="success" className="mb-5">
          {aviso}
        </Alert>
      )}
      {cal.estado === 'error' ? (
        <Card>
          <ErrorState description={cal.error} onRetry={cal.recargar} />
        </Card>
      ) : !c ? (
        <div className="h-80 animate-pulse rounded-card bg-surface shadow-card" />
      ) : (
        <div className="flex flex-col gap-5">
          <Card>
            <CardHeader
              icon={CalendarRange}
              title="Semanas de la season"
              description={`${c.semanas.filter((s) => s.patrocinio).length} vendidas · ${c.semanas.filter((s) => !s.patrocinio && !s.ya_paso).length} libres por delante`}
            />
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-5 xl:grid-cols-7">
              {c.semanas.map((s) => (
                <Casilla
                  key={s.desde}
                  titulo={`Semana ${s.numero}`}
                  sub={fechaCorta(s.desde).split(' ').slice(1).join(' ')}
                  p={s.patrocinio}
                  ya_paso={s.ya_paso}
                  onVer={setViendo}
                  onVender={admin ? () => setVender({ tipo: 'semana', desde: s.desde, hasta: s.hasta }) : undefined}
                />
              ))}
            </div>
          </Card>

          <div className="grid items-start gap-5 xl:grid-cols-2">
            <Card>
              <CardHeader icon={Trophy} title="La Liga, mes por mes" />
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                {c.meses.map((m) => (
                  <Casilla
                    key={m.mes}
                    titulo={nombreMes(m.mes)}
                    sub=""
                    p={m.patrocinio}
                    ya_paso={m.ya_paso}
                    onVer={setViendo}
                    onVender={admin ? () => setVender({ tipo: 'liga', desde: m.mes, hasta: m.hasta }) : undefined}
                  />
                ))}
              </div>
            </Card>
            <Card>
              <CardHeader icon={Sparkles} title="Premios destacados" description="Su card sale ancha en el mosaico de la Tienda." />
              {c.destacados.length === 0 ? (
                <p className="text-[13px] text-text-muted">Ningún premio destacado. La Tienda se ve bien igual.</p>
              ) : (
                <ul className="flex flex-col gap-2">
                  {c.destacados.map((p) => {
                    const estado = !p.activo ? 'Apagado' : p.hasta < hoy ? 'Terminó' : p.desde > hoy ? 'Programado' : 'Vigente';
                    return (
                      <li key={p.id}>
                        <button type="button" onClick={() => setViendo(p)} className="flex w-full items-center gap-3 rounded-inner bg-surface-muted px-3 py-2.5 text-left hover:bg-primary-tint">
                          <LogoComercio foto={p.logo} fondo={p.fondo} nombre={p.comercio} size="sm" />
                          <div className="min-w-0 flex-1">
                            <div className="font-semibold">{p.comercio}</div>
                            <div className="text-[12px] text-text-muted">
                              {fecha(p.desde)} – {fecha(p.hasta)}
                            </div>
                          </div>
                          <Chip tone={estado === 'Vigente' ? 'success' : estado === 'Programado' ? 'primary' : 'neutral'} dot>
                            {estado}
                          </Chip>
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
            </Card>
          </div>
        </div>
      )}
      {c && vender && <Vender inicial={vender} cal={c} onClose={() => setVender(null)} onCreado={listo} />}
      <Detalle p={viendo} onClose={() => setViendo(null)} onApagado={listo} />
      {!admin && c && (
        <Alert tone="info" className="mt-5">
          <span className="inline-flex items-center gap-1.5">
            <Handshake size={14} aria-hidden /> Tu rol solo puede ver los patrocinios.
          </span>
        </Alert>
      )}
    </>
  );
}
