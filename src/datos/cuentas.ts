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
 * - Una póliza verificada no se rechaza: se libera (queda libre para otra
 *   cuenta) y eso solo lo hace un admin, con motivo.
 * - Corregir la fecha de nacimiento confirmada vale hacia adelante y nunca
 *   le quita puntos a nadie (policies.CorreccionDeNacimiento).
 * - Dar de baja borra lo personal y conserva lo anónimo (cuenta/baja del
 *   contrato): no se deshace.
 */
import { pedir } from './api';
import { registrar } from './bitacora';
import { conectado } from './modo';
import { copia, ErrorPanel, hoyGT, simularRed } from './red';
import { correoActual, puede, type Accion } from './sesion';
import type { Nivel } from '@/components/ui/Niveles';

/* ================================================================= tipos */

export type EstadoPoliza = 'sin_poliza' | 'pendiente' | 'verificada' | 'rechazada';
export type Retroactivo = '' | 'aplicado' | 'tolerado' | 'denegado';

export const MOTIVOS_RECHAZO: Record<string, string> = {
  datos_no_coinciden: 'Los datos no coinciden con la aseguradora',
  poliza_no_vigente: 'La póliza no existe o no está vigente',
  poliza_en_otra_cuenta: 'Ya está verificada en otra cuenta',
  otro: 'Otro motivo',
  // No se elige al rechazar: lo pone "Liberar póliza".
  liberada: 'Liberada por el equipo',
};

/** Los motivos que se pueden elegir al rechazar. */
export const MOTIVOS_PARA_RECHAZAR = ['datos_no_coinciden', 'poliza_no_vigente', 'poliza_en_otra_cuenta', 'otro'] as const;

/** La aseguradora corrigió su fecha después de verificar. Solo se agregan filas. */
export interface CorreccionNacimiento {
  fecha_anterior: string;
  fecha_nueva: string;
  /** Desde qué día vale la nueva: lo anterior se sigue calculando con la de entonces. */
  desde: string;
  motivo: string;
  autor: string;
  creado_en: string;
}

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
  /** Cuándo el equipo restituyó lo anulado por un retroactivo denegado (fue error, no mentira). */
  retroactivo_restituido_en: string | null;
  correcciones: CorreccionNacimiento[];
}

export interface Usuario {
  usuario_id: string;
  correo: string;
  /** Si comprobó el correo con el código de 6 dígitos (6 nov 2026). */
  correo_verificado: boolean;
  /** Lo que escribió al registrarse. El de la póliza, si hay, va en `poliza`. */
  nombre: string | null;
  apellido: string | null;
  /** Como lo ven en las ligas y con lo que también entra: "ana.lopez", sin "@". null = todavía no lo elige. */
  nombre_de_miembro: string | null;
  tiene_foto: boolean;
  /** Fecha que declaró al registrarse. */
  birth_date: string;
  is_active: boolean;
  creado_en: string;
  /** Si se dio de baja: lo personal ya no existe y la cuenta no se puede cambiar. */
  dado_de_baja_en: string | null;
  poliza: Poliza | null;
}

/** users.Consentimiento: compartir los datos del día con la aseguradora. */
export interface EstadoConsentimiento {
  obligatorio: boolean;
  version_vigente: string;
  /** true solo con la versión vigente aceptada y sin revocar. */
  aceptado: boolean;
  version_aceptada: string | null;
  aceptado_en: string | null;
  revocado_en: string | null;
  /** Todas las aceptaciones, la más nueva primero. */
  historial: Array<{ version: string; aceptado_en: string; revocado_en: string | null }>;
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
  // El nombre del tipo viene del backend; hoy La Liga paga por temporada.
  liga_mensual: 'Podio de La Liga',
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
  /** Mandó muestras de ritmo cardíaco: sus workouts cuentan (cualquier marca). */
  mide_ritmo: boolean;
  ultima_muestra: string;
}

export interface SoporteSync {
  ultimo_sincronizado_en: string | null;
  app_version: string | null;
  zona_horaria: string | null;
  /**
   * Si el último envío de hoy trajo `pasos_por_hora` (A49): con él, los pasos
   * son el total de Apple Salud. false = app vieja o la lectura falló.
   */
  manda_pasos_por_hora: boolean | null;
  /**
   * Ventana de datos rezagados: los últimos 14 días. `cubierto` = el día se
   * calcula con el total de Salud; si no, con las muestras (regla por bloques).
   */
  ventana: Array<{ fecha: string; con_datos: boolean; pasos: number | null; cubierto: boolean }>;
  descartadas: { sesiones_sin_ritmo_cardiaco: number; datos_imposibles: number };
  dispositivos: Dispositivo[];
}

/** Fila de la lista de usuarios. */
export interface FilaUsuario {
  usuario_id: string;
  correo: string;
  nombre: string;
  nombre_de_miembro: string | null;
  is_active: boolean;
  dado_de_baja: boolean;
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
  /** Sesiones abiertas (tokens de knox vigentes): una por teléfono, 10 como mucho. */
  sesiones_activas: number;
  consentimiento: EstadoConsentimiento;
}

/* ================================================================= reglas */

/** Hoy en Guatemala. Los datos de muestra se arman hacia atrás desde aquí. */
export const HOY = hoyGT();
export const VERSION_ACTIVA = 'v3';
/** Un dato atrasado cuenta hasta 14 días después; un día solo se revierte dentro de esa ventana. */
export const VENTANA_REZAGADOS_DIAS = 14;
/** Más pasos que esto en un día es atípico (hoy el backend solo lo anota en el log). */
export const PASOS_DIA_ATIPICO = 60000;
const VERSION_CONSENTIMIENTO = '1';
/** La versión de la app que manda `pasos_por_hora`. Las anteriores no. */
const APP_CON_PASOS_POR_HORA = '1.1.0';

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

const esBisiesto = (a: number) => (a % 4 === 0 && a % 100 !== 0) || a % 400 === 0;

/** Como _mismo_dia_otro_anio del backend: el 29 de febrero cae en el 28 si el año no es bisiesto. */
function mismoDiaOtroAnio(f: string, anios: number): string {
  const [y, m, d] = f.split('-');
  const anio = Number(y) + anios;
  const dia = m === '02' && d === '29' && !esBisiesto(anio) ? '28' : d;
  return `${String(anio).padStart(4, '0')}-${m}-${dia}`;
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
  dispositivos?: (ultimo: string) => Dispositivo[];
  /** Lo que escribió al registrarse. Si falta, el de la póliza. */
  nombre?: string;
  apellido?: string;
  /** null = todavía no elige su nombre de miembro. Si falta, sale de su nombre. */
  miembro?: string | null;
  /** Un día con pasos imposibles, para la lista de días atípicos. */
  atipico?: { n: number; pasos: number };
  consentimiento?: 'nunca' | 'revocado';
  correoSinVerificar?: boolean;
  sesiones?: number;
}

const IPHONE = (nombre: string, ultima: string): Dispositivo => ({
  nombre,
  modelo: 'iPhone',
  tipo: 'telefono',
  fuente_bundle: 'com.apple.health',
  mide_ritmo: false,
  ultima_muestra: ultima,
});
const WATCH = (nombre: string, ultima: string): Dispositivo => ({
  nombre,
  modelo: 'Watch',
  tipo: 'reloj',
  fuente_bundle: 'com.apple.health',
  mide_ritmo: true,
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
    nombre: 'Mariela',
    apellido: 'Ochoa',
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
    consentimiento: 'revocado',
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
    // Cuenta de antes del 7 nov: todavía no elige su nombre de miembro.
    miembro: null,
  },
  {
    id: 'u_e5d9',
    correo: 'ana.gt@icloud.com',
    nac: '1972-04-18',
    poliza: { policy_number: 'GT-207-22561', nombre: 'Ana', apellido: 'Gálvez', estado_verificacion: 'pendiente', birth_date_confirmada: '1974-04-18' },
    sinSync: 0,
    actividad: 0.65,
    atipico: { n: 4, pasos: 71480 },
  },
  {
    id: 'u_0a71',
    correo: 'pablo.ruiz@gmail.com',
    nombre: 'Pablo',
    apellido: 'Ruiz',
    miembro: null,
    nac: '2001-09-09',
    sinSync: null,
    actividad: 0,
    consentimiento: 'nunca',
    correoSinVerificar: true,
    sesiones: 0,
  },
  {
    id: 'u_b2f8',
    correo: 'gabriela.soto@gmail.com',
    nac: '1958-06-25',
    poliza: { policy_number: 'GT-301-01544', nombre: 'Gabriela', apellido: 'Soto', estado_verificacion: 'verificada', birth_date_confirmada: '1958-06-25', retroactivo: 'tolerado', fecha_verificacion: '2026-10-05T08:45:00-06:00' },
    sinSync: 3,
    actividad: 0.55,
    diasSinDatos: [3, 4, 9],
    sesiones: 3,
  },
  {
    id: 'u_6c40',
    correo: 'marco.v@gmail.com',
    nac: '1993-10-03',
    poliza: { policy_number: 'GT-114-55021', nombre: 'Marco', apellido: 'Villagrán', estado_verificacion: 'pendiente', birth_date_confirmada: '1993-10-03' },
    sinSync: 1,
    actividad: 0.7,
    activo: true,
    // Pide la póliza de Andrea y manda los datos del iPhone de Andrea: para Antifraude.
    dispositivos: (ultimo) => [IPHONE('iPhone de Andrea', ultimo)],
    atipico: { n: 2, pasos: 63900 },
  },
];

interface Registro {
  usuario: Usuario;
  puntos: FilaLedger[];
  monedas: FilaMonedas[];
  sync: SoporteSync;
  sesiones: number;
  consentimientos: EstadoConsentimiento['historial'];
  atipicos: Array<{ fecha: string; pasos: number }>;
}

const sinTildes = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '');

/** "José Luis" + "Pérez" → "jose.perez", como lo propone la app. */
function miembroDe(nombre: string | null, apellido: string | null): string | null {
  if (!nombre) return null;
  const partes = [nombre.trim().split(/\s+/)[0]!, ...(apellido ? [apellido.trim().split(/\s+/).pop()!] : [])];
  return sinTildes(partes.join('.')).toLowerCase().replace(/[^a-z0-9._]/g, '').slice(0, 20);
}

let siguienteFila = 1;

function construir(s: Semilla): Registro {
  const r = rng(s.id);
  const puntos: FilaLedger[] = [];
  const monedas: FilaMonedas[] = [];
  const ventana: SoporteSync['ventana'] = [];
  const sinDatos = new Set(s.diasSinDatos ?? []);
  const nunca = s.sinSync === null;
  const atipicos: Registro['atipicos'] = [];
  const appNueva = (s.version ?? APP_CON_PASOS_POR_HORA) >= APP_CON_PASOS_POR_HORA;

  for (let n = 59; n >= 1; n--) {
    const f = diasAtras(n);
    const esAtipico = s.atipico?.n === n;
    const hayDatos = (!nunca && !sinDatos.has(n) && r() < 0.92) || esAtipico;
    const normales = hayDatos ? Math.round(2500 + r() * 15000 * s.actividad + 3000 * s.actividad) : null;
    const pasos = esAtipico ? s.atipico!.pasos : normales;
    if (pasos !== null && pasos > PASOS_DIA_ATIPICO) atipicos.push({ fecha: f, pasos });
    // Un día queda cubierto por el total de Salud solo con la app que manda pasos_por_hora.
    if (n <= 14) ventana.unshift({ fecha: f, con_datos: hayDatos, pasos, cubierto: hayDatos && appNueva });
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
    monedas.push({ id: siguienteFila++, fecha: '2026-11-09', tipo: 'liga_mensual', cantidad: 20, fecha_expiracion: '2027-01-03', creado_en: '2026-11-09T00:05:00-06:00' });

  const ultimo = s.sinSync === null ? null : `${diasAtras(s.sinSync)}T${s.sinSync === 0 ? '07:42' : '20:15'}:00-06:00`;
  const nombreReg = s.nombre ?? s.poliza?.nombre ?? null;
  const apellidoReg = s.apellido ?? s.poliza?.apellido ?? null;
  const nombre = nombreReg ?? s.correo.split('@')[0]!;
  const dispositivos =
    ultimo === null ? [] : s.dispositivos ? s.dispositivos(ultimo) : s.actividad > 0.6 ? [IPHONE(`iPhone de ${nombre}`, ultimo), WATCH(`Apple Watch de ${nombre}`, ultimo)] : [IPHONE(`iPhone de ${nombre}`, ultimo)];

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
        retroactivo_restituido_en: null,
        correcciones: [],
        ...s.poliza,
      }
    : null;

  const creado = '2026-09-28T12:00:00-06:00';
  const consentimientos: Registro['consentimientos'] =
    s.consentimiento === 'nunca'
      ? []
      : [{ version: VERSION_CONSENTIMIENTO, aceptado_en: '2026-09-28T12:05:00-06:00', revocado_en: s.consentimiento === 'revocado' ? `${diasAtras(6)}T18:02:00-06:00` : null }];

  const reg: Registro = {
    usuario: {
      usuario_id: s.id,
      correo: s.correo,
      correo_verificado: !s.correoSinVerificar,
      nombre: nombreReg,
      apellido: apellidoReg,
      nombre_de_miembro: s.miembro === undefined ? miembroDe(nombreReg, apellidoReg) : s.miembro,
      tiene_foto: s.actividad > 0.75,
      birth_date: s.nac,
      is_active: s.activo ?? true,
      creado_en: creado,
      dado_de_baja_en: null,
      poliza,
    },
    puntos,
    monedas,
    sync: {
      ultimo_sincronizado_en: ultimo,
      app_version: ultimo === null ? null : (s.version ?? APP_CON_PASOS_POR_HORA),
      zona_horaria: ultimo === null ? null : 'America/Guatemala',
      manda_pasos_por_hora: ultimo === null ? null : appNueva,
      ventana,
      descartadas: { sesiones_sin_ritmo_cardiaco: nunca ? 0 : Math.floor(r() * 4), datos_imposibles: nunca ? 0 : r() < 0.2 ? 1 : 0 },
      dispositivos,
    },
    sesiones: s.sesiones ?? (nunca ? 0 : s.actividad > 0.75 ? 2 : 1),
    consentimientos,
    atipicos,
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
    // (el mismo texto que MOTIVO_ANULACION: así se encuentra lo anulado)
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
    nombre: nombreDe(r.usuario),
    nombre_de_miembro: r.usuario.nombre_de_miembro,
    is_active: r.usuario.is_active,
    dado_de_baja: r.usuario.dado_de_baja_en !== null,
    estado_poliza: estadoDe(r.usuario),
    motivo_rechazo: r.usuario.poliza?.motivo_rechazo ?? null,
    policy_number: r.usuario.poliza?.policy_number ?? null,
    puntos_anio: p,
    nivel: nivelDe(p),
    saldo_monedas: saldo(r),
    ultimo_sync: r.sync.ultimo_sincronizado_en,
  };
}

/**
 * Cómo llamar a la persona en el panel: el nombre de la aseguradora si hay
 * póliza, si no el que escribió al registrarse, y si no su nombre de miembro.
 */
function nombreDe(u: Usuario): string {
  if (u.dado_de_baja_en) return 'Cuenta dada de baja';
  const p = u.poliza;
  if (p?.nombre) return `${p.nombre} ${p.apellido ?? ''}`.trim();
  if (u.nombre) return `${u.nombre} ${u.apellido ?? ''}`.trim();
  return u.nombre_de_miembro ?? u.correo.split('@')[0]!;
}

export { nombreDe };

function consentimientoDe(r: Registro): EstadoConsentimiento {
  const ultimo = r.consentimientos[r.consentimientos.length - 1] ?? null;
  return {
    obligatorio: false,
    version_vigente: VERSION_CONSENTIMIENTO,
    aceptado: !!ultimo && ultimo.version === VERSION_CONSENTIMIENTO && !ultimo.revocado_en,
    version_aceptada: ultimo?.version ?? null,
    aceptado_en: ultimo?.aceptado_en ?? null,
    revocado_en: ultimo?.revocado_en ?? null,
    historial: [...r.consentimientos].reverse(),
  };
}

/* ----------------------------------------------------------------- reglas comunes de las acciones */

function exigir(accion: Accion, texto: string): void {
  if (!puede(accion)) throw new ErrorPanel(texto);
}

function motivoValido(motivo: string): string {
  const m = motivo.trim();
  if (m.length < 5) throw new ErrorPanel('Falta el motivo.', { motivo: 'Escribe el motivo: queda en la bitácora.' });
  return m;
}

/** Una cuenta dada de baja ya no se cambia: lo personal no existe. */
function sinBaja(r: Registro): void {
  if (r.usuario.dado_de_baja_en) throw new ErrorPanel('Esta cuenta se dio de baja: ya no se puede cambiar.');
}

/* ----------------------------------------------------------------- para los otros mocks */

export interface CuentaDeMuestra {
  usuario_id: string;
  nombre: string;
  nombre_de_miembro: string | null;
  estado_poliza: EstadoPoliza;
  policy_number: string | null;
  retroactivo: Retroactivo;
  retroactivo_restituido: boolean;
  dado_de_baja: boolean;
  atipicos: Array<{ fecha: string; pasos: number; puntos_dia: number }>;
  dispositivos: Dispositivo[];
}

/** Para antifraude.ts y tusLigas.ts (mock): las cuentas de muestra, como están ahora. */
export function cuentasDeMuestra(): CuentaDeMuestra[] {
  return registros.map((r) => ({
    usuario_id: r.usuario.usuario_id,
    nombre: nombreDe(r.usuario),
    nombre_de_miembro: r.usuario.nombre_de_miembro,
    estado_poliza: estadoDe(r.usuario),
    policy_number: r.usuario.poliza?.policy_number ?? null,
    retroactivo: r.usuario.poliza?.retroactivo ?? '',
    retroactivo_restituido: !!r.usuario.poliza?.retroactivo_restituido_en,
    dado_de_baja: r.usuario.dado_de_baja_en !== null,
    atipicos: r.atipicos.map((a) => ({ ...a, puntos_dia: r.puntos.filter((f) => f.fecha === a.fecha).reduce((s, f) => s + f.puntos, 0) })),
    dispositivos: r.sync.dispositivos,
  }));
}

/* ================================================================= usuarios */

export function listarUsuarios(filtro: { q?: string; estado?: EstadoPoliza | 'todos' }): Promise<FilaUsuario[]> {
  if (conectado('usuarios')) return pedir<FilaUsuario[]>('/api/v1/admin/usuarios', { query: { q: filtro.q, estado: filtro.estado === 'todos' ? undefined : filtro.estado } });
  return simularRed(() => {
    // "@ana.lopez" y "ana.lopez" buscan lo mismo.
    const q = (filtro.q ?? '').trim().toLowerCase().replace(/^@/, '');
    return registros
      .filter((r) => !filtro.estado || filtro.estado === 'todos' || estadoDe(r.usuario) === filtro.estado)
      .filter((r) => {
        if (!q) return true;
        const u = r.usuario;
        return [u.usuario_id, u.correo, u.nombre_de_miembro ?? '', u.poliza?.policy_number ?? '', nombreDe(u)].some((v) => v.toLowerCase().includes(q));
      })
      .map(fila);
  });
}

export function contarPorEstado(): Promise<Record<EstadoPoliza | 'todos', number>> {
  if (conectado('usuarios')) return pedir('/api/v1/admin/usuarios/conteo');
  return simularRed(() => {
    const c = { todos: registros.length, sin_poliza: 0, pendiente: 0, verificada: 0, rechazada: 0 };
    for (const r of registros) c[estadoDe(r.usuario)]++;
    return c;
  }, 150);
}

export function obtenerFicha(usuario_id: string): Promise<FichaUsuario> {
  if (conectado('usuarios')) return pedir<FichaUsuario>(`/api/v1/admin/usuarios/${encodeURIComponent(usuario_id)}`);
  return simularRed(() => {
    const r = buscar(usuario_id);
    const p = puntosAnio(r);
    return copia({
      usuario: r.usuario,
      estado_poliza: estadoDe(r.usuario),
      puntos_anio: p,
      nivel: nivelDe(p),
      saldo_monedas: saldo(r),
      version_regla_activa: VERSION_ACTIVA,
      sesiones_activas: r.sesiones,
      consentimiento: consentimientoDe(r),
    });
  });
}

/* ================================================================= acciones sobre la cuenta */

/**
 * Desactiva o reactiva una cuenta. Desactivada no entra ni suma (is_active),
 * y se le cierran las sesiones. No borra nada: para eso está la baja.
 */
export function cambiarEstadoCuenta(usuario_id: string, activa: boolean, motivo: string): Promise<void> {
  if (conectado('usuarios')) return pedir<void>(`/api/v1/admin/usuarios/${encodeURIComponent(usuario_id)}`, { metodo: 'PATCH', cuerpo: { is_active: activa, motivo } });
  return simularRed(() => {
    exigir('administrar_cuenta', 'Tu rol no puede desactivar cuentas.');
    const r = buscar(usuario_id);
    sinBaja(r);
    const m = motivoValido(motivo);
    if (r.usuario.is_active === activa) throw new ErrorPanel(activa ? 'La cuenta ya está activa.' : 'La cuenta ya está desactivada.');
    r.usuario.is_active = activa;
    if (!activa) r.sesiones = 0;
    registrar('estado_cuenta', usuario_id, `${activa ? 'Reactivada' : 'Desactivada'} · ${m}`);
  }, 500);
}

/**
 * Cierra todas las sesiones de la cuenta (lo mismo que su `logout/todos`), por
 * ejemplo si perdió el teléfono. Tiene que volver a entrar; no pierde datos.
 */
export function cerrarSesiones(usuario_id: string): Promise<{ cerradas: number }> {
  if (conectado('usuarios')) return pedir<{ cerradas: number }>(`/api/v1/admin/usuarios/${encodeURIComponent(usuario_id)}/cerrar-sesiones`, { metodo: 'POST' });
  return simularRed(() => {
    exigir('atender_cuenta', 'Tu rol no puede cerrar sesiones.');
    const r = buscar(usuario_id);
    sinBaja(r);
    const cerradas = r.sesiones;
    r.sesiones = 0;
    registrar('cerrar_sesiones', usuario_id, cerradas === 1 ? '1 sesión cerrada' : `${cerradas} sesiones cerradas`);
    return { cerradas };
  }, 500);
}

/**
 * Baja de cuenta a pedido. Lo mismo que hace `POST /api/v1/cuenta/baja` desde
 * la app: borra lo personal (correo, nombre, nombre de miembro, foto, póliza,
 * nombres de dispositivo; de la fecha de nacimiento queda solo el año),
 * revoca el consentimiento y cierra las sesiones. Conserva lo anónimo: los
 * ledgers, los resúmenes y los cupones. No se deshace.
 */
export function darDeBaja(usuario_id: string, motivo: string): Promise<void> {
  if (conectado('usuarios')) return pedir<void>(`/api/v1/admin/usuarios/${encodeURIComponent(usuario_id)}/baja`, { cuerpo: { motivo } });
  return simularRed(() => {
    exigir('administrar_cuenta', 'Tu rol no puede dar de baja cuentas.');
    const r = buscar(usuario_id);
    sinBaja(r);
    const m = motivoValido(motivo);
    const u = r.usuario;
    const ahora = new Date().toISOString();
    u.correo = `baja-${u.usuario_id}`;
    u.correo_verificado = false;
    u.nombre = null;
    u.apellido = null;
    u.nombre_de_miembro = null;
    u.tiene_foto = false;
    u.birth_date = `${u.birth_date.slice(0, 4)}-01-01`;
    u.is_active = false;
    u.poliza = null;
    u.dado_de_baja_en = ahora;
    r.sesiones = 0;
    for (const c of r.consentimientos) c.revocado_en ??= ahora;
    for (const d of r.sync.dispositivos) d.nombre = 'Sin nombre';
    // El detalle no lleva nada personal: la bitácora no se borra.
    registrar('baja_cuenta', usuario_id, `Baja a pedido · ${m}`);
  }, 700);
}

/** Ledger de puntos, más nuevo primero. Solo lectura. */
export function listarLedgerPuntos(usuario_id: string): Promise<FilaLedger[]> {
  if (conectado('usuarios')) return pedir<FilaLedger[]>(`/api/v1/admin/usuarios/${encodeURIComponent(usuario_id)}/puntos`);
  return simularRed(() => copia([...buscar(usuario_id).puntos].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id)));
}

/** Ledger de monedas, más nuevo primero. Solo lectura. */
export function listarLedgerMonedas(usuario_id: string): Promise<FilaMonedas[]> {
  if (conectado('usuarios')) return pedir<FilaMonedas[]>(`/api/v1/admin/usuarios/${encodeURIComponent(usuario_id)}/monedas`);
  return simularRed(() => copia([...buscar(usuario_id).monedas].sort((a, b) => b.fecha.localeCompare(a.fecha) || b.id - a.id)));
}

export function obtenerSync(usuario_id: string): Promise<SoporteSync> {
  if (conectado('usuarios')) return pedir<SoporteSync>(`/api/v1/admin/usuarios/${encodeURIComponent(usuario_id)}/sync`);
  return simularRed(() => copia(buscar(usuario_id).sync));
}

/**
 * Revierte los puntos de un día con una fila de ajuste de signo contrario.
 * Solo dentro de la ventana de datos rezagados (14 días): después el día ya
 * pudo entrar a un ciclo cerrado. El día queda en 0; sus muestras no se tocan.
 */
export function revertirDia(usuario_id: string, fecha: string, motivo: string): Promise<{ puntos: number }> {
  if (conectado('usuarios')) return pedir<{ puntos: number }>(`/api/v1/admin/usuarios/${encodeURIComponent(usuario_id)}/revertir-dia`, { cuerpo: { fecha, motivo } });
  return simularRed(() => {
    exigir('ajustar_ledger', 'Tu rol no puede revertir puntos.');
    const r = buscar(usuario_id);
    sinBaja(r);
    const campos: Record<string, string> = {};
    if (!fecha) campos.fecha = 'Elige el día.';
    else if (fecha > HOY) campos.fecha = 'No puede ser un día futuro.';
    else if (fecha < diasAtras(VENTANA_REZAGADOS_DIAS)) campos.fecha = `Solo se revierte un día de los últimos ${VENTANA_REZAGADOS_DIAS}.`;
    if (motivo.trim().length < 5) campos.motivo = 'Escribe el motivo: queda en la fila y en la bitácora.';
    const delDia = r.puntos.filter((f) => f.fecha === fecha).reduce((s, f) => s + f.puntos, 0);
    if (!campos.fecha && delDia <= 0) campos.fecha = 'Ese día no tiene puntos acreditados.';
    if (Object.keys(campos).length) throw new ErrorPanel('Revisa los campos marcados.', campos);
    const m = motivo.trim();
    r.puntos.push({ id: siguienteFila++, fecha, tipo: 'ajuste_manual', puntos: -delDia, puntos_pasos: null, puntos_intensidad: null, tope_diario_aplicado: null, version_regla: VERSION_ACTIVA, creado_en: new Date().toISOString(), motivo: `Día revertido: ${m}`, autor: correoActual() });
    registrar('revertir_dia', usuario_id, `−${delDia} pts del ${fecha} · ${m}`);
    return { puntos: delDia };
  }, 500);
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
  if (conectado('usuarios')) return pedir<void>(`/api/v1/admin/usuarios/${encodeURIComponent(usuario_id)}/ajustes`, { cuerpo: a });
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
      r.puntos.push({ id: siguienteFila++, fecha: a.fecha, tipo: 'ajuste_manual', puntos: a.cantidad, puntos_pasos: null, puntos_intensidad: null, tope_diario_aplicado: null, version_regla: VERSION_ACTIVA, creado_en: ahora, motivo, autor: correoActual() });
      registrar('ajuste_puntos', usuario_id, `${a.cantidad > 0 ? '+' : ''}${a.cantidad} pts el ${a.fecha} · ${motivo}`);
    } else {
      r.monedas.push({ id: siguienteFila++, fecha: a.fecha, tipo: 'ajuste_manual', cantidad: a.cantidad, fecha_expiracion: a.cantidad > 0 ? '2027-01-03' : null, creado_en: ahora, motivo, autor: correoActual() });
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
  if (conectado('polizas')) return pedir<FilaPoliza[]>('/api/v1/admin/polizas', { query: { estado: filtro.estado === 'todas' ? undefined : filtro.estado, q: filtro.q } });
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
  if (conectado('polizas')) return pedir<ResultadoVerificacion>(`/api/v1/admin/polizas/${encodeURIComponent(usuario_id)}/verificar`, { cuerpo: { birth_date_confirmada } });
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
  if (conectado('polizas')) return pedir<void>(`/api/v1/admin/polizas/${encodeURIComponent(usuario_id)}/rechazar`, { cuerpo: { motivo } });
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

/**
 * Libera una póliza verificada para que su titular la vincule en otra cuenta
 * (una sola cuenta verificada por póliza). En esta cuenta queda como
 * rechazada con el motivo `liberada`: deja de canjear y sale de La Liga. No
 * toca los ledgers.
 */
export function liberarPoliza(usuario_id: string, motivo: string): Promise<void> {
  if (conectado('polizas')) return pedir<void>(`/api/v1/admin/polizas/${encodeURIComponent(usuario_id)}/liberar`, { cuerpo: { motivo } });
  return simularRed(() => {
    exigir('administrar_cuenta', 'Tu rol no puede liberar pólizas.');
    const r = buscar(usuario_id);
    const p = r.usuario.poliza;
    if (!p) throw new ErrorPanel('Esta cuenta no tiene póliza.');
    if (p.estado_verificacion !== 'verificada') throw new ErrorPanel('Solo se libera una póliza verificada.');
    const m = motivoValido(motivo);
    p.estado_verificacion = 'rechazada';
    p.motivo_rechazo = 'liberada';
    registrar('liberar_poliza', usuario_id, `${p.policy_number} liberada · ${m}`);
  }, 500);
}

/**
 * La aseguradora corrigió su fecha después de verificar. Vale hacia adelante
 * (desde hoy) y nunca le quita puntos a la persona; el veredicto del
 * retroactivo no cambia. Sumar hacia atrás, si la fecha corregida le daba
 * más, es aparte: un ajuste en su ledger, caso por caso.
 */
export function corregirNacimiento(usuario_id: string, fecha_nueva: string, motivo: string): Promise<CorreccionNacimiento> {
  if (conectado('polizas')) return pedir<CorreccionNacimiento>(`/api/v1/admin/polizas/${encodeURIComponent(usuario_id)}/corregir-nacimiento`, { cuerpo: { fecha_nueva, motivo } });
  return simularRed(() => {
    exigir('administrar_cuenta', 'Tu rol no puede corregir la fecha de nacimiento.');
    const r = buscar(usuario_id);
    const p = r.usuario.poliza;
    if (!p || p.estado_verificacion !== 'verificada' || !p.birth_date_confirmada) throw new ErrorPanel('Solo se corrige la fecha de una póliza verificada.');
    const campos: Record<string, string> = {};
    if (!fecha_nueva) campos.fecha_nueva = 'Escribe la fecha que confirmó la aseguradora.';
    else if (fecha_nueva > HOY) campos.fecha_nueva = 'No puede ser una fecha futura.';
    else if (fecha_nueva === p.birth_date_confirmada) campos.fecha_nueva = 'Es la misma fecha que ya tiene.';
    if (motivo.trim().length < 5) campos.motivo = 'Escribe el motivo: queda en la bitácora.';
    if (Object.keys(campos).length) throw new ErrorPanel('Revisa los campos marcados.', campos);
    const c: CorreccionNacimiento = { fecha_anterior: p.birth_date_confirmada, fecha_nueva, desde: HOY, motivo: motivo.trim(), autor: correoActual(), creado_en: new Date().toISOString() };
    p.correcciones.push(c);
    p.birth_date_confirmada = fecha_nueva;
    registrar('corregir_nacimiento', usuario_id, `${p.policy_number}: ${c.fecha_anterior} → ${fecha_nueva}, vale desde ${HOY} · ${c.motivo}`);
    return copia(c);
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
  /** Si ya se restituyó (fue un error, no una mentira). */
  restituido_en: string | null;
}

export interface ResultadoRestitucion {
  dias: number;
  puntos: number;
  monedas: number;
}

const MOTIVO_ANULACION = 'Retroactivo denegado';

/**
 * Restituye lo anulado por un retroactivo denegado cuando, al revisarlo, fue
 * un error y no una mentira. Una fila de ajuste positiva por cada día anulado
 * y otra con las monedas: lo anulado no se borra. El veredicto queda como
 * estaba (no se recalcula), con la fecha de la restitución.
 */
export function restituirRetroactivo(usuario_id: string, motivo: string): Promise<ResultadoRestitucion> {
  if (conectado('retroactivo')) return pedir<ResultadoRestitucion>(`/api/v1/admin/retroactivo/${encodeURIComponent(usuario_id)}/restituir`, { cuerpo: { motivo } });
  return simularRed(() => {
    exigir('administrar_cuenta', 'Tu rol no puede restituir un retroactivo.');
    const r = buscar(usuario_id);
    const p = r.usuario.poliza;
    if (!p || p.retroactivo !== 'denegado') throw new ErrorPanel('Esta cuenta no tiene el retroactivo denegado.');
    if (p.retroactivo_restituido_en) throw new ErrorPanel('Este retroactivo ya se restituyó.');
    const m = motivoValido(motivo);
    const ahora = new Date().toISOString();
    const autor = correoActual();
    const anuladas = r.puntos.filter((f) => f.tipo === 'retroactivo_denegado');
    let puntos = 0;
    for (const f of anuladas) {
      r.puntos.push({ id: siguienteFila++, fecha: f.fecha, tipo: 'ajuste_manual', puntos: -f.puntos, puntos_pasos: null, puntos_intensidad: null, tope_diario_aplicado: null, version_regla: f.version_regla, creado_en: ahora, motivo: `Restitución del retroactivo: ${m}`, autor });
      puntos += -f.puntos;
    }
    const monedas = -r.monedas.filter((x) => x.motivo === MOTIVO_ANULACION).reduce((s, x) => s + x.cantidad, 0);
    if (monedas > 0) r.monedas.push({ id: siguienteFila++, fecha: HOY, tipo: 'ajuste_manual', cantidad: monedas, fecha_expiracion: '2027-01-03', creado_en: ahora, motivo: `Restitución del retroactivo: ${m}`, autor });
    p.retroactivo_restituido_en = ahora;
    registrar('restituir_retroactivo', usuario_id, `${anuladas.length} días, ${puntos} pts y ${monedas} monedas restituidos · ${m}`);
    return { dias: anuladas.length, puntos, monedas };
  }, 700);
}

/** Cuentas con el retroactivo denegado y lo que se anuló. */
export function listarRetroactivoDenegado(): Promise<CasoRetroactivo[]> {
  if (conectado('retroactivo')) return pedir<CasoRetroactivo[]>('/api/v1/admin/retroactivo');
  return simularRed(() =>
    registros
      .filter((r) => r.usuario.poliza?.retroactivo === 'denegado')
      .map((r) => {
        const p = r.usuario.poliza!;
        const dias = r.puntos
          .filter((f) => f.tipo === 'retroactivo_denegado')
          .map((f) => ({ fecha: f.fecha, puntos: -f.puntos }))
          .sort((a, b) => b.fecha.localeCompare(a.fecha));
        const monedas = -r.monedas.filter((m) => m.motivo === MOTIVO_ANULACION).reduce((s, m) => s + m.cantidad, 0);
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
          restituido_en: p.retroactivo_restituido_en,
        };
      }),
  );
}
