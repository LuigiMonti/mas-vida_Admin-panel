import { useEffect, useState, type ReactNode } from 'react';
import { Link } from 'react-router';
import {
  Activity,
  CalendarClock,
  Check,
  Download,
  FileCheck2,
  Footprints,
  Gift,
  Inbox,
  LogOut,
  Pencil,
  Plus,
  Ticket,
  Undo2,
  Users,
} from 'lucide-react';
import { HeaderTab } from '@/components/layout/AppShell';
import { Button, DangerButton } from '@/components/ui/Button';
import { Card, CardHeader, IconCircle, MetricCard } from '@/components/ui/Card';
import { Chip, FilterChip } from '@/components/ui/Chip';
import { SearchInput, SelectField, TextAreaField, TextField } from '@/components/ui/Field';
import { LevelBadge, TierBadge, TierRow, type Nivel } from '@/components/ui/Niveles';
import { PageTitle } from '@/components/ui/PageTitle';
import { LigaBanner, PremioCard, RankingRow, WeekRow } from '@/components/ui/Preview';
import { Avatar, ProgressBar, StepNumber } from '@/components/ui/Progress';
import { Alert, EmptyState, ErrorState } from '@/components/ui/States';
import { DataTable, type Column } from '@/components/ui/Table';
import { numero } from '@/lib/formato';

const SECCIONES = [
  { id: 'tokens', label: 'Tokens' },
  { id: 'componentes', label: 'Componentes' },
  { id: 'tabla', label: 'Tabla y estados' },
  { id: 'vistas', label: 'Vistas previas' },
  { id: 'layout', label: 'Layout' },
] as const;

/** Pestañas del header: se marca la sección que está a la vista. */
export function EstiloTabs() {
  const [activa, setActiva] = useState<string>(SECCIONES[0].id);
  useEffect(() => {
    const obs = new IntersectionObserver(
      (entries) => {
        const visible = entries.filter((e) => e.isIntersecting).sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top)[0];
        if (visible) setActiva(visible.target.id);
      },
      { rootMargin: '-120px 0px -60% 0px' },
    );
    SECCIONES.forEach((s) => {
      const el = document.getElementById(s.id);
      if (el) obs.observe(el);
    });
    return () => obs.disconnect();
  }, []);
  return (
    <>
      {SECCIONES.map((s) => (
        <HeaderTab key={s.id} href={`#${s.id}`} active={activa === s.id}>
          {s.label}
        </HeaderTab>
      ))}
    </>
  );
}

/* ------------------------------------------------------------------ datos de muestra */

interface Swatch {
  token: string;
  valor: string;
  uso: string;
  origen: 'web' | 'app' | 'panel';
}

const MARCA: Swatch[] = [
  { token: 'primary', valor: '#022196', uso: 'Botones, links activos, barras, acento del título', origen: 'web' },
  { token: 'primary-deep', valor: 'primary 78 % + negro', uso: 'Barra lateral, cards destacadas', origen: 'web' },
  { token: 'primary-tint', valor: 'primary 8 % + blanco', uso: 'Chips, fondos de ícono, primer puesto', origen: 'web' },
  { token: 'primary-tint-strong', valor: '#E4E9F8', uso: 'Fila seleccionada, filtro activo', origen: 'app' },
  { token: 'primary-soft', valor: '#B9C4E8', uso: 'Borde de botón secundario', origen: 'app' },
  { token: 'secondary', valor: '#5767BC', uso: 'Texto e íconos de apoyo en azul', origen: 'web' },
];
const SUPERFICIES: Swatch[] = [
  { token: 'surface', valor: '#FFFFFF', uso: 'Cards, tablas', origen: 'web' },
  { token: 'surface-muted', valor: '#F5F6F8', uso: 'Fondo de página y de secciones', origen: 'web' },
  { token: 'border', valor: '#E3E6F0', uso: 'Inputs, separadores', origen: 'app' },
  { token: 'text', valor: '#0A0A0A', uso: 'Texto', origen: 'web' },
  { token: 'text-muted', valor: '#666D7A', uso: 'Texto secundario (AA sobre tintes)', origen: 'app' },
];
const ACENTOS: Swatch[] = [
  { token: 'accent', valor: '#F4C542', uso: 'Mejor escalón, primer puesto. Puntual', origen: 'web' },
  { token: 'coin', valor: '#F58A07', uso: 'Monedas, y nada más', origen: 'web' },
  { token: 'success', valor: '#16A34A', uso: 'Sube, verificado', origen: 'web' },
  { token: 'danger', valor: '#B3261E', uso: 'Baja, error, destructivo', origen: 'app' },
  { token: 'warning', valor: '#765D00', uso: 'Aviso (sobre warning-tint)', origen: 'app' },
];

const bgDe: Record<string, string> = {
  primary: 'bg-primary',
  'primary-deep': 'bg-primary-deep',
  'primary-tint': 'bg-primary-tint',
  'primary-tint-strong': 'bg-primary-tint-strong',
  'primary-soft': 'bg-primary-soft',
  secondary: 'bg-secondary',
  surface: 'bg-surface',
  'surface-muted': 'bg-surface-muted',
  border: 'bg-border',
  text: 'bg-text',
  'text-muted': 'bg-text-muted',
  accent: 'bg-accent',
  coin: 'bg-coin',
  success: 'bg-success',
  danger: 'bg-danger',
  warning: 'bg-warning',
};

interface FilaUsuario {
  id: string;
  nombre: string;
  poliza: string;
  estado: 'verificada' | 'pendiente' | 'rechazada' | 'sin';
  nivel: Nivel;
  puntos: number;
  monedas: number;
}

const USUARIOS: FilaUsuario[] = [
  { id: 'u_8f21', nombre: 'Andrea Castillo', poliza: 'GT-114-55021', estado: 'verificada', nivel: 3, puntos: 10420, monedas: 85 },
  { id: 'u_3a90', nombre: 'José Luis Pérez', poliza: 'GT-114-60877', estado: 'pendiente', nivel: 1, puntos: 2980, monedas: 40 },
  { id: 'u_c7d4', nombre: 'Mariela Ochoa', poliza: '—', estado: 'sin', nivel: 0, puntos: 0, monedas: 25 },
  { id: 'u_51be', nombre: 'Ricardo Monzón', poliza: 'GT-207-11309', estado: 'rechazada', nivel: 2, puntos: 6115, monedas: 120 },
];

const estadoPoliza: Record<FilaUsuario['estado'], ReactNode> = {
  verificada: (
    <Chip tone="success" dot>
      Verificada
    </Chip>
  ),
  pendiente: (
    <Chip tone="warning" dot>
      Pendiente
    </Chip>
  ),
  rechazada: (
    <Chip tone="danger" dot>
      Rechazada
    </Chip>
  ),
  sin: (
    <Chip tone="neutral" dot>
      Sin póliza
    </Chip>
  ),
};

const COLUMNAS: Column<FilaUsuario>[] = [
  {
    key: 'nombre',
    header: 'Usuario',
    render: (u) => (
      <div className="flex items-center gap-2.5">
        <Avatar name={u.nombre} seed={u.id} size="sm" />
        <div>
          <div className="font-semibold">{u.nombre}</div>
          <div className="font-mono text-[11.5px] text-text-muted">{u.id}</div>
        </div>
      </div>
    ),
  },
  { key: 'poliza', header: 'Póliza', render: (u) => <span className="font-mono text-[12.5px]">{u.poliza}</span> },
  { key: 'estado', header: 'Estado', render: (u) => estadoPoliza[u.estado] },
  { key: 'nivel', header: 'Nivel', render: (u) => <LevelBadge nivel={u.nivel} withCashback /> },
  { key: 'puntos', header: 'Puntos del año', numeric: true, render: (u) => <span className="font-semibold">{numero(u.puntos)}</span> },
  { key: 'monedas', header: 'Monedas', numeric: true, render: (u) => <span className="font-semibold text-coin">{u.monedas}</span> },
];

/* ------------------------------------------------------------------ piezas de la página */

function Seccion({ id, titulo, descripcion, children }: { id: string; titulo: string; descripcion?: string; children: ReactNode }) {
  return (
    <section id={id} className="scroll-mt-32">
      <div className="mb-4">
        <h2 className="font-display text-xl font-bold tracking-tight">{titulo}</h2>
        {descripcion && <p className="mt-0.5 text-text-muted">{descripcion}</p>}
      </div>
      <div className="flex flex-col gap-5">{children}</div>
    </section>
  );
}

function Muestra({ titulo, children, className }: { titulo: string; children: ReactNode; className?: string }) {
  return (
    <div className={className}>
      <div className="mb-2.5 text-[12px] font-bold tracking-[0.08em] text-text-muted uppercase">{titulo}</div>
      {children}
    </div>
  );
}

function Swatches({ titulo, items }: { titulo: string; items: Swatch[] }) {
  return (
    <Muestra titulo={titulo}>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(190px,1fr))] gap-3">
        {items.map((s) => (
          <div key={s.token} className="overflow-hidden rounded-inner border border-border bg-surface">
            <div className={`h-14 ${bgDe[s.token]}`} />
            <div className="px-3 py-2.5">
              <div className="flex items-center justify-between gap-2">
                <code className="font-mono text-[12.5px] font-semibold">{s.token}</code>
                <span className="text-[10.5px] font-bold tracking-wide text-text-muted uppercase">{s.origen}</span>
              </div>
              <div className="font-mono text-[11.5px] text-text-muted">{s.valor}</div>
              <div className="mt-1 text-[12px] leading-snug text-text-muted">{s.uso}</div>
            </div>
          </div>
        ))}
      </div>
    </Muestra>
  );
}

/* ------------------------------------------------------------------ la página */

export function Estilo() {
  const [filtro, setFiltro] = useState('todas');
  const [sel, setSel] = useState<string>('u_8f21');
  const [aviso, setAviso] = useState<string>();

  return (
    <>
      <PageTitle
        title="Guía de estilo del"
        accent="panel"
        description="Todos los tokens y componentes del panel, para aprobarlos antes de construir las pantallas. Los datos son de muestra."
      />

      <div className="flex flex-col gap-12">
        {/* ============================================================ TOKENS */}
        <Seccion id="tokens" titulo="Tokens" descripcion="Definidos una sola vez en src/styles/tokens.css. La paleta por defecto de Tailwind está apagada.">
          <Card className="flex flex-col gap-6">
            <Swatches titulo="Marca" items={MARCA} />
            <Swatches titulo="Superficies y texto" items={SUPERFICIES} />
            <Swatches titulo="Acentos y estados" items={ACENTOS} />
          </Card>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Tipografía" description="Poppins para títulos y números (web). Manrope para texto, tablas y formularios (app)." />
              <div className="flex flex-col gap-4">
                <div>
                  <div className="font-display text-[28px] leading-tight font-bold tracking-tight">
                    Míralo en <span className="text-primary">un minuto</span>
                  </div>
                  <div className="text-[12px] text-text-muted">Título de página · Poppins 700 · 28 px · acento azul</div>
                </div>
                <div>
                  <div className="font-display text-[17px] font-semibold tracking-tight">Pólizas pendientes</div>
                  <div className="text-[12px] text-text-muted">Título de card · Poppins 600 · 17 px</div>
                </div>
                <div>
                  <div className="font-display text-[32px] leading-none font-bold tracking-tight tabular-nums">12.000</div>
                  <div className="text-[12px] text-text-muted">Métrica · Poppins 700 · cifras tabulares</div>
                </div>
                <div>
                  <p>
                    La semana corre de lunes a domingo. El resultado se fija el martes a las 00:00 y el lunes queda para datos atrasados.
                  </p>
                  <div className="text-[12px] text-text-muted">Texto · Manrope 400 · 14 px</div>
                </div>
                <div>
                  <p className="text-[13px] text-text-muted">Última sincronización: hace 2 horas · iPhone 15 de Andrea</p>
                  <div className="text-[12px] text-text-muted">Secundario · Manrope · text-muted</div>
                </div>
              </div>
            </Card>

            <Card>
              <CardHeader title="Radios y sombras" description="Card 28 px (web), bloques internos 16 px, campos 14 px, pastillas completas." />
              <div className="grid grid-cols-2 gap-4">
                <div className="grid h-24 place-items-center rounded-card bg-surface text-[12px] text-text-muted shadow-card">rounded-card · shadow-card</div>
                <div className="grid h-24 place-items-center rounded-inner bg-surface-muted text-[12px] text-text-muted">rounded-inner</div>
                <div className="grid h-12 place-items-center rounded-field border border-border text-[12px] text-text-muted">rounded-field</div>
                <div className="grid h-12 place-items-center rounded-full bg-primary-tint text-[12px] font-semibold text-primary">rounded-full</div>
              </div>
              <div className="mt-5 flex flex-col gap-2">
                <div className="text-[12px] font-bold tracking-[0.08em] text-text-muted uppercase">Degradado de marca (login)</div>
                <div className="h-14 rounded-inner" style={{ backgroundImage: 'var(--gradient-brand)' }} />
                <div className="text-[12px] font-bold tracking-[0.08em] text-text-muted uppercase">Degradado de banner (La Liga)</div>
                <div className="h-14 rounded-inner" style={{ backgroundImage: 'var(--gradient-banner)' }} />
              </div>
            </Card>
          </div>

          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader icon={Footprints} title="Escalones de pasos" description="Solo donde se muestra un escalón. Café, gris, dorado y arcoíris." />
              <div className="flex flex-col gap-2">
                <TierRow pts={0} />
                <TierRow pts={25} />
                <TierRow pts={50} />
                <TierRow pts={100} />
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                <TierBadge pts={0} />
                <TierBadge pts={25} />
                <TierBadge pts={50} />
                <TierBadge pts={100} />
              </div>
            </Card>
            <Card>
              <CardHeader icon={Activity} title="Niveles de cashback" description='Escala del azul de la app. Siempre "Nivel 3", nunca nombres de metal.' />
              <div className="flex flex-col gap-2.5">
                {([0, 1, 2, 3, 4] as Nivel[]).map((n) => (
                  <div key={n} className="flex items-center justify-between rounded-inner bg-surface-muted px-4 py-2.5">
                    <LevelBadge nivel={n} />
                    <span className="text-[13px] text-text-muted tabular-nums">
                      {['0–2.499', '2.500–4.999', '5.000–9.999', '10.000–14.999', '15.000 o más'][n]} pts ·{' '}
                      <strong className="text-text">{['0 %', '5 %', '7,5 %', '10 %', '20 %'][n]}</strong>
                    </span>
                  </div>
                ))}
              </div>
            </Card>
          </div>
        </Seccion>

        {/* ============================================================ COMPONENTES */}
        <Seccion id="componentes" titulo="Componentes">
          <Card className="flex flex-col gap-7">
            <Muestra titulo="Botones">
              <div className="flex flex-wrap items-center gap-3">
                <Button icon={Check}>Verificar póliza</Button>
                <Button variant="secondary" icon={Pencil}>
                  Editar
                </Button>
                <Button variant="ghost" icon={Download}>
                  Exportar CSV
                </Button>
                <Button disabled>Deshabilitado</Button>
                <DangerButton
                  icon={LogOut}
                  confirmTitle="¿Cerrar todas las sesiones?"
                  confirmBody="Andrea Castillo tendrá que volver a entrar en todos sus dispositivos."
                  confirmLabel="Cerrar sesiones"
                  onConfirm={() => setAviso('Sesiones cerradas')}
                >
                  Cerrar sesiones
                </DangerButton>
                <DangerButton
                  icon={Undo2}
                  confirmTitle="¿Dar de baja la cuenta?"
                  confirmBody="Se borran el correo, el nombre, la póliza y la fecha exacta de nacimiento. Lo anónimo se conserva. No se puede deshacer."
                  confirmLabel="Dar de baja"
                  typeToConfirm="u_8f21"
                  onConfirm={() => setAviso('Cuenta dada de baja')}
                >
                  Dar de baja
                </DangerButton>
              </div>
              <div className="mt-3 flex flex-wrap items-center gap-3">
                <Button size="sm" icon={Plus}>
                  Nuevo premio
                </Button>
                <Button size="sm" variant="secondary">
                  Cancelar
                </Button>
              </div>
              {aviso && (
                <Alert tone="success" className="mt-3">
                  {aviso} (de muestra: no se hizo nada).
                </Alert>
              )}
            </Muestra>

            <Muestra titulo="Campos">
              <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-3">
                <TextField label="Número de póliza" placeholder="GT-114-55021" hint="Como aparece en el carné de la aseguradora." />
                <TextField label="Monedas" type="number" defaultValue={-15} error="Escribe el motivo del ajuste." />
                <SelectField label="Motivo" defaultValue="chequeo">
                  <option value="chequeo">Chequeo médico</option>
                  <option value="ajuste">Ajuste del demo</option>
                  <option value="error">Corrección de un error</option>
                </SelectField>
                <TextField label="Semana" defaultValue="Semana 45 · 2026" disabled hint="No se puede editar: la semana ya empezó." />
                <TextAreaField label="Motivo de la corrección" placeholder="Qué pasó y por qué se corrige" className="md:col-span-2" />
              </div>
              <SearchInput placeholder="Buscar premio o comercio" className="mt-4 max-w-sm" />
            </Muestra>

            <Muestra titulo="Chips y filtros">
              <div className="flex flex-wrap gap-2">
                <Chip>% de tu ritmo máximo</Chip>
                <Chip tone="success" dot>
                  Verificada
                </Chip>
                <Chip tone="warning" dot>
                  En revisión
                </Chip>
                <Chip tone="danger" dot>
                  Bloqueada
                </Chip>
                <Chip tone="neutral">Archivado</Chip>
                <Chip tone="coin">+5 monedas</Chip>
                <Chip icon={CalendarClock}>Cierra el martes</Chip>
              </div>
              <div className="mt-3 flex flex-wrap gap-2">
                {[
                  ['todas', 'Todas', 1284],
                  ['pendientes', 'Pendientes', 17],
                  ['verificadas', 'Verificadas', 1190],
                  ['rechazadas', 'Rechazadas', 77],
                ].map(([k, l, n]) => (
                  <FilterChip key={k} selected={filtro === k} onClick={() => setFiltro(k as string)} count={n as number}>
                    {l}
                  </FilterChip>
                ))}
              </div>
            </Muestra>

            <div className="grid gap-7 md:grid-cols-2">
              <Muestra titulo="Barras de progreso">
                <div className="flex flex-col gap-3">
                  <div>
                    <div className="mb-1.5 flex justify-between text-[13px]">
                      <span className="font-semibold">Pasos de la semana</span>
                      <span className="text-text-muted tabular-nums">38.200 / 49.000</span>
                    </div>
                    <ProgressBar value={38200} max={49000} label="Pasos de la semana" />
                  </div>
                  <div>
                    <div className="mb-1.5 flex justify-between text-[13px]">
                      <span className="font-semibold">Cupo del premio</span>
                      <span className="text-text-muted tabular-nums">12 / 50</span>
                    </div>
                    <ProgressBar value={12} max={50} size="sm" label="Cupo del premio" />
                  </div>
                </div>
              </Muestra>
              <Muestra titulo="Íconos, pasos y avatares">
                <div className="flex flex-wrap items-center gap-3">
                  <IconCircle icon={Footprints} size="lg" />
                  <IconCircle icon={Activity} size="lg" />
                  <IconCircle icon={Gift} />
                  <IconCircle icon={Ticket} size="sm" />
                </div>
                <ol className="mt-4 flex flex-wrap items-center gap-5">
                  {['Te mueves', 'Sumas', 'Recibes'].map((t, i) => (
                    <li key={t} className="flex items-center gap-2">
                      <StepNumber n={i + 1} last={i === 2} />
                      <span className="font-semibold">{t}</span>
                    </li>
                  ))}
                </ol>
                <div className="mt-4 flex items-center gap-2">
                  <Avatar name="Andrea Castillo" seed="u_8f21" size="lg" />
                  <Avatar name="José Luis Pérez" seed="u_3a90" />
                  <Avatar name="Mariela Ochoa" seed="u_c7d4" />
                  <Avatar name="Ricardo Monzón" seed="u_51be" size="sm" />
                </div>
              </Muestra>
            </div>
          </Card>
        </Seccion>

        {/* ============================================================ TABLA Y ESTADOS */}
        <Seccion id="tabla" titulo="Tabla y estados">
          <Card>
            <CardHeader
              title="Cuentas"
              description="Haz clic en una fila para seleccionarla."
              action={
                <Button size="sm" variant="secondary" icon={Download}>
                  Exportar
                </Button>
              }
            />
            <DataTable columns={COLUMNAS} rows={USUARIOS} rowKey={(u) => u.id} selectedKey={sel} onRowClick={(u) => setSel(u.id)} caption="Cuentas de muestra" />
          </Card>

          <div className="grid gap-5 md:grid-cols-2">
            <Card>
              <EmptyState
                icon={Inbox}
                title="No hay pólizas pendientes"
                description="Cuando alguien vincule una póliza, aparece aquí."
                action={
                  <Button size="sm" variant="secondary">
                    Ver todas
                  </Button>
                }
              />
            </Card>
            <Card>
              <ErrorState description="La API no respondió. Revisa tu conexión." onRetry={() => undefined} />
            </Card>
          </div>
          <div className="flex flex-col gap-2.5">
            <Alert tone="info">El resultado de la semana se fija el martes a las 00:00.</Alert>
            <Alert tone="success">Premio archivado.</Alert>
            <Alert tone="warning">No se puede editar: la semana ya empezó.</Alert>
            <Alert tone="danger">No se guardó el ajuste. Hay otro cierre en curso.</Alert>
          </div>
        </Seccion>

        {/* ============================================================ VISTAS PREVIAS */}
        <Seccion id="vistas" titulo="Vistas previas" descripcion="Imitan la app: así lo va a ver el usuario.">
          <div className="grid gap-5 lg:grid-cols-[auto_1fr]">
            <Card>
              <CardHeader title="Card de la Tienda" />
              <div className="flex flex-wrap gap-4">
                <PremioCard nombre="2x1 en café" categoria="Cafetería" costoMonedas={40} comercio="Café Barista" fondo="#F3EDE4" />
                <PremioCard nombre="Clase de prueba" categoria="Gimnasio" costoMonedas={60} comercio="Gym Zona 10" apagado />
              </div>
              <p className="mt-3 text-[12.5px] text-text-muted">La segunda está apagada (premio archivado).</p>
            </Card>
            <Card>
              <CardHeader title="Banner de La Liga" />
              <LigaBanner mes="noviembre" podio={[30, 20, 10]} patrocinador="Café Barista" cierre="Cierra el 2 de diciembre · tus monedas llegan el día 9" />
            </Card>
          </div>
          <div className="grid gap-5 lg:grid-cols-2">
            <Card>
              <CardHeader title="Ranking" description="Puntos del mes. El primer lugar resaltado." />
              <ol className="flex flex-col gap-1">
                <RankingRow puesto={1} nombre="Andrea Castillo" seed="u_8f21" puntos={2840} maxPuntos={2840} tendencia={1} />
                <RankingRow puesto={2} nombre="Ricardo Monzón" seed="u_51be" puntos={2610} maxPuntos={2840} tendencia={-1} />
                <RankingRow puesto={3} nombre="José Luis Pérez" seed="u_3a90" puntos={2395} maxPuntos={2840} tendencia={2} destacado />
                <RankingRow puesto={4} nombre="Mariela Ochoa" seed="u_c7d4" puntos={1980} maxPuntos={2840} tendencia={0} />
              </ol>
            </Card>
            <Card>
              <CardHeader title="Metas de la semana" description="La fila L M M J V S D de la app." />
              <div className="flex flex-col gap-5">
                <Muestra titulo="Workouts">
                  <WeekRow dias={['cumplido', 'nada', 'cumplido', 'parcial', 'hoy', 'futuro', 'futuro']} pie="2 de 3 workouts · +5 monedas al cumplir" />
                </Muestra>
                <Muestra titulo="Pasos · 40–49 años">
                  <div className="mb-1.5 flex justify-between text-[13px]">
                    <span className="font-semibold">Meta 45.000</span>
                    <span className="text-text-muted tabular-nums">31.870</span>
                  </div>
                  <ProgressBar value={31870} max={45000} label="Pasos de la semana" />
                </Muestra>
              </div>
            </Card>
          </div>
        </Seccion>

        {/* ============================================================ LAYOUT */}
        <Seccion id="layout" titulo="Layout" descripcion="Así arranca el dashboard de inicio. La barra lateral y el header son los de esta página.">
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard variant="feature" label="Con póliza verificada" value={numero(1190)} icon={Users} detail="+24 esta semana" />
            <MetricCard label="Pólizas pendientes" value="17" icon={FileCheck2} detail="La más vieja, hace 3 días" />
            <MetricCard label="Cupones canjeados" value="86" icon={Ticket} detail="Esta semana" />
            <MetricCard label="Próximo cierre" value="Martes" icon={CalendarClock} detail="Semana 45 · 00:00" />
          </div>
          <Card>
            <CardHeader title="Accesos rápidos" />
            <div className="flex flex-wrap gap-2">
              <Button variant="secondary" size="sm" icon={FileCheck2}>
                Verificar pólizas
              </Button>
              <Button variant="secondary" size="sm" icon={Ticket}>
                Buscar cupón
              </Button>
              <Button variant="secondary" size="sm" icon={Gift}>
                Nuevo premio
              </Button>
              <Link
                to="/login"
                className="inline-flex h-8 items-center rounded-full px-3.5 text-[13px] font-semibold text-primary hover:bg-primary-tint"
              >
                Ver pantalla de login →
              </Link>
            </div>
          </Card>
        </Seccion>
      </div>
    </>
  );
}
