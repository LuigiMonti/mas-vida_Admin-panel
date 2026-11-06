/*
 * De dónde lee cada sección del panel: datos de muestra o la API de Django.
 *
 * Se configura en .env (ver .env.example):
 *   VITE_DATOS=mock                       todo con datos de muestra (por defecto)
 *   VITE_DATOS=api                        todo contra la API
 *   VITE_DATOS=mock
 *   VITE_DATOS_API=sesion,polizas         solo esas secciones contra la API
 *
 * Así se conecta una pantalla a la vez, a medida que existen los endpoints
 * de PENDIENTES_BACKEND.md.
 */

export type Seccion =
  | 'sesion'
  | 'resumen'
  | 'usuarios'
  | 'polizas'
  | 'retroactivo'
  | 'objetivos'
  | 'reglas'
  | 'cierres'
  | 'bitacora'
  | 'premios'
  | 'cupones'
  | 'liga'
  | 'patrocinios';

export const SECCIONES: readonly Seccion[] = [
  'sesion',
  'resumen',
  'usuarios',
  'polizas',
  'retroactivo',
  'objetivos',
  'reglas',
  'cierres',
  'bitacora',
  'premios',
  'cupones',
  'liga',
  'patrocinios',
];

interface Config {
  todo: boolean;
  secciones: ReadonlySet<string>;
}

export function leerConfig(env: { VITE_DATOS?: string; VITE_DATOS_API?: string }): Config {
  const todo = (env.VITE_DATOS ?? 'mock').trim().toLowerCase() === 'api';
  const secciones = new Set(
    (env.VITE_DATOS_API ?? '')
      .split(',')
      .map((s) => s.trim().toLowerCase())
      .filter(Boolean),
  );
  return { todo, secciones };
}

const config = leerConfig(import.meta.env);

/** Si esta sección habla con la API de Django (y no con los datos de muestra). */
export function conectado(seccion: Seccion): boolean {
  return config.todo || config.secciones.has(seccion);
}

/** Lo que muestra el header: si todo es de muestra, si hay una mezcla, o si todo es real. */
export function resumenModo(): 'mock' | 'mixto' | 'api' {
  const n = SECCIONES.filter(conectado).length;
  return n === 0 ? 'mock' : n === SECCIONES.length ? 'api' : 'mixto';
}
