/*
 * Objetivo semanal: objetivos.ObjetivoSemanal y objetivos.MetaPasosPorEdad.
 * Futuro: /api/v1/admin/objetivos/…
 *
 * Cómo funciona en el backend (services/goals.py):
 * - Cada semana va de lunes a domingo (hora de Guatemala). Si una semana no
 *   existe cuando hace falta, se crea copiando la anterior. Agregarla desde
 *   el panel es dejarla definida antes.
 * - La meta de pasos sale de la tabla por edad; `meta_pasos` de la semana
 *   es solo el respaldo si esa tabla está vacía.
 * - Cada componente paga sus monedas por separado.
 * - Una semana que ya empezó no se edita: cambiaría la meta a mitad de camino.
 */
import { registrar } from './bitacora';
import { copia, ErrorPanel, hoyGT, simularRed } from './red';
import { puede } from './sesion';

export interface ObjetivoSemanal {
  fecha_inicio: string;
  fecha_fin: string;
  meta_pasos: number;
  meta_workouts: number;
  monedas_pasos: number;
  monedas_workouts: number;
  cerrado_en: string | null;
}

export type EstadoSemana = 'cerrada' | 'pendiente_cierre' | 'en_revision' | 'en_curso' | 'futura' | 'sin_crear';

export interface SemanaDeSeason {
  numero: number;
  iso: number;
  fecha_inicio: string;
  fecha_fin: string;
  estado: EstadoSemana;
  /** null si la semana todavía no existe (se va a crear copiando la anterior). */
  objetivo: ObjetivoSemanal | null;
  /** Solo en las cerradas. */
  resultado: { evaluados: number; cumplieron_pasos: number; cumplieron_workouts: number; completaron: number } | null;
}

export interface SeasonActual {
  numero: number;
  anio: number;
  fecha_inicio: string;
  fecha_fin: string;
  semanas: SemanaDeSeason[];
}

export interface MetaPasosPorEdad {
  edad_desde: number;
  meta_pasos: number;
}

/* ================================================================= fechas */

function sumar(f: string, dias: number): string {
  const d = new Date(`${f}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function semanaIso(f: string): number {
  const d = new Date(`${f}T12:00:00Z`);
  const jueves = new Date(d);
  jueves.setUTCDate(d.getUTCDate() + 3 - ((d.getUTCDay() + 6) % 7));
  const primero = new Date(Date.UTC(jueves.getUTCFullYear(), 0, 4));
  return 1 + Math.round(((jueves.getTime() - primero.getTime()) / 86400000 - 3 + ((primero.getUTCDay() + 6) % 7)) / 7);
}

/* ================================================================= mock */

// Season 4 de 2026: del lunes 28 sep al domingo 3 ene 2027 (14 semanas).
const SEASON = { numero: 4, anio: 2026, fecha_inicio: '2026-09-28', fecha_fin: '2027-01-03' };
const HOY = hoyGT();

const objetivos = new Map<string, ObjetivoSemanal>();
const resultados = new Map<string, NonNullable<SemanaDeSeason['resultado']>>();

(function sembrar() {
  for (let i = 0; i < 14; i++) {
    const lunes = sumar(SEASON.fecha_inicio, i * 7);
    // Creadas: las que ya pasaron, la en curso y las dos siguientes.
    if (lunes > sumar(HOY, 14)) break;
    const domingo = sumar(lunes, 6);
    const cerrada = sumar(domingo, 2) <= HOY;
    objetivos.set(lunes, {
      fecha_inicio: lunes,
      fecha_fin: domingo,
      meta_pasos: 49000,
      meta_workouts: i < 3 ? 2 : 3,
      monedas_pasos: 5,
      monedas_workouts: 5,
      cerrado_en: cerrada ? sumar(domingo, 2) : null,
    });
    if (cerrada) {
      const evaluados = 88 + (i % 5);
      const p = Math.round(evaluados * (0.45 + (i % 3) * 0.04));
      const w = Math.round(evaluados * (0.5 + (i % 4) * 0.03));
      resultados.set(lunes, { evaluados, cumplieron_pasos: p, cumplieron_workouts: w, completaron: Math.round(Math.min(p, w) * 0.85) });
    }
  }
})();

let metasPorEdad: MetaPasosPorEdad[] = [
  { edad_desde: 18, meta_pasos: 49000 },
  { edad_desde: 40, meta_pasos: 45000 },
  { edad_desde: 50, meta_pasos: 42000 },
  { edad_desde: 60, meta_pasos: 35000 },
  { edad_desde: 70, meta_pasos: 31000 },
];

function estadoDe(lunes: string, o: ObjetivoSemanal | undefined): EstadoSemana {
  const domingo = sumar(lunes, 6);
  if (lunes > HOY) return o ? 'futura' : 'sin_crear';
  if (HOY <= domingo) return 'en_curso';
  if (o?.cerrado_en) return 'cerrada';
  // El lunes siguiente es para datos atrasados; el resultado se fija el martes 00:00.
  return HOY === sumar(domingo, 1) ? 'en_revision' : 'pendiente_cierre';
}

/** El objetivo que tendría una semana sin crear: copia de la anterior que exista. */
function heredado(lunes: string): ObjetivoSemanal {
  const anteriores = [...objetivos.values()].filter((o) => o.fecha_inicio < lunes).sort((a, b) => b.fecha_inicio.localeCompare(a.fecha_inicio));
  const base = anteriores[0];
  return {
    fecha_inicio: lunes,
    fecha_fin: sumar(lunes, 6),
    meta_pasos: base?.meta_pasos ?? 49000,
    meta_workouts: base?.meta_workouts ?? 3,
    monedas_pasos: base?.monedas_pasos ?? 5,
    monedas_workouts: base?.monedas_workouts ?? 5,
    cerrado_en: null,
  };
}

export function heredadoDe(lunes: string): ObjetivoSemanal {
  return heredado(lunes);
}

/* ================================================================= API */

export function obtenerSeason(): Promise<SeasonActual> {
  return simularRed(() => {
    const semanas: SemanaDeSeason[] = [];
    for (let i = 0; ; i++) {
      const lunes = sumar(SEASON.fecha_inicio, i * 7);
      if (lunes > SEASON.fecha_fin) break;
      const o = objetivos.get(lunes);
      semanas.push({
        numero: i + 1,
        iso: semanaIso(lunes),
        fecha_inicio: lunes,
        fecha_fin: sumar(lunes, 6),
        estado: estadoDe(lunes, o),
        objetivo: o ? copia(o) : null,
        resultado: resultados.get(lunes) ?? null,
      });
    }
    return { ...SEASON, semanas };
  });
}

export interface CambiosObjetivo {
  meta_workouts: number;
  monedas_pasos: number;
  monedas_workouts: number;
  meta_pasos: number;
}

function validar(c: CambiosObjetivo): Record<string, string> {
  const e: Record<string, string> = {};
  const entero = (v: number, min: number) => Number.isInteger(v) && v >= min;
  if (!entero(c.meta_workouts, 1)) e.meta_workouts = 'Al menos 1 workout.';
  else if (c.meta_workouts > 7) e.meta_workouts = 'Más de 7 en una semana no es razonable.';
  if (!entero(c.monedas_pasos, 0)) e.monedas_pasos = 'Un entero, 0 o más.';
  if (!entero(c.monedas_workouts, 0)) e.monedas_workouts = 'Un entero, 0 o más.';
  if (!entero(c.meta_pasos, 1000)) e.meta_pasos = 'Al menos 1.000 pasos.';
  return e;
}

/**
 * Crea o edita una semana que todavía no empezó. Con `en_adelante`, aplica
 * lo mismo a las semanas siguientes ya creadas (las sin crear lo heredan solas).
 */
export function guardarObjetivo(fecha_inicio: string, c: CambiosObjetivo, en_adelante: boolean): Promise<number> {
  return simularRed(() => {
    if (!puede('editar_objetivo')) throw new ErrorPanel('Tu rol no puede editar el objetivo semanal.');
    if (fecha_inicio <= HOY) throw new ErrorPanel('No se puede editar: la semana ya empezó.');
    const errores = validar(c);
    if (Object.keys(errores).length) throw new ErrorPanel('Revisa los campos marcados.', errores);

    const destino = [fecha_inicio, ...(en_adelante ? [...objetivos.keys()].filter((k) => k > fecha_inicio) : [])];
    for (const lunes of destino) {
      const actual = objetivos.get(lunes) ?? heredado(lunes);
      objetivos.set(lunes, { ...actual, ...c });
    }
    registrar(
      'editar_objetivo',
      destino.length > 1 ? `Semanas desde ${fecha_inicio}` : `Semana del ${fecha_inicio}`,
      `${c.meta_workouts} workouts · ${c.monedas_pasos} + ${c.monedas_workouts} monedas · respaldo ${c.meta_pasos} pasos${destino.length > 1 ? ` · ${destino.length} semanas` : ''}`,
    );
    return destino.length;
  });
}

export function listarMetasPorEdad(): Promise<MetaPasosPorEdad[]> {
  return simularRed(() => copia(metasPorEdad), 200);
}

/** Reemplaza la tabla entera (es chica y se edita junta). */
export function guardarMetasPorEdad(filas: MetaPasosPorEdad[]): Promise<void> {
  return simularRed(() => {
    if (!puede('editar_objetivo')) throw new ErrorPanel('Tu rol no puede editar las metas.');
    const campos: Record<string, string> = {};
    const ordenadas = [...filas].sort((a, b) => a.edad_desde - b.edad_desde);
    ordenadas.forEach((f, i) => {
      if (!Number.isInteger(f.edad_desde) || f.edad_desde < 18) campos[`edad_${i}`] = 'Desde 18 años.';
      if (!Number.isInteger(f.meta_pasos) || f.meta_pasos < 1000) campos[`meta_${i}`] = 'Al menos 1.000.';
      if (i > 0 && f.edad_desde === ordenadas[i - 1]!.edad_desde) campos[`edad_${i}`] = 'Edad repetida.';
    });
    if (ordenadas.length === 0) campos.tabla = 'Hace falta al menos una fila.';
    if (Object.keys(campos).length) throw new ErrorPanel('Revisa la tabla.', campos);
    const antes = metasPorEdad.map((m) => `${m.edad_desde}+: ${m.meta_pasos}`).join(', ');
    metasPorEdad = ordenadas.map((f) => ({ ...f }));
    registrar('editar_objetivo', 'Metas de pasos por edad', `Antes: ${antes}. Ahora: ${metasPorEdad.map((m) => `${m.edad_desde}+: ${m.meta_pasos}`).join(', ')}`);
  });
}
