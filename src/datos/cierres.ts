/*
 * Estado del programador y de los cierres. Futuro: /api/v1/admin/cierres/…
 *
 * Cómo corre en el backend (services/programador.py, hora de Guatemala):
 *   martes 00:00 → cierre: fija el resultado de la semana y paga las monedas
 *   martes 12:00 → corrección: actualiza acumulados, no paga ni reabre
 *   día 2, 00:00 → liga: cierra La Liga del mes anterior
 *   día 9, 00:00 → pago_liga: paga el podio del mes cerrado
 * Si una corrida falla, se reintenta cada 5 min hasta 12 veces. Los cierres
 * corren de a uno (candado de PostgreSQL): uno manual con otro en curso sale
 * con "Hay otro cierre en curso".
 *
 * Hoy el backend NO guarda las corridas (solo el log): ver PENDIENTES_BACKEND.md §6.
 */
import { registrar } from './bitacora';
import { cerrarSemanasPendientes } from './objetivos';
import { copia, ErrorPanel, hoyGT, simularRed } from './red';
import { puede, sesionActual } from './sesion';

export type TipoCorrida = 'cierre' | 'correccion' | 'liga' | 'pago_liga';
export type EstadoCorrida = 'ok' | 'fallo' | 'en_curso';

export const NOMBRE_CORRIDA: Record<TipoCorrida, string> = {
  cierre: 'Cierre semanal',
  correccion: 'Corrección',
  liga: 'Cierre de La Liga',
  pago_liga: 'Pago del podio',
};

export const CUANDO_CORRE: Record<TipoCorrida, string> = {
  cierre: 'Martes 00:00',
  correccion: 'Martes 12:00',
  liga: 'Día 2, 00:00',
  pago_liga: 'Día 9, 00:00',
};

export const MAX_INTENTOS = 12;

export interface Corrida {
  id: number;
  tipo: TipoCorrida;
  /** Cuándo tocaba. null en las manuales. */
  programada_para: string | null;
  empezo: string;
  termino: string | null;
  estado: EstadoCorrida;
  intentos: number;
  error: string | null;
  /** Qué hizo: "Semana 44: 92 personas, 37 completaron…" */
  resumen: string;
  /** "programador" o el correo de quien la corrió a mano. */
  origen: string;
}

export interface EstadoProgramador {
  /** El último latido del proceso. Si pasa mucho sin latir, el servicio está caído. */
  ultimo_latido: string;
  corridas: Corrida[];
  proximas: Array<{ tipo: TipoCorrida; cuando: string }>;
  hay_cierre_en_curso: boolean;
}

/* ================================================================= fechas */

const HOY = hoyGT();

function sumar(f: string, dias: number): string {
  const d = new Date(`${f}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** El martes más reciente que ya pasó (o hoy si es martes). */
function ultimoMartes(desde = HOY): string {
  const d = new Date(`${desde}T12:00:00Z`);
  const atras = (d.getUTCDay() - 2 + 7) % 7;
  return sumar(desde, -atras);
}

const iso = (fecha: string, hora: string) => `${fecha}T${hora}:00-06:00`;

/* ================================================================= mock */

let siguienteId = 1;
const corridas: Corrida[] = [];

(function sembrar() {
  const martes = ultimoMartes();
  // Cinco semanas de cierres y correcciones hacia atrás.
  for (let s = 4; s >= 0; s--) {
    const m = sumar(martes, -7 * s);
    const lunes = sumar(m, -8);
    const semanaN = 5 - s;
    const evaluados = 88 + (s % 5);
    const completaron = 30 + ((s * 7) % 11);
    const conReintentos = s === 2;
    corridas.push({
      id: siguienteId++,
      tipo: 'cierre',
      programada_para: iso(m, '00:00'),
      empezo: iso(m, conReintentos ? '00:10' : '00:00'),
      termino: iso(m, conReintentos ? '00:12' : '00:02'),
      estado: 'ok',
      intentos: conReintentos ? 3 : 1,
      error: conReintentos ? 'OperationalError: could not connect to server (se recuperó en el intento 3)' : null,
      resumen: `Semana ${semanaN} (del ${lunes}): ${evaluados} personas, ${completaron} completaron, ${completaron * 10 + 40} monedas pagadas`,
      origen: 'programador',
    });
    corridas.push({
      id: siguienteId++,
      tipo: 'correccion',
      programada_para: iso(m, '12:00'),
      empezo: iso(m, '12:00'),
      termino: iso(m, '12:01'),
      estado: 'ok',
      intentos: 1,
      error: null,
      resumen: `Semana ${semanaN}: ${s % 2 === 0 ? 2 : 0} acumulados actualizados con datos atrasados`,
      origen: 'programador',
    });
  }
  corridas.push(
    {
      id: siguienteId++,
      tipo: 'liga',
      programada_para: iso('2026-11-02', '00:00'),
      empezo: iso('2026-11-02', '00:00'),
      termino: iso('2026-11-02', '00:01'),
      estado: 'ok',
      intentos: 1,
      error: null,
      resumen: 'La Liga de octubre: 61 participantes, podio fijado',
      origen: 'programador',
    },
    {
      id: siguienteId++,
      tipo: 'pago_liga',
      programada_para: iso('2026-10-09', '00:00'),
      empezo: iso('2026-10-09', '00:00'),
      termino: iso('2026-10-09', '00:00'),
      estado: 'ok',
      intentos: 1,
      error: null,
      resumen: 'La Liga de septiembre: 30 + 20 + 10 monedas pagadas al podio',
      origen: 'programador',
    },
  );
})();

let enCurso: Corrida | null = null;

function proximas(): EstadoProgramador['proximas'] {
  const ahora = new Date();
  const candidatas: Array<{ tipo: TipoCorrida; cuando: string }> = [];
  for (let i = 0; i <= 14; i++) {
    const f = sumar(HOY, i);
    const dia = new Date(`${f}T12:00:00Z`);
    if (dia.getUTCDay() === 2) {
      candidatas.push({ tipo: 'cierre', cuando: iso(f, '00:00') }, { tipo: 'correccion', cuando: iso(f, '12:00') });
    }
    if (dia.getUTCDate() === 2) candidatas.push({ tipo: 'liga', cuando: iso(f, '00:00') });
    if (dia.getUTCDate() === 9) candidatas.push({ tipo: 'pago_liga', cuando: iso(f, '00:00') });
  }
  // Las de los próximos 40 días, para que siempre salgan las cuatro.
  for (let i = 15; i <= 40; i++) {
    const f = sumar(HOY, i);
    const d = new Date(`${f}T12:00:00Z`).getUTCDate();
    if (d === 2) candidatas.push({ tipo: 'liga', cuando: iso(f, '00:00') });
    if (d === 9) candidatas.push({ tipo: 'pago_liga', cuando: iso(f, '00:00') });
  }
  const futuras = candidatas.filter((c) => new Date(c.cuando) > ahora).sort((a, b) => a.cuando.localeCompare(b.cuando));
  const vistas = new Set<TipoCorrida>();
  return futuras.filter((c) => (vistas.has(c.tipo) ? false : (vistas.add(c.tipo), true)));
}

/* ================================================================= API */

export function obtenerEstadoProgramador(): Promise<EstadoProgramador> {
  return simularRed(() =>
    copia({
      ultimo_latido: new Date(Date.now() - 40_000).toISOString(),
      corridas: [...corridas, ...(enCurso ? [enCurso] : [])].sort((a, b) => b.empezo.localeCompare(a.empezo)),
      proximas: proximas(),
      hay_cierre_en_curso: enCurso !== null,
    }),
  );
}

/** La última corrida terminada de cada tipo, para el inicio. */
export function ultimaCorrida(): Corrida | null {
  return [...corridas].sort((a, b) => b.empezo.localeCompare(a.empezo))[0] ?? null;
}

/**
 * = python manage.py cerrar_semana --ponerse-al-dia
 * Cierra todas las semanas que ya pasaron su margen (el lunes de datos
 * atrasados) y no se cerraron. Retoma a quienes faltaban, sin pagar dos veces.
 */
export function correrPonerseAlDia(): Promise<Corrida> {
  if (!puede('correr_cierre')) return Promise.reject(new ErrorPanel('Tu rol no puede correr cierres.'));
  if (enCurso) return Promise.reject(new ErrorPanel('Hay otro cierre en curso. Espera a que termine.'));
  const ahora = new Date().toISOString();
  enCurso = {
    id: siguienteId++,
    tipo: 'cierre',
    programada_para: null,
    empezo: ahora,
    termino: null,
    estado: 'en_curso',
    intentos: 1,
    error: null,
    resumen: 'Poniéndose al día…',
    origen: sesionActual.correo,
  };
  // Un cierre de verdad tarda: el mock tarda 2,5 s para que se vea el candado.
  return simularRed(() => {
    const c = enCurso!;
    const semanasPendientes = cerrarSemanasPendientes();
    c.estado = 'ok';
    c.termino = new Date().toISOString();
    c.resumen =
      semanasPendientes.length === 0
        ? 'No había semanas pendientes: todo estaba cerrado.'
        : `Se cerraron ${semanasPendientes.length} semanas: ${semanasPendientes.join(', ')}`;
    corridas.push(c);
    enCurso = null;
    registrar('correr_cierre', 'cerrar_semana --ponerse-al-dia', c.resumen);
    return copia(c);
  }, 2500);
}
