import { useEffect, useState } from 'react';
import { Link, useNavigate, useParams } from 'react-router';
import { ArrowLeft, Coins, Save, Ticket } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, MetricCard } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { PageTitle } from '@/components/ui/PageTitle';
import { PremioCard } from '@/components/ui/Preview';
import { Alert, ErrorState } from '@/components/ui/States';
import '@/datos/cupones';
import '@/datos/patrocinios';
import { CATEGORIAS, guardarPremio, listarPremios, obtenerPremio, urlLogo, validarPremio, type DatosPremio } from '@/datos/premios';
import { ErrorPanel } from '@/datos/red';
import { puede } from '@/datos/sesion';
import { useConsulta } from '@/datos/useConsulta';
import { numero } from '@/lib/formato';

const VACIO: DatosPremio = {
  nombre: '',
  comercio_aliado: '',
  descripcion: '',
  costo_monedas: 30,
  zona: 'Guatemala',
  categoria: 'Restaurantes',
  detalle: '',
  condiciones: '',
  foto: '',
  fondo: '',
  activo: true,
  vigente_hasta: null,
  cupo: null,
};

/** Lo que ve la persona al tocar la card en la app. */
function DetalleApp({ d }: { d: DatosPremio }) {
  const logo = urlLogo(d.foto);
  return (
    <div className="overflow-hidden rounded-[18px] border border-border bg-surface">
      <div className="grid h-28 place-items-center" style={d.fondo ? { background: d.fondo } : { background: 'var(--color-surface-muted)' }}>
        {logo ? <img src={logo} alt="" className="max-h-16 max-w-[60%] object-contain" /> : <span className="text-[12px] text-text-muted">Sin logo</span>}
      </div>
      <div className="flex flex-col gap-2 p-4">
        <div className="flex items-start justify-between gap-3">
          <div>
            <div className="font-display text-[17px] leading-tight font-bold">{d.descripcion || 'Qué recibe la persona'}</div>
            <div className="text-[12.5px] font-bold text-secondary">
              {d.comercio_aliado || 'Comercio'} · {d.zona || 'Guatemala'}
            </div>
          </div>
          <span className="flex items-center gap-1 font-display font-bold text-coin tabular-nums">
            <Coins size={16} aria-hidden /> {Number.isFinite(d.costo_monedas) ? d.costo_monedas : '—'}
          </span>
        </div>
        {d.detalle && <p className="text-[13px]">{d.detalle}</p>}
        {d.condiciones && <p className="text-[12px] text-text-muted">{d.condiciones}</p>}
        <div className="text-[12px] text-text-muted">El cupón dura 21 días desde que se canjea.</div>
      </div>
    </div>
  );
}

export function EditarPremio() {
  const { premioId } = useParams();
  const nuevo = !premioId || premioId === 'nuevo';
  const id = nuevo ? null : Number(premioId);
  const ir = useNavigate();
  const admin = puede('editar_premios');
  const premio = useConsulta(() => (id === null ? Promise.resolve(null) : obtenerPremio(id)), [id]);
  // Los logos que ya existen, para elegir sin escribir la ruta.
  const catalogo = useConsulta(() => listarPremios({ estado: 'todos' }));
  const [d, setD] = useState<DatosPremio>(VACIO);
  const [error, setError] = useState<ErrorPanel>();
  const [guardando, setGuardando] = useState(false);
  const [aviso, setAviso] = useState<string>();

  useEffect(() => {
    if (premio.datos) {
      const { id: _id, canjeados: _c, usados: _u, destacado: _d, ...resto } = premio.datos;
      setD(resto);
    }
  }, [premio.datos]);

  const campo = <K extends keyof DatosPremio>(k: K, v: DatosPremio[K]) => {
    setD((x) => ({ ...x, [k]: v }));
    setAviso(undefined);
  };
  const errores = error?.campos ?? {};
  const vivos = validarPremio(d);

  const guardar = async () => {
    setGuardando(true);
    setError(undefined);
    try {
      const p = await guardarPremio(id, d);
      if (nuevo) ir(`/premios/${p.id}`, { replace: true });
      setAviso(nuevo ? 'Premio creado. Ya sale en la Tienda.' : 'Cambios guardados.');
      premio.recargar();
    } catch (e) {
      setError(e instanceof ErrorPanel ? e : new ErrorPanel('No se pudo guardar.'));
    } finally {
      setGuardando(false);
    }
  };

  const volver = (
    <Link to="/premios" className="mb-4 inline-flex items-center gap-1.5 text-[13px] font-semibold text-text-muted hover:text-primary">
      <ArrowLeft size={15} aria-hidden /> Premios
    </Link>
  );

  if (!nuevo && premio.estado === 'error')
    return (
      <>
        {volver}
        <Card>
          <ErrorState title="No se encontró el premio" description={premio.error} onRetry={premio.recargar} />
        </Card>
      </>
    );
  if (!nuevo && !premio.datos)
    return (
      <>
        {volver}
        <div className="h-96 animate-pulse rounded-card bg-surface shadow-card" />
      </>
    );

  const logos = [...new Map((catalogo.datos ?? []).filter((p) => p.foto).map((p) => [p.foto, p.nombre])).entries()];

  return (
    <>
      {volver}
      <PageTitle
        title={nuevo ? 'Nuevo' : d.nombre || 'Premio'}
        accent={nuevo ? 'premio' : undefined}
        description={nuevo ? 'Así se va a ver en la Tienda mientras lo llenas.' : undefined}
        actions={
          admin ? (
            <Button icon={Save} onClick={guardar} disabled={guardando}>
              {guardando ? 'Guardando…' : nuevo ? 'Crear premio' : 'Guardar cambios'}
            </Button>
          ) : undefined
        }
      />
      {!admin && (
        <Alert tone="info" className="mb-5">
          Tu rol solo puede ver los premios.
        </Alert>
      )}
      {aviso && (
        <Alert tone="success" className="mb-5">
          {aviso}
        </Alert>
      )}
      {error && !error.campos && (
        <Alert tone="danger" className="mb-5">
          {error.message}
        </Alert>
      )}

      {premio.datos && (
        <div className="mb-5 grid gap-4 sm:grid-cols-3">
          <MetricCard variant="feature" label="Cupones canjeados" value={numero(premio.datos.canjeados)} icon={Ticket} detail={premio.datos.cupo ? `de un cupo de ${premio.datos.cupo}` : 'Sin cupo'} />
          <MetricCard label="Usados en el comercio" value={numero(premio.datos.usados)} icon={Ticket} detail={premio.datos.canjeados ? `${Math.round((premio.datos.usados / premio.datos.canjeados) * 100)} % de los canjeados` : '—'} />
          <Card className="flex flex-col justify-between gap-3 p-5">
            <span className="text-[13px] font-semibold text-text-muted">Estado</span>
            <div className="flex flex-wrap gap-2">
              {premio.datos.activo ? <Chip tone="success" dot>En la Tienda</Chip> : <Chip tone="neutral" dot>Archivado</Chip>}
              {premio.datos.destacado && <Chip tone="coin">Destacado</Chip>}
            </div>
            <Link to={`/cupones?premio=${premio.datos.id}`} className="text-[13px] font-semibold text-primary hover:underline">
              Ver sus cupones →
            </Link>
          </Card>
        </div>
      )}

      <div className="grid items-start gap-5 xl:grid-cols-[1fr_360px]">
        <Card>
          <fieldset disabled={!admin} className="grid gap-4 md:grid-cols-2">
            <TextField label="Nombre" value={d.nombre} onChange={(e) => campo('nombre', e.target.value)} error={errores.nombre} hint="Como sale en la card." />
            <TextField label="Comercio" value={d.comercio_aliado} onChange={(e) => campo('comercio_aliado', e.target.value)} error={errores.comercio_aliado} />
            <TextField
              label="Qué recibe la persona"
              value={d.descripcion}
              onChange={(e) => campo('descripcion', e.target.value)}
              error={errores.descripcion}
              placeholder="2x1 en sushi"
              className="md:col-span-2"
            />
            <SelectField label="Categoría" value={d.categoria} onChange={(e) => campo('categoria', e.target.value)}>
              {CATEGORIAS.map((c) => (
                <option key={c}>{c}</option>
              ))}
            </SelectField>
            <TextField
              label="Costo en monedas"
              type="number"
              min={0}
              value={Number.isFinite(d.costo_monedas) ? d.costo_monedas : ''}
              onChange={(e) => campo('costo_monedas', e.target.value === '' ? NaN : Number(e.target.value))}
              error={errores.costo_monedas ?? (vivos.costo_monedas && d.costo_monedas !== VACIO.costo_monedas ? vivos.costo_monedas : undefined)}
            />
            <TextField
              label="Cupo"
              type="number"
              min={1}
              value={d.cupo ?? ''}
              onChange={(e) => campo('cupo', e.target.value === '' ? null : Number(e.target.value))}
              error={errores.cupo}
              hint="Cuántos cupones puede dar el comercio. Vacío: sin límite."
            />
            <TextField
              label="Se puede canjear hasta"
              type="date"
              value={d.vigente_hasta ?? ''}
              onChange={(e) => campo('vigente_hasta', e.target.value || null)}
              hint="Vacío: sin fecha."
            />
            <TextField label="Zona" value={d.zona} onChange={(e) => campo('zona', e.target.value)} error={errores.zona} />
            <div className="flex flex-col gap-1.5">
              <label htmlFor="logo" className="text-[13px] font-semibold">
                Logo
              </label>
              <input
                id="logo"
                list="logos"
                value={d.foto}
                onChange={(e) => campo('foto', e.target.value)}
                placeholder="assets/img/premios/…"
                className="h-10 rounded-field border border-border bg-surface px-3 font-mono text-[12.5px] outline-none focus:border-primary"
              />
              <datalist id="logos">
                {logos.map(([foto, nombre]) => (
                  <option key={foto} value={foto}>
                    {nombre}
                  </option>
                ))}
              </datalist>
              <p className="text-[12.5px] text-text-muted">La ruta del logo dentro de la app. Sin logo no puede patrocinar.</p>
            </div>
            <div className="flex flex-col gap-1.5">
              <label htmlFor="fondo" className="text-[13px] font-semibold">
                Fondo del logo
              </label>
              <div className="flex gap-2">
                <input
                  type="color"
                  aria-label="Elegir color"
                  value={/^#[0-9a-fA-F]{6}$/.test(d.fondo) ? d.fondo : '#ffffff'}
                  onChange={(e) => campo('fondo', e.target.value.toUpperCase())}
                  className="h-10 w-12 cursor-pointer rounded-field border border-border bg-surface p-1"
                />
                <input
                  id="fondo"
                  value={d.fondo}
                  onChange={(e) => campo('fondo', e.target.value)}
                  placeholder="Vacío = blanco"
                  className={`h-10 min-w-0 flex-1 rounded-field border bg-surface px-3 font-mono text-[12.5px] outline-none focus:border-primary ${errores.fondo ? 'border-danger' : 'border-border'}`}
                />
              </div>
              <p className={`text-[12.5px] ${errores.fondo ? 'text-danger' : 'text-text-muted'}`}>{errores.fondo ?? 'Solo para logos claros que sobre blanco desaparecen.'}</p>
            </div>
            <TextAreaField label="Detalle" value={d.detalle} onChange={(e) => campo('detalle', e.target.value)} className="md:col-span-2" />
            <TextAreaField label="Condiciones" value={d.condiciones} onChange={(e) => campo('condiciones', e.target.value)} className="md:col-span-2" />
          </fieldset>
        </Card>

        <div className="flex flex-col gap-5 xl:sticky xl:top-24">
          <Card>
            <CardHeader title="Así se ve en la Tienda" />
            <div className="flex justify-center">
              <PremioCard
                nombre={d.nombre || 'Nombre'}
                categoria={d.categoria}
                costoMonedas={Number.isFinite(d.costo_monedas) ? d.costo_monedas : 0}
                comercio={d.comercio_aliado || 'Comercio'}
                logoUrl={urlLogo(d.foto)}
                fondo={d.fondo || undefined}
                apagado={!d.activo}
              />
            </div>
          </Card>
          <Card>
            <CardHeader title="Al tocarla" />
            <DetalleApp d={d} />
          </Card>
        </div>
      </div>
    </>
  );
}
