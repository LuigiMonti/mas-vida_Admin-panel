/*
 * El token de la sesión del panel (django-rest-knox).
 *
 * - Se guarda en sessionStorage: dura lo que la pestaña. Cerrar la pestaña
 *   es cerrar la sesión en este equipo (el token sigue vivo en el servidor
 *   hasta que vence o se hace logout).
 * - Nunca se muestra en pantalla, ni se escribe en la bitácora, ni se mete
 *   en un mensaje de error. Solo lo lee src/datos/api.ts para el encabezado.
 * - Si el almacenamiento no está disponible (modo privado estricto), vive
 *   en memoria: se pierde al recargar.
 */

const CLAVE = 'panel.sesion';

export interface SesionGuardada {
  token: string;
  /** Vencimiento que mandó el servidor (ISO). Cada uso lo corre. */
  expiry: string | null;
  correo: string;
  nombre: string;
  rol: 'soporte' | 'admin';
}

let enMemoria: SesionGuardada | null = null;
const oyentes = new Set<() => void>();

function avisar() {
  for (const fn of oyentes) fn();
}

export function leerSesionGuardada(): SesionGuardada | null {
  if (enMemoria) return enMemoria;
  try {
    const crudo = sessionStorage.getItem(CLAVE);
    if (!crudo) return null;
    const s = JSON.parse(crudo) as SesionGuardada;
    if (!s.token || (s.rol !== 'soporte' && s.rol !== 'admin')) return null;
    enMemoria = s;
    return s;
  } catch {
    return null;
  }
}

export function guardarSesion(s: SesionGuardada): void {
  enMemoria = s;
  vencida = false;
  try {
    sessionStorage.setItem(CLAVE, JSON.stringify(s));
  } catch {
    /* sin almacenamiento: queda en memoria */
  }
  avisar();
}

export function borrarSesion(): void {
  enMemoria = null;
  try {
    sessionStorage.removeItem(CLAVE);
  } catch {
    /* nada que borrar */
  }
  avisar();
}

/** Solo para el encabezado Authorization. */
export function tokenActual(): string | null {
  return leerSesionGuardada()?.token ?? null;
}

/** Avisa cada vez que la sesión cambia (entrar, salir, vencer). */
export function suscribirSesion(fn: () => void): () => void {
  oyentes.add(fn);
  return () => oyentes.delete(fn);
}

/* ----------------------------------------------------------------- sesión vencida */

let vencida = false;

/** El cliente la marca cuando el servidor responde 401: el login muestra por qué. */
export function marcarSesionVencida(): void {
  vencida = true;
  borrarSesion();
}

/** Si la última sesión terminó por vencer. Se limpia al volver a entrar. */
export function huboSesionVencida(): boolean {
  return vencida;
}
