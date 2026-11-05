/*
 * Quién está usando el panel y qué puede hacer.
 *
 * Dos roles (los datos de salud son sensibles):
 *   soporte → solo lectura + verificar y rechazar pólizas.
 *   admin   → todo lo de soporte + configuración (objetivo semanal, reglas,
 *             correr cierres) y ajustes de puntos o monedas.
 *
 * Hoy es un mock. Después sale del login (/api/v1/admin/login). El token
 * nunca se muestra en pantalla ni se escribe en la bitácora.
 */

export type Rol = 'soporte' | 'admin';

export interface SesionPanel {
  correo: string;
  nombre: string;
  rol: Rol;
}

export type Accion =
  | 'ver'
  | 'verificar_poliza'
  | 'ajustar_ledger'
  | 'editar_objetivo'
  | 'correr_cierre'
  | 'editar_reglas'
  | 'ver_bitacora';

const PERMISOS: Record<Rol, ReadonlySet<Accion>> = {
  soporte: new Set<Accion>(['ver', 'verificar_poliza']),
  admin: new Set<Accion>(['ver', 'verificar_poliza', 'ajustar_ledger', 'editar_objetivo', 'correr_cierre', 'editar_reglas', 'ver_bitacora']),
};

export const NOMBRE_ROL: Record<Rol, string> = { soporte: 'Soporte', admin: 'Administrador' };

// Mock: cambia `rol` a 'soporte' para ver el panel como lo ve soporte.
export const sesionActual: SesionPanel = {
  correo: 'admin@masvidaapp.com',
  nombre: 'Equipo +vida',
  rol: 'admin',
};

export function puede(accion: Accion, sesion: SesionPanel = sesionActual): boolean {
  return PERMISOS[sesion.rol].has(accion);
}
