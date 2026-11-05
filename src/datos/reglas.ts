/*
 * Versiones de reglas y su tabla de puntaje. Futuro: /api/v1/admin/reglas/…
 *
 * HOY en el backend: poincs.VersionRegla guarda solo (version, vigente_desde);
 * los valores son constantes en el código (services/points.py,
 * daily_scoring.py, hearth_rate.py, niveles.py).
 *
 * LO QUE ASUME ESTE PANEL: cada versión lleva su tabla de puntaje y el
 * backend calcula con la de la versión vigente. El panel nunca toca la
 * base: manda la versión nueva a la API de Django, y Django la valida y la
 * guarda. Para eso las constantes tienen que pasar a un modelo, una tabla
 * por versión.
 *
 * Reglas que el mock respeta (y que el backend tiene que validar igual):
 * - La vigente es la de `vigente_desde` más reciente que no pasó de hoy;
 *   si varias empiezan el mismo día, la de número más alto. Sin ninguna, el
 *   sync responde 500 (services/reglas.py hoy ordena solo por fecha).
 * - Una versión nueva empieza hoy o después: lo ya sellado no cambia.
 * - Máximo 3 versiones que empiecen el mismo día.
 * - Una versión no se edita después de creada; se crea otra.
 */

export const MAX_VERSIONES_POR_DIA = 3;
import { registrar } from './bitacora';
import { copia, ErrorPanel, hoyGT, simularRed } from './red';
import { puede } from './sesion';

export interface TramoPasos {
  /** Pasos del día desde los que vale este tramo. */
  desde: number;
  puntos: number;
}

export interface EscalonIntensidad {
  minutos: number;
  /** % de la FCmáx sostenido esos minutos. */
  pct_fcmax: number;
  puntos: number;
}

export interface NivelCashback {
  nivel: number;
  desde: number;
  cashback_pct: number;
}

export interface TablaPuntaje {
  pasos: TramoPasos[];
  intensidad: EscalonIntensidad[];
  /** FCmáx = base − edad. */
  fcmax_base: number;
  bono_edad_minima: number;
  bono_puntos_pasos: number;
  bono_puntos_intensidad: number;
  tope_diario: number;
  tope_anual: number;
  niveles: NivelCashback[];
  ventana_rezagados_dias: number;
  pasos_dia_atipico: number;
  workout_minutos_minimos: number;
}

export interface VersionRegla {
  version: number;
  vigente_desde: string;
  creada_por: string;
  tabla: TablaPuntaje;
}

export type EstadoVersion = 'vigente' | 'programada' | 'anterior';

const HOY = hoyGT();

// Los valores de hoy en el backend (rama dev, 23 oct 2026).
const TABLA_ACTUAL: TablaPuntaje = {
  pasos: [
    { desde: 0, puntos: 0 },
    { desde: 7000, puntos: 25 },
    { desde: 10000, puntos: 50 },
    { desde: 15000, puntos: 100 },
  ],
  intensidad: [
    { minutos: 30, pct_fcmax: 60, puntos: 50 },
    { minutos: 30, pct_fcmax: 70, puntos: 100 },
    { minutos: 60, pct_fcmax: 60, puntos: 100 },
    { minutos: 90, pct_fcmax: 60, puntos: 150 },
  ],
  fcmax_base: 219,
  bono_edad_minima: 60,
  bono_puntos_pasos: 25,
  bono_puntos_intensidad: 25,
  tope_diario: 200,
  tope_anual: 12000,
  niveles: [
    { nivel: 0, desde: 0, cashback_pct: 0 },
    { nivel: 1, desde: 2500, cashback_pct: 5 },
    { nivel: 2, desde: 5000, cashback_pct: 7.5 },
    { nivel: 3, desde: 10000, cashback_pct: 10 },
    { nivel: 4, desde: 15000, cashback_pct: 20 },
  ],
  ventana_rezagados_dias: 14,
  pasos_dia_atipico: 60000,
  workout_minutos_minimos: 30,
};

const versiones: VersionRegla[] = [
  { version: 1, vigente_desde: '2026-09-21', creada_por: 'luis', tabla: copia(TABLA_ACTUAL) },
  { version: 2, vigente_desde: '2026-10-02', creada_por: 'luis', tabla: copia(TABLA_ACTUAL) },
  { version: 3, vigente_desde: '2026-10-19', creada_por: 'luis', tabla: copia(TABLA_ACTUAL) },
];

function vigente(): VersionRegla | null {
  return (
    [...versiones]
      .filter((v) => v.vigente_desde <= HOY)
      .sort((a, b) => b.vigente_desde.localeCompare(a.vigente_desde) || b.version - a.version)[0] ?? null
  );
}

export interface ListaVersiones {
  versiones: Array<VersionRegla & { estado: EstadoVersion }>;
  vigente: number | null;
}

export function listarVersiones(): Promise<ListaVersiones> {
  return simularRed(() => {
    const v = vigente();
    return copia({
      vigente: v?.version ?? null,
      versiones: [...versiones]
        .sort((a, b) => b.version - a.version)
        .map((x) => ({ ...x, estado: (x.vigente_desde > HOY ? 'programada' : x === v ? 'vigente' : 'anterior') as EstadoVersion })),
    });
  });
}

function validarTabla(t: TablaPuntaje): Record<string, string> {
  const e: Record<string, string> = {};
  const ent = (n: number, min = 0) => Number.isFinite(n) && n >= min;
  t.pasos.forEach((p, i) => {
    if (!ent(p.desde) || !Number.isInteger(p.desde)) e[`pasos_${i}_desde`] = 'Entero, 0 o más.';
    if (!ent(p.puntos) || !Number.isInteger(p.puntos)) e[`pasos_${i}_puntos`] = 'Entero, 0 o más.';
    if (i > 0 && p.desde <= t.pasos[i - 1]!.desde) e[`pasos_${i}_desde`] = 'Tiene que subir.';
    if (i > 0 && p.puntos < t.pasos[i - 1]!.puntos) e[`pasos_${i}_puntos`] = 'No puede bajar.';
  });
  if (t.pasos[0]?.desde !== 0) e.pasos_0_desde = 'El primer tramo empieza en 0.';
  t.intensidad.forEach((x, i) => {
    if (!ent(x.minutos, 1)) e[`int_${i}_minutos`] = 'Al menos 1.';
    if (!ent(x.pct_fcmax, 1) || x.pct_fcmax > 100) e[`int_${i}_pct`] = 'Entre 1 y 100.';
    if (!ent(x.puntos)) e[`int_${i}_puntos`] = '0 o más.';
  });
  t.niveles.forEach((n, i) => {
    if (!ent(n.desde)) e[`niv_${i}_desde`] = '0 o más.';
    if (!ent(n.cashback_pct) || n.cashback_pct > 100) e[`niv_${i}_pct`] = 'Entre 0 y 100.';
    if (i > 0 && n.desde <= t.niveles[i - 1]!.desde) e[`niv_${i}_desde`] = 'Tiene que subir.';
  });
  for (const k of ['fcmax_base', 'bono_edad_minima', 'tope_diario', 'tope_anual', 'ventana_rezagados_dias', 'pasos_dia_atipico', 'workout_minutos_minimos'] as const) {
    if (!ent(t[k], 1)) e[k] = 'Mayor que 0.';
  }
  for (const k of ['bono_puntos_pasos', 'bono_puntos_intensidad'] as const) if (!ent(t[k])) e[k] = '0 o más.';
  const maxDia = Math.max(...t.pasos.map((p) => p.puntos)) + Math.max(...t.intensidad.map((x) => x.puntos));
  if (!e.tope_diario && t.tope_diario > maxDia + t.bono_puntos_pasos + t.bono_puntos_intensidad) e.tope_diario = 'Más alto de lo que se puede ganar en un día.';
  return e;
}

/** Crea una versión con su tabla. Empieza hoy o después; no se edita después. */
export function crearVersion(vigente_desde: string, tabla: TablaPuntaje): Promise<VersionRegla> {
  return simularRed(() => {
    if (!puede('editar_reglas')) throw new ErrorPanel('Tu rol no puede cambiar las reglas.');
    const campos = validarTabla(tabla);
    if (!vigente_desde) campos.vigente_desde = 'Elige desde cuándo vale.';
    else if (vigente_desde < HOY) campos.vigente_desde = 'No puede empezar en el pasado: cambiaría filas ya selladas.';
    else if (versiones.filter((v) => v.vigente_desde === vigente_desde).length >= MAX_VERSIONES_POR_DIA)
      campos.vigente_desde = `Ya hay ${MAX_VERSIONES_POR_DIA} versiones que empiezan ese día: es el máximo.`;
    if (Object.keys(campos).length) throw new ErrorPanel('Revisa los campos marcados.', campos);
    const nueva: VersionRegla = { version: Math.max(0, ...versiones.map((v) => v.version)) + 1, vigente_desde, creada_por: 'admin@masvidaapp.com', tabla: copia(tabla) };
    versiones.push(nueva);
    const base = vigente();
    const cambios = base ? diferencias(base.tabla, tabla) : [];
    registrar('editar_reglas', `VersionRegla v${nueva.version}`, `Vigente desde ${vigente_desde}${cambios.length ? ` · ${cambios.join('; ')}` : ' · sin cambios en la tabla'}`);
    return copia(nueva);
  });
}

/** Lista legible de lo que cambió entre dos tablas, para la bitácora y la confirmación. */
export function diferencias(a: TablaPuntaje, b: TablaPuntaje): string[] {
  const d: string[] = [];
  a.pasos.forEach((p, i) => {
    const q = b.pasos[i];
    if (q && (p.desde !== q.desde || p.puntos !== q.puntos)) d.push(`Tramo de pasos ${i + 1}: ${p.desde}→${q.desde} pasos, ${p.puntos}→${q.puntos} pts`);
  });
  a.intensidad.forEach((x, i) => {
    const y = b.intensidad[i];
    if (y && (x.minutos !== y.minutos || x.pct_fcmax !== y.pct_fcmax || x.puntos !== y.puntos))
      d.push(`Intensidad ${i + 1}: ${x.minutos} min al ${x.pct_fcmax} % = ${x.puntos} → ${y.minutos} min al ${y.pct_fcmax} % = ${y.puntos}`);
  });
  a.niveles.forEach((n, i) => {
    const m = b.niveles[i];
    if (m && (n.desde !== m.desde || n.cashback_pct !== m.cashback_pct)) d.push(`Nivel ${n.nivel}: desde ${n.desde}→${m.desde}, ${n.cashback_pct}→${m.cashback_pct} %`);
  });
  const nombres: Array<[keyof TablaPuntaje, string]> = [
    ['fcmax_base', 'Base de FCmáx'],
    ['bono_edad_minima', 'Edad del bono'],
    ['bono_puntos_pasos', 'Bono sobre pasos'],
    ['bono_puntos_intensidad', 'Bono sobre intensidad'],
    ['tope_diario', 'Techo diario'],
    ['tope_anual', 'Techo anual'],
    ['ventana_rezagados_dias', 'Ventana de rezagados'],
    ['pasos_dia_atipico', 'Día atípico'],
    ['workout_minutos_minimos', 'Workout mínimo'],
  ];
  for (const [k, n] of nombres) if (a[k] !== b[k]) d.push(`${n}: ${String(a[k])}→${String(b[k])}`);
  return d;
}
