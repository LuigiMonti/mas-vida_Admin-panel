/*
 * Usuarios, pólizas, ledgers y sync. Mock en memoria con la forma de los
 * modelos de Django (users.Usuario, policies.PolizaVinculada, poincs.Ledger,
 * coins.MonedaLedger). Futuro: /api/v1/admin/usuarios/…, /polizas/…
 *
 * Reglas que el mock respeta igual que el backend:
 * - Los ledgers son append-only: nada se edita ni se borra. Un ajuste es
 *   una fila nueva (tipo ajuste_manual) con motivo y autor.
 * - Verificar exige la fecha de nacimiento confirmada y toma el veredicto
 *   del retroactivo en ese momento (services/polizas.py → verificar).
 * - Una póliza verificada no se rechaza.
 */
import { registrar } from './bitacora';
import { copia, ErrorPanel, hoyGT, simularRed } from './red';
import { puede, sesionActual } from './sesion';
import type { Nivel } from '@/components/ui/Niveles';

/* ================================================================= tipos */

export type EstadoPoliza = 'sin_poliza' | 'pendiente' | 'verificada' | 'rechazada';
export type Retroactivo = '' | 'aplicado' | 'tolerado' | 'denegado';

export const MOTIVOS_RECHAZO: Record<string, string> = {
  datos_no_coinciden: 'Los datos no coinciden con la aseguradora',
  poliza_no_vigente: 'La póliza no existe o no está vigente',
  poliza_en_otra_cuenta: 'Ya está verificada en otra cuenta',
  otro: 'Otro motivo',
};

export interface Poliza {
  policy_number: string;
  insurer: string;
  policy_start_date: string | null;
  plan: string | null;
  nombre: string | null;
  apellido: string | null;
  birth_date_confirmada: string | null;
  estado_verificacion: Exclude<EstadoPoliza, 'sin_poliza'>;
  motivo_rechazo: string | null;
  fecha_vinculacion: string;
  fecha_verificacion: string | null;
  retroactivo: Retroactivo;
  corte_retroactivo: string | null;
}

export interface Usuario {
  usuario_id: string;
  correo: string;
  /** Fecha que declaró al registrarse. */
  birth_date: string;
  is_active: boolean;
  creado_en: string;
  poliza: Poliza | null;
}

export type TipoLedger = 'pasos' | 'intensidad' | 'chequeo_medico' | 'ajuste_manual' | 'retroactivo_denegado';
export type TipoMoneda = 'objetivo_cumplido' | 'liga_mensual' | 'canje' | 'expiracion' | 'ajuste_manual';

export const NOMBRE_TIPO_LEDGER: Record<TipoLedger, string> = {
  pasos: 'Pasos',
  intensidad: 'Intensidad',
  chequeo_medico: 'Chequeo médico',
  ajuste_manual: 'Ajuste manual',
  retroactivo_denegado: 'Retroactivo denegado',
};

export const NOMBRE_TIPO_MONEDA: Record<TipoMoneda, string> = {
  objetivo_cumplido: 'Objetivo cumplido',
  liga_mensual: 'Liga mensual',
  canje: 'Canje',
  expiracion: 'Vencidas (fin de season)',
  ajuste_manual: 'Ajuste manual',
};

export interface FilaLedger {
  id: number;
  fecha: string;
  tipo: TipoLedger;
  puntos: number;
  puntos_pasos: number | null;
  puntos_intensidad: number | null;
  tope_diario_aplicado: boolean | null;
  version_regla: string;
  creado_en: string;
  /** Solo en ajustes hechos desde el panel. */
  motivo?: string;
  autor?: string;
}

export interface FilaMonedas {
  id: number;
  fecha: string;
  tipo: TipoMoneda;
  cantidad: number;
  fecha_expiracion: string | null;
  creado_en: string;
  motivo?: string;
  autor?: string;
}

export interface Dispositivo {
  nombre: string;
  modelo: string;
  tipo: 'telefono' | 'reloj' | 'anillo' | 'desconocido';
  fuente_bundle: string;
  ultima_muestra: string;
}

export interface SoporteSync {
  ultimo_sincronizado_en: string | null;
  app_version: string | null;
  zona_horaria: string | null;
  /** Ventana de datos rezagados: los últimos 14 días. */
  ventana: Array<{ fecha: string; con_datos: boolean; pasos: number | null }>;
  descartadas: { sesiones_sin_ritmo_cardiaco: number; datos_imposibles: number };
  dispositivos: Dispositivo[];
}

/** Fila de la lista de usuarios. */
export interface FilaUsuario {
  usuario_id: string;
  correo: string;
  is_active: boolean;
  estado_poliza: EstadoPoliza;
  motivo_rechazo: string | null;
  policy_number: string | null;
  puntos_anio: number;
  nivel: Nivel;
  saldo_monedas: number;
  ultimo_sync: string | null;
}

export interface FichaUsuario {
  usuario: Usuario;
  estado_poliza: EstadoPoliza;
  puntos_anio: number;
  nivel: Nivel;
  saldo_monedas: number;
  version_regla_activa: string;
}

/* ================================================================= reglas */

/** Hoy en Guatemala. Los datos de muestra se arman hacia atrás desde aquí. */
export const HOY = hoyGT();
export const VERSION_ACTIVA = 'v3';

export function nivelDe(puntos: number): Nivel {
  if (puntos >= 15000) return 4;
  if (puntos >= 10000) return 3;
  if (puntos >= 5000) return 2;
  if (puntos >= 2500) return 1;
  return 0;
}

function edad(nacimiento: string, en: string): number {
  const [ny, nm, nd] = nacimiento.split('-').map(Number) as [number, number, number];
  const [y, m, d] = en.split('-').map(Number) as [number, number, number];
  let e = y - ny;
  if (m < nm || (m === nm && d < nd)) e -= 1;
  return Math.max(0, e);
}

function mismoDiaOtroAnio(f: string, anios: number): string {
  const [y, m, d] = f.split('-');
  const nuevo = `${Number(y) + anios}-${m}-${d}`;
  // 29 de febrero en un año no bisiesto → 28.
  return Number.isNaN(Date.parse(nuevo)) ? `${Number(y) + anios}-${m}-28` : nuevo;
}

export interface Veredicto {
  resultado: Exclude<Retroactivo, ''>;
  explicacion: string;
}

/**
 * El mismo veredicto que services/polizas.py → verificar(). Solo para
 * mostrarlo antes de confirmar: el que vale es el del servidor.
 *
 * Mentira si difiere en más de 2 años, o si le da ventaja aunque sea poco.
 * Ventaja = ser más viejo en años cumplidos (cruzar los 60, meta de pasos
 * más baja o FCmáx más baja).
 */
export function veredictoPrevio(declarada: string, confirmada: string, hoy = HOY): Veredicto {
  if (declarada === confirmada) {
    return { resultado: 'aplicado', explicacion: 'Las fechas coinciden. Se conserva todo lo ganado antes de verificar.' };
  }
  const dentro = mismoDiaOtroAnio(confirmada, -2) <= declarada && declarada <= mismoDiaOtroAnio(confirmada, 2);
  const eDecl = edad(declarada, hoy);
  const eReal = edad(confirmada, hoy);
  if (!dentro) {
    return {
      resultado: 'denegado',
      explicacion: 'La fecha difiere en más de 2 años. Se anulan los puntos y las monedas de antes de hoy.',
    };
  }
  if (eDecl > eReal) {
    const por = eDecl >= 60 && eReal < 60 ? 'cruza los 60 (bono +25)' : 'le baja la meta de pasos o la FCmáx';
    return {
      resultado: 'denegado',
      explicacion: `Difiere poco, pero le da ventaja: con la fecha declarada tiene ${eDecl} años y en realidad ${eReal}; ${por}. Se anula lo de antes de hoy.`,
    };
  }
  return {
    resultado: 'tolerado',
    explicacion: 'Difiere poco y no le da ventaja: se toma como error y se conserva todo lo ganado.',
  };
}

/* ================================================================= mock */

// Generador con semilla: los datos de muestra son siempre los mismos.
function rng(semilla: string) {
  let h = 2166136261;
  for (let i = 0; i < semilla.length; i++) h = Math.imul(h ^ semilla.charCodeAt(i), 16777619);
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

function diasAtras(n: number, desde = HOY): string {
  const d = new Date(`${desde}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() - n);
  return d.toISOString().slice(0, 10);
}

function tramoPasos(pasos: number): number {
  if (pasos >= 15000) return 100;
  if (pasos >= 10000) return 50;
  if (pasos >= 7000) return 25;
  return 0;
}

interface Semilla {
  id: string;
  correo: string;
  nac: string;
  poliza?: Partial<Poliza> & { policy_number: string };
  /** Días desde el último sync (null = nunca). */
  sinSync: number | null;
  actividad: number; // 0–1
  diasSinDatos?: number[];
  version?: string;
  activo?: boolean;
  dispositivos?: Dispositivo[];
}

const IPHONE = (nombre: string, ultima: string): Dispositivo => ({
  nombre,
  modelo: 'iPhone',
  tipo: 'telefono',
  fuente_bundle: 'com.apple.health',
  ultima_muestra: ultima,
});
const WATCH = (nombre: string, ultima: string): Dispositivo => ({
  nombre,
  modelo: 'Watch',
  tipo: 'reloj',
  fuente_bundle: 'com.apple.health',
  ultima_muestra: ultima,
});

const SEMILLAS: Semilla[] = [
  {
    id: 'u_8f21',
    correo: 'andrea.castillo@gmail.com',
    nac: '1988-03-14',
    poliza: { policy_number: 'GT-114-55021', nombre: 'Andrea', apellido: 'Castillo', estado_verificacion: 'verificada', birth_date_confirmada: '1988-03-14', retroactivo: 'aplicado', fecha_verificacion: '2026-11-03T09:14:00-06:00' },
    sinSync: 0,
    actividad: 0.9,
  },
  {
    id: 'u_3a90',
    correo: 'jl.perez@outlook.com',
    nac: '1979-07-02',
    poliza: { policy_number: 'GT-114-60877', nombre: 'José Luis', apellido: 'Pérez', estado_verificacion: 'pendiente' },
    sinSync: 1,
    actividad: 0.6,
  },
  {
    id: 'u_c7d4',
    correo: 'mariela.ochoa@gmail.com',
    nac: '1995-11-20',
    sinSync: 0,
    actividad: 0.5,
  },
  {
    id: 'u_51be',
    correo: 'rmonzon@empresa.com.gt',
    nac: '1966-01-09',
    poliza: { policy_number: 'GT-207-11309', nombre: 'Ricardo', apellido: 'Monzón', estado_verificacion: 'verificada', birth_date_confirmada: '1966-01-09', retroactivo: 'aplicado', fecha_verificacion: '2026-10-12T10:02:00-06:00' },
    sinSync: 0,
    actividad: 0.8,
  },
  {
    id: 'u_9e02',
    correo: 'lucia.herrera@gmail.com',
    nac: '1990-05-30',
    poliza: { policy_number: 'GT-114-70412', nombre: 'Lucía', apellido: 'Herrera', estado_verificacion: 'rechazada', motivo_rechazo: 'datos_no_coinciden' },
    sinSync: 2,
    actividad: 0.4,
  },
  {
    id: 'u_d118',
    correo: 'carlos.mendez@gmail.com',
    nac: '1963-08-15',
    // Declaró 1963 y la aseguradora confirmó 1968: más de 2 años y cruza los 60.
    poliza: { policy_number: 'GT-301-00987', nombre: 'Carlos', apellido: 'Méndez', estado_verificacion: 'verificada', birth_date_confirmada: '1968-08-15', retroactivo: 'denegado', corte_retroactivo: '2026-10-20', fecha_verificacion: '2026-10-20T11:30:00-06:00' },
    sinSync: 0,
    actividad: 0.7,
  },
  {
    id: 'u_4b6c',
    correo: 'sofia.ramirez@gmail.com',
    nac: '1999-02-11',
    poliza: { policy_number: 'GT-114-81230', nombre: 'Sofía', apellido: 'Ramírez', estado_verificacion: 'pendiente', birth_date_confirmada: '1999-02-11' },
    sinSync: 0,
    actividad: 0.85,
  },
  {
    id: 'u_7f3a',
    correo: 'diego.lopez@gmail.com',
    nac: '1984-12-01',
    poliza: { policy_number: 'GT-114-81399', nombre: 'Diego', apellido: 'López', estado_verificacion: 'pendiente', birth_date_confirmada: '1983-12-01' },
    sinSync: 6,
    actividad: 0.3,
    diasSinDatos: [0, 1, 2, 3, 4, 5],
    version: '1.0.2',
  },
  {
    id: 'u_e5d9',
    correo: 'ana.gt@icloud.com',
    nac: '1972-04-18',
    poliza: { policy_number: 'GT-207-22561', nombre: 'Ana', apellido: 'Gálvez', estado_verificacion: 'pendiente', birth_date_confirmada: '1974-04-18' },
    sinSync: 0,
    actividad: 0.65,
  },
  {
    id: 'u_0a71',
    correo: 'pablo.ruiz@gmail.com',
    nac: '2001-09-09',
    sinSync: null,
    actividad: 0,
  },
  {
    id: 'u_b2f8',
    correo: 'gabriela.soto@gmail.com',
    nac: '1958-06-25',
    poliza: { policy_number: 'GT-301-01544', nombre: 'Gabriela', apellido: 'Soto', estado_verificacion: 'verificada', birth_date_confirmada: '1958-06-25', retroactivo: 'tolerado', fecha_verificacion: '2026-10-05T08:45:00-06:00' },
    sinSync: 3,
    actividad: 0.55,
    diasSinDatos: [3, 4, 9],
  },
  {
    id: 'u_6c40',
    correo: 'marco.v@gmail.com',
    nac: '1993-10-03',
    poliza: { policy_number: 'GT-114-55021', nombre: 'Marco', apellido: 'Villagrán', estado_verificacion: 'pendiente', birth_date_confirmada: '1993-10-03' },
    sinSync: 1,
    actividad: 0.7,
    activo: true,
  },
];

interface Registro {
  usuario: Usuario;
  puntos: FilaLedger[];
  monedas: FilaMonedas[];
  sync: SoporteSync;
}

let siguienteFila = 1;

function construir(s: Semilla): Registro {
  const r = rng(s.id);
  const puntos: FilaLedger[] = [];
  const monedas: FilaMonedas[] = [];
  const ventana: SoporteSync['ventana'] = [];
  const sinDatos = new Set(s.diasSinDatos ?? []);
  const nunca = s.sinSync === null;

  for (let n = 59; n >= 1; n--) {
    const f = diasAtras(n);
    const hayDatos = !nunca && !sinDatos.has(n) && r() < 0.92;
    const pasos = hayDatos ? Math.round(2500 + r() * 15000 * s.actividad + 3000 * s.actividad) : null;
    if (n <= 14) ventana.unshift({ fecha: f, con_datos: hayDatos, pasos });
    if (!hayDatos || pasos === null) continue;
    const bono = edad(s.nac, f) >= 60 ? 25 : 0;
    const pp = tramoPasos(pasos) + (tramoPasos(pasos) > 0 ? bono : 0);
    const iRaw = r() < s.actividad * 0.7 ? [50, 100, 100, 150][Math.floor(r() * 4)]! : 0;
    const pi = iRaw + (iRaw > 0 ? bono : 0);
    const tope = pp + pi > 200;
    const piFinal = tope ? 200 - pp : pi;
    const creado = `${f}T21:${String(10 + Math.floor(r() * 40)).padStart(2, '0')}:00-06:00`;
    if (pp > 0)
      puntos.push({ id: siguienteFila++, fecha: f, tipo: 'pasos', puntos: pp, puntos_pasos: pp, puntos_intensidad: null, tope_diario_aplicado: tope, version_regla: VERSION_ACTIVA, creado_en: creado });
    if (piFinal > 0)
      puntos.push({ id: siguienteFila++, fecha: f, tipo: 'intensidad', puntos: piFinal, puntos_pasos: null, puntos_intensidad: piFinal, tope_diario_aplicado: tope, version_regla: VERSION_ACTIVA, creado_en: creado });
  }

  // Monedas: objetivos cumplidos los martes (5 + 5 por componente).
  for (let n = 56; n >= 1; n -= 7) {
    const f = diasAtras(n);
    if (nunca) break;
    const ganadas = (r() < s.actividad ? 5 : 0) + (r() < s.actividad * 0.8 ? 5 : 0);
    if (ganadas > 0)
      monedas.push({ id: siguienteFila++, fecha: f, tipo: 'objetivo_cumplido', cantidad: ganadas, fecha_expiracion: '2027-01-03', creado_en: `${f}T00:03:00-06:00` });
  }
  if (!nunca && s.actividad > 0.6)
    monedas.push({ id: siguienteFila++, fecha: '2026-10-09', tipo: 'liga_mensual', cantidad: 20, fecha_expiracion: '2027-01-03', creado_en: '2026-10-09T00:05:00-06:00' });

  const ultimo = s.sinSync === null ? null : `${diasAtras(s.sinSync)}T${s.sinSync === 0 ? '07:42' : '20:15'}:00-06:00`;
  const nombre = s.poliza?.nombre ?? s.correo.split('@')[0]!;
  const dispositivos = s.dispositivos ?? (ultimo === null ? [] : s.actividad > 0.6 ? [IPHONE(`iPhone de ${nombre}`, ultimo), WATCH(`Apple Watch de ${nombre}`, ultimo)] : [IPHONE(`iPhone de ${nombre}`, ultimo)]);

  const poliza: Poliza | null = s.poliza
    ? {
        insurer: 'Seguros Demo GT',
        policy_start_date: '2026-01-15',
        plan: 'Gastos médicos mayores',
        nombre: null,
        apellido: null,
        birth_date_confirmada: null,
        estado_verificacion: 'pendiente',
        motivo_rechazo: null,
        fecha_vinculacion: `${diasAtras(Math.floor(r() * 5) + 1)}T10:20:00-06:00`,
        fecha_verificacion: null,
        retroactivo: '',
        corte_retroactivo: null,
        ...s.poliza,
      }
    : null;

  const reg: Registro = {
    usuario: { usuario_id: s.id, correo: s.correo, birth_date: s.nac, is_active: s.activo ?? true, creado_en: '2026-09-28T12:00:00-06:00', poliza },
    puntos,
    monedas,
    sync: {
      ultimo_sincronizado_en: ultimo,
      app_version: ultimo === null ? null : (s.version ?? '1.1.0'),
      zona_horaria: ultimo === null ? null : 'America/Guatemala',
      ventana,
      descartadas: { sesiones_sin_ritmo_cardiaco: nunca ? 0 : Math.floor(r() * 4), datos_imposibles: nunca ? 0 : r() < 0.2 ? 1 : 0 },
      dispositivos,
    },
  };

  if (poliza?.retroactivo === 'denegado' && poliza.corte_retroactivo) anularAntesDe(reg, poliza.corte_retroactivo, `${poliza.corte_retroactivo}T11:30:00-06:00`);
  return reg;
}

/** services/polizas.py → denegar_retroactivo: una fila negativa por día, y las monedas de antes. */
function anularAntesDe(reg: Registro, corte: string, cuando: string): { dias: number; puntos: number; monedas: number } {
  const porDia = new Map<string, FilaLedger[]>();
  for (const f of reg.puntos) {
    if (f.fecha < corte && f.tipo !== 'ajuste_manual' && f.tipo !== 'chequeo_medico') {
      porDia.set(f.fecha, [...(porDia.get(f.fecha) ?? []), f]);
    }
  }
  let dias = 0;
  let total = 0;
  for (const [fecha, filas] of [...porDia.entries()].sort()) {
    const neto = filas.reduce((s, f) => s + f.puntos, 0);
    if (neto === 0) continue;
    const ultima = filas[filas.length - 1]!;
    reg.puntos.push({
      id: siguienteFila++,
      fecha,
      tipo: 'retroactivo_denegado',
      puntos: -neto,
      puntos_pasos: ultima.puntos_pasos,
      puntos_intensidad: ultima.puntos_intensidad,
      tope_diario_aplicado: ultima.tope_diario_aplicado,
      version_regla: ultima.version_regla,
      creado_en: cuando,
    });
    dias++;
    total += neto;
  }
  const ganadasAntes = reg.monedas.filter((m) => m.fecha < corte && m.cantidad > 0).reduce((s, m) => s + m.cantidad, 0);
  const gastadas = -reg.monedas.filter((m) => m.cantidad < 0).reduce((s, m) => s + m.cantidad, 0);
  const restante = Math.max(0, ganadasAntes - gastadas);
  if (restante > 0) {
    reg.monedas.push({ id: siguienteFila++, fecha: corte, tipo: 'ajuste_manual', cantidad: -restante, fecha_expiracion: null, creado_en: cuando, motivo: 'Retroactivo denegado', autor: 'sistema' });
  }
  return { dias, puntos: total, monedas: restante };
}

const registros: Registro[] = SEMILLAS.map(construir);

function buscar(usuario_id: string): Registro {
  const r = registros.find((x) => x.usuario.usuario_id === usuario_id);
  if (!r) throw new ErrorPanel(`No existe la cuenta ${usuario_id}.`);
  return r;
}

function estadoDe(u: Usuario): EstadoPoliza {
  return u.poliza?.estado_verificacion ?? 'sin_poliza';
}

/** Puntos del año de póliza (en el mock: desde el inicio del piloto). */
function puntosAnio(r: Registro): number {
  return Math.max(0, r.puntos.reduce((s, f) => s + f.puntos, 0));
}

function saldo(r: Registro): number {
  return r.monedas.reduce((s, m) => s + m.cantidad, 0);
}

function fila(r: Registro): FilaUsuario {
  const p = puntosAnio(r);
  return {
    usuario_id: r.usuario.usuario_id,
    correo: r.usuario.correo,
    is_active: r.usuario.is_active,
    estado_poliza: estadoDe(r.usuario),
    motivo_rechazo: r.usuario.poliza?.motivo_rechazo ?? null,
    policy_number: r.usuario.poliza?.policy_number ?? null,
    puntos_anio: p,
    nivel: nivelDe(p),
    saldo_monedas: saldo(r),
    ultimo_sync: r.sync.ultimo_sincronizado_en,
  };
}

function nombreDe(u: Usuario): string {
  const p = u.poliza;
  return p?.nombre ? `${p.nombre} ${p.apellido ?? ''}`.trim() : u.correo.split('@')[0]!;
}

export { nombreDe };

/* ================================================================= usuarios */

export function listarUsuarios(filtro: { q?: string; estado?: EstadoPoliza | 'todos' }): Promise<FilaUsuario[]> {
  return simularRed(() => {
    const q = (filtro.q ?? '').trim().toLowerCase();
    return registros
      .filter((r) => !filtro.estado || filtro.estado === 'todos' || estadoDe(r.usuario) === filtro.estado)
      .filter((r) => {
        if (!q) return true;
        const u = r.usuario;
        return [u.usuario_id, u.correo, u.poliza?.policy_number ?? '', nombreDe(u)].some((v) => v.toLowerCase().includes(q));
      })
      .map(fila);
  });
}

export function contarPorEstado(): Promise<Record<EstadoPoliza | 'todos', number>> {
  return simularRed(() => {
    const c = { todos: registros.length, sin_poliza: 0, pendiente: 0, verificada: 0, rechazada: 0 };
    for (const r of registros) c[estadoDe(r.usuario)]++;
    return c;
  }, 150);
}

export function obtenerFicha(usuario_id: string): Promise<FichaUsuario> {
  return simularRed(() => {
    const r = buscar(usuario_id);
    const p = puntosAnio(r);
    return copia({ usuario: r.usuario, estado_poliza: estadoDe(r.usuario), puntos_anio: p, nivel: nivelDe(p), saldo_monedas: saldo(r), version_regla_activa: VERSION_ACTIVA });
  });
}

/** Ledger de puntos, más nuevo primero. Solo lectura. */
export function listarLedgerPuntos(usuario_id: string): Promise<FilaLedger[]> {
  return simularRed(() => copia([...buscar(usuario_id).puntos].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id)));
}

/** Ledger de monedas, más nuevo primero. Solo lectura. */
export function listarLedgerMonedas(usuario_id: string): Promise<FilaMonedas[]> {
  return simularRed(() => copia([...buscar(usuario_id).monedas].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id)));
}

export function obtenerSync(usuario_id: string): Promise<SoporteSync> {
  return simularRed(() => copia(buscar(usuario_id).sync));
}

export interface NuevoAjuste {
  ledger: 'puntos' | 'monedas';
  /** Con signo: negativo descuenta. */
  cantidad: number;
  fecha: string;
  motivo: string;
}

/**
 * Agrega una fila de ajuste. Nunca edita ni borra filas: corregir es sumar
 * una fila de signo contrario.
 */
export function agregarAjuste(usuario_id: string, a: NuevoAjuste): Promise<void> {
  return simularRed(() => {
    if (!puede('ajustar_ledger')) throw new ErrorPanel('Tu rol no puede hacer ajustes.');
    const r = buscar(usuario_id);
    const campos: Record<string, string> = {};
    if (!Number.isInteger(a.cantidad) || a.cantidad === 0) campos.cantidad = 'Escribe un número entero distinto de 0.';
    if (!a.fecha) campos.fecha = 'Elige el día.';
    else if (a.fecha > HOY) campos.fecha = 'No puede ser un día futuro.';
    if (a.motivo.trim().length < 5) campos.motivo = 'Escribe el motivo del ajuste.';
    if (!campos.cantidad && a.ledger === 'puntos' && a.cantidad < 0) {
      const delDia = r.puntos.filter((f) => f.fecha === a.fecha).reduce((s, f) => s + f.puntos, 0);
      if (delDia + a.cantidad < 0) campos.cantidad = `Ese día tiene ${delDia} pts: no se le pueden quitar más.`;
    }
    if (!campos.cantidad && a.ledger === 'monedas' && saldo(r) + a.cantidad < 0) {
      campos.cantidad = `El saldo es ${saldo(r)}: no puede quedar en negativo.`;
    }
    if (Object.keys(campos).length) throw new ErrorPanel('Revisa los campos marcados.', campos);

    const ahora = new Date().toISOString();
    const motivo = a.motivo.trim();
    if (a.ledger === 'puntos') {
      r.puntos.push({ id: siguienteFila++, fecha: a.fecha, tipo: 'ajuste_manual', puntos: a.cantidad, puntos_pasos: null, puntos_intensidad: null, tope_diario_aplicado: null, version_regla: VERSION_ACTIVA, creado_en: ahora, motivo, autor: sesionActual.correo });
      registrar('ajuste_puntos', usuario_id, `${a.cantidad > 0 ? '+' : ''}${a.cantidad} pts el ${a.fecha} · ${motivo}`);
    } else {
      r.monedas.push({ id: siguienteFila++, fecha: a.fecha, tipo: 'ajuste_manual', cantidad: a.cantidad, fecha_expiracion: a.cantidad > 0 ? '2027-01-03' : null, creado_en: ahora, motivo, autor: sesionActual.correo });
      registrar('ajuste_monedas', usuario_id, `${a.cantidad > 0 ? '+' : ''}${a.cantidad} monedas · ${motivo}`);
    }
  });
}

/* ================================================================= pólizas */

export interface FilaPoliza {
  usuario_id: string;
  correo: string;
  /** Lo que declaró al registrarse. */
  birth_date: string;
  poliza: Poliza;
  /** Otra cuenta ya tiene verificada esta misma póliza. */
  en_otra_cuenta: string | null;
}

function otraCuentaCon(r: Registro): string | null {
  const p = r.usuario.poliza;
  if (!p) return null;
  const otra = registros.find(
    (x) =>
      x !== r &&
      x.usuario.poliza?.estado_verificacion === 'verificada' &&
      x.usuario.poliza.policy_number.trim().toLowerCase() === p.policy_number.trim().toLowerCase() &&
      x.usuario.poliza.insurer.trim().toLowerCase() === p.insurer.trim().toLowerCase(),
  );
  return otra?.usuario.usuario_id ?? null;
}

export function listarPolizas(filtro: { estado?: Exclude<EstadoPoliza, 'sin_poliza'> | 'todas'; q?: string }): Promise<FilaPoliza[]> {
  return simularRed(() => {
    const q = (filtro.q ?? '').trim().toLowerCase();
    return copia(
      registros
        .filter((r) => r.usuario.poliza)
        .filter((r) => !filtro.estado || filtro.estado === 'todas' || r.usuario.poliza!.estado_verificacion === filtro.estado)
        .filter((r) => !q || [r.usuario.usuario_id, r.usuario.correo, r.usuario.poliza!.policy_number, nombreDe(r.usuario)].some((v) => v.toLowerCase().includes(q)))
        // Las pendientes más viejas primero: es la cola de trabajo.
        .sort((a, b) => a.usuario.poliza!.fecha_vinculacion.localeCompare(b.usuario.poliza!.fecha_vinculacion))
        .map((r) => ({ usuario_id: r.usuario.usuario_id, correo: r.usuario.correo, birth_date: r.usuario.birth_date, poliza: r.usuario.poliza!, en_otra_cuenta: otraCuentaCon(r) })),
    );
  });
}

export interface ResultadoVerificacion {
  veredicto: Veredicto;
  dias_anulados: number;
  puntos_anulados: number;
  monedas_anuladas: number;
}

/** policies → verificar. Guarda la fecha confirmada y toma el veredicto ahora. */
export function verificarPoliza(usuario_id: string, birth_date_confirmada: string): Promise<ResultadoVerificacion> {
  return simularRed(() => {
    if (!puede('verificar_poliza')) throw new ErrorPanel('Tu rol no puede verificar pólizas.');
    const r = buscar(usuario_id);
    const p = r.usuario.poliza;
    if (!p) throw new ErrorPanel('Esta cuenta no tiene póliza.');
    if (p.estado_verificacion === 'verificada') throw new ErrorPanel('Esta póliza ya está verificada.');
    if (!birth_date_confirmada) throw new ErrorPanel('Falta la fecha de nacimiento confirmada por la aseguradora.', { birth_date_confirmada: 'Escribe la fecha que confirmó la aseguradora.' });
    if (birth_date_confirmada > HOY) throw new ErrorPanel('Revisa la fecha.', { birth_date_confirmada: 'No puede ser una fecha futura.' });
    const otra = otraCuentaCon(r);
    if (otra) throw new ErrorPanel(`Ya está verificada en otra cuenta (${otra}). Una cuenta verificada por póliza.`);

    const v = veredictoPrevio(r.usuario.birth_date, birth_date_confirmada, HOY);
    const ahora = new Date().toISOString();
    p.birth_date_confirmada = birth_date_confirmada;
    p.estado_verificacion = 'verificada';
    p.fecha_verificacion = ahora;
    p.motivo_rechazo = null;
    p.retroactivo = v.resultado;
    p.corte_retroactivo = v.resultado === 'denegado' ? HOY : null;

    let anulado = { dias: 0, puntos: 0, monedas: 0 };
    if (v.resultado === 'denegado') anulado = anularAntesDe(r, HOY, ahora);

    registrar(
      'verificar_poliza',
      usuario_id,
      `${p.policy_number} verificada · retroactivo ${v.resultado}${v.resultado === 'denegado' ? ` (${anulado.dias} días, ${anulado.puntos} pts, ${anulado.monedas} monedas anuladas)` : ''}`,
    );
    return { veredicto: v, dias_anulados: anulado.dias, puntos_anulados: anulado.puntos, monedas_anuladas: anulado.monedas };
  }, 600);
}

/** policies → rechazar. Rechazada cuenta igual que sin póliza; no toca el ledger. */
export function rechazarPoliza(usuario_id: string, motivo: string): Promise<void> {
  return simularRed(() => {
    if (!puede('verificar_poliza')) throw new ErrorPanel('Tu rol no puede rechazar pólizas.');
    const r = buscar(usuario_id);
    const p = r.usuario.poliza;
    if (!p) throw new ErrorPanel('Esta cuenta no tiene póliza.');
    if (p.estado_verificacion === 'verificada') throw new ErrorPanel('Una póliza verificada no se rechaza.');
    if (!motivo) throw new ErrorPanel('Elige el motivo.', { motivo: 'Elige el motivo del rechazo.' });
    p.estado_verificacion = 'rechazada';
    p.motivo_rechazo = motivo;
    p.fecha_verificacion = null;
    p.retroactivo = '';
    p.corte_retroactivo = null;
    registrar('rechazar_poliza', usuario_id, `${p.policy_number} rechazada · ${MOTIVOS_RECHAZO[motivo] ?? motivo}`);
  }, 500);
}

/* ================================================================= retroactivo */

export interface CasoRetroactivo {
  usuario_id: string;
  nombre: string;
  policy_number: string;
  birth_date: string;
  birth_date_confirmada: string;
  corte: string;
  dias: Array<{ fecha: string; puntos: number }>;
  puntos_anulados: number;
  monedas_anuladas: number;
}

/** Cuentas con el retroactivo denegado y lo que se anuló. Solo lectura. */
export function listarRetroactivoDenegado(): Promise<CasoRetroactivo[]> {
  return simularRed(() =>
    registros
      .filter((r) => r.usuario.poliza?.retroactivo === 'denegado')
      .map((r) => {
        const p = r.usuario.poliza!;
        const dias = r.puntos
          .filter((f) => f.tipo === 'retroactivo_denegado')
          .map((f) => ({ fecha: f.fecha, puntos: -f.puntos }))
          .sort((a, b) => b.fecha.localeCompare(a.fecha));
        const monedas = -r.monedas.filter((m) => m.motivo === 'Retroactivo denegado').reduce((s, m) => s + m.cantidad, 0);
        return {
          usuario_id: r.usuario.usuario_id,
          nombre: nombreDe(r.usuario),
          policy_number: p.policy_number,
          birth_date: r.usuario.birth_date,
          birth_date_confirmada: p.birth_date_confirmada ?? '',
          corte: p.corte_retroactivo ?? '',
          dias,
          puntos_anulados: dias.reduce((s, d) => s + d.puntos, 0),
          monedas_anuladas: monedas,
        };
      }),
  );
}
