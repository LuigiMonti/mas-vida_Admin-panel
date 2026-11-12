/*
 * Temporadas (seasons) y ciclos de La Liga. Las mismas cuentas que
 * services/tiempo.py y services/ligas.py del backend, para los datos de
 * muestra y para validar antes de mandar. El que vale es el servidor.
 *
 * - El año tiene 4 temporadas de 13 semanas ISO, de lunes a domingo. La
 *   semana 1 es la que contiene el 4 de enero. En los años con 53 semanas,
 *   la temporada 4 tiene 14.
 * - La Liga dura una temporada (8 nov 2026). Transición: octubre de 2026 fue
 *   el último ciclo mensual, y la primera temporada cuenta desde el 1 nov 2026.
 * - La Liga se cierra el martes de la temporada nueva (2 días después del
 *   último día) y el podio se paga el martes siguiente (9 días después).
 */

export function sumarDias(f: string, dias: number): string {
  const d = new Date(`${f.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

/** Días de `desde` a `hasta` (negativo si `hasta` es anterior). */
export function diasEntre(desde: string, hasta: string): number {
  return Math.round((Date.parse(`${hasta.slice(0, 10)}T12:00:00Z`) - Date.parse(`${desde.slice(0, 10)}T12:00:00Z`)) / 86400000);
}

export function ultimoDelMes(f: string): string {
  const [y, m] = f.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/* ================================================================= temporadas */

export interface Temporada {
  numero: 1 | 2 | 3 | 4;
  /** Año ISO: el 3 ene 2027 todavía es de la temporada 4 de 2026. */
  anio: number;
  fecha_inicio: string;
  fecha_fin: string;
}

/** El lunes de la semana ISO 1 de ese año: la que contiene el 4 de enero. */
export function lunesSemana1(anio: number): string {
  const d = new Date(Date.UTC(anio, 0, 4, 12));
  d.setUTCDate(d.getUTCDate() - ((d.getUTCDay() + 6) % 7));
  return d.toISOString().slice(0, 10);
}

export function rangoTemporada(anio: number, numero: 1 | 2 | 3 | 4): Temporada {
  const fecha_inicio = sumarDias(lunesSemana1(anio), (numero - 1) * 91);
  // La 4 llega hasta el domingo antes de la semana 1 del año siguiente (13 o 14 semanas).
  const fecha_fin = numero === 4 ? sumarDias(lunesSemana1(anio + 1), -1) : sumarDias(fecha_inicio, 90);
  return { numero, anio, fecha_inicio, fecha_fin };
}

/** La temporada a la que pertenece una fecha. */
export function temporadaDe(fecha: string): Temporada {
  let anio = Number(fecha.slice(0, 4));
  if (fecha < lunesSemana1(anio)) anio -= 1;
  else if (fecha >= lunesSemana1(anio + 1)) anio += 1;
  const numero = Math.min(4, Math.floor(diasEntre(lunesSemana1(anio), fecha) / 91) + 1) as 1 | 2 | 3 | 4;
  return rangoTemporada(anio, numero);
}

/* ================================================================= ciclos de La Liga */

/** El primer ciclo de La Liga: octubre de 2026. Antes no hubo. */
export const PRIMER_CICLO_LIGA = '2026-10-01';
/** Desde este día La Liga cuenta por temporada (ligas.INICIO_POR_TEMPORADA). */
export const INICIO_POR_TEMPORADA = '2026-11-01';
const DIAS_AL_CIERRE = 2;
const DIAS_AL_PAGO = 9;

export type TipoCiclo = 'mes' | 'temporada';

export interface CicloLiga {
  /** Primer día del ciclo: es su identificador (LigaMensual.mes). */
  inicio: string;
  fin: string;
  ciclo: TipoCiclo;
  /** Desde qué día se cierra (tabla final) y desde cuál se paga el podio. */
  cierre: string;
  pago: string;
}

/** El ciclo de La Liga que contiene esa fecha, o null si es de antes de que existiera. */
export function cicloDeLiga(fecha: string): CicloLiga | null {
  if (fecha < PRIMER_CICLO_LIGA) return null;
  let inicio: string;
  let fin: string;
  let ciclo: TipoCiclo;
  if (fecha < INICIO_POR_TEMPORADA) {
    inicio = `${fecha.slice(0, 7)}-01`;
    fin = ultimoDelMes(fecha);
    ciclo = 'mes';
  } else {
    const t = temporadaDe(fecha);
    inicio = t.fecha_inicio < INICIO_POR_TEMPORADA ? INICIO_POR_TEMPORADA : t.fecha_inicio;
    fin = t.fecha_fin;
    ciclo = 'temporada';
  }
  return { inicio, fin, ciclo, cierre: sumarDias(fin, DIAS_AL_CIERRE), pago: sumarDias(fin, DIAS_AL_PAGO) };
}

/** Los `cuantos` ciclos seguidos desde el que contiene `desde`. */
export function ciclosDeLiga(desde: string, cuantos: number): CicloLiga[] {
  const lista: CicloLiga[] = [];
  let c = cicloDeLiga(desde < PRIMER_CICLO_LIGA ? PRIMER_CICLO_LIGA : desde);
  while (c && lista.length < cuantos) {
    lista.push(c);
    c = cicloDeLiga(sumarDias(c.fin, 1));
  }
  return lista;
}

const fmtMesAnio = new Intl.DateTimeFormat('es-GT', { month: 'long', year: 'numeric', timeZone: 'UTC' });
const fmtMes = new Intl.DateTimeFormat('es-GT', { month: 'long', timeZone: 'UTC' });

/** "Octubre 2026" o "Temporada 4 · 2026". */
export function nombreCiclo(c: Pick<CicloLiga, 'inicio' | 'ciclo'>): string {
  if (c.ciclo === 'mes') {
    const t = fmtMesAnio.format(new Date(`${c.inicio}T12:00:00Z`)).replace(' de ', ' ');
    return t.charAt(0).toUpperCase() + t.slice(1);
  }
  const t = temporadaDe(c.inicio);
  return `Temporada ${t.numero} · ${t.anio}`;
}

/** Como lo dice la app arriba del banner: "octubre" o "temporada 4". */
export function periodoCiclo(c: Pick<CicloLiga, 'inicio' | 'ciclo'>): string {
  return c.ciclo === 'mes' ? fmtMes.format(new Date(`${c.inicio}T12:00:00Z`)) : `temporada ${temporadaDe(c.inicio).numero}`;
}
