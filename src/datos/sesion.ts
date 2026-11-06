/*
 * Quién está usando el panel y qué puede hacer.
 *
 * Dos roles (los datos de salud son sensibles):
 *   soporte → solo lectura + verificar y rechazar pólizas + marcar cupones.
 *   admin   → todo lo de soporte + configuración (objetivo semanal, reglas,
 *             correr cierres, premios, La Liga, patrocinios), ajustes de
 *             puntos o monedas y la bitácora.
 *
 * El rol lo manda el backend al entrar. El panel lo usa para mostrar u
 * ocultar acciones, pero quien decide es el servidor: cada endpoint valida
 * el rol de nuevo.
 */
import { useSyncExternalStore } from 'react';
import { pedir } from './api';
import { conectado } from './modo';
import { ErrorPanel, simularRed } from './red';
import { borrarSesion, guardarSesion, leerSesionGuardada, suscribirSesion, type SesionGuardada } from './token';

export type Rol = 'soporte' | 'admin';

/** Lo que el panel sabe de quien entró. Sin token: ese se queda en token.ts. */
export interface SesionPanel {
  correo: string;
  nombre: string;
  rol: Rol;
}

export type Accion =
  | 'ver'
  | 'verificar_poliza'
  | 'marcar_cupon'
  | 'ajustar_ledger'
  | 'editar_objetivo'
  | 'correr_cierre'
  | 'editar_reglas'
  | 'editar_premios'
  | 'editar_liga'
  | 'editar_patrocinios'
  | 'ver_bitacora';

const PERMISOS: Record<Rol, ReadonlySet<Accion>> = {
  // Soporte atiende: verifica pólizas y marca cupones cuando llama un comercio.
  soporte: new Set<Accion>(['ver', 'verificar_poliza', 'marcar_cupon']),
  admin: new Set<Accion>([
    'ver',
    'verificar_poliza',
    'marcar_cupon',
    'ajustar_ledger',
    'editar_objetivo',
    'correr_cierre',
    'editar_reglas',
    'editar_premios',
    'editar_liga',
    'editar_patrocinios',
    'ver_bitacora',
  ]),
};

export const NOMBRE_ROL: Record<Rol, string> = { soporte: 'Soporte', admin: 'Administrador' };

function publica(s: SesionGuardada | null): SesionPanel | null {
  return s ? { correo: s.correo, nombre: s.nombre, rol: s.rol } : null;
}

/** La sesión de ahora, o null si nadie entró. */
export function sesionActual(): SesionPanel | null {
  return publica(leerSesionGuardada());
}

/** Correo de quien hace la acción, para la bitácora del mock. */
export function correoActual(): string {
  return leerSesionGuardada()?.correo ?? 'desconocido';
}

export function puede(accion: Accion, sesion: SesionPanel | null = sesionActual()): boolean {
  return !!sesion && PERMISOS[sesion.rol].has(accion);
}

/* ----------------------------------------------------------------- React */

let cache: { guardada: SesionGuardada | null; publica: SesionPanel | null } = { guardada: null, publica: null };

function instantanea(): SesionPanel | null {
  const g = leerSesionGuardada();
  if (g !== cache.guardada) cache = { guardada: g, publica: publica(g) };
  return cache.publica;
}

/** La sesión, y vuelve a dibujar cuando cambia (entrar, salir o vencer). */
export function useSesion(): SesionPanel | null {
  return useSyncExternalStore(suscribirSesion, instantanea, instantanea);
}

/* ----------------------------------------------------------------- entrar y salir */

interface RespuestaLogin {
  token: string;
  expiry: string | null;
  admin: { correo: string; nombre: string; rol: Rol };
}

const CORREO_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Entra al panel.
 * API: POST /api/v1/admin/login { username, password } →
 *      { token, expiry, admin: { correo, nombre, rol } }. Solo cuentas del equipo.
 * Mock: cualquier contraseña; un correo que empieza con "soporte" entra como soporte.
 */
export async function iniciarSesion(correo: string, contrasena: string): Promise<SesionPanel> {
  const c = correo.trim();
  const campos: Record<string, string> = {};
  if (!CORREO_VALIDO.test(c)) campos.username = 'Escribe un correo válido.';
  if (!contrasena) campos.password = 'Escribe tu contraseña.';
  if (Object.keys(campos).length) throw new ErrorPanel('Revisa los campos marcados.', campos);

  let r: RespuestaLogin;
  if (conectado('sesion')) {
    r = await pedir<RespuestaLogin>('/api/v1/admin/login', { cuerpo: { username: c, password: contrasena }, sinSesion: true });
    if (!r?.token || (r.admin?.rol !== 'soporte' && r.admin?.rol !== 'admin')) {
      throw new ErrorPanel('El servidor respondió algo que el panel no entiende. Avisa al equipo de backend.');
    }
  } else {
    r = await simularRed(() => ({
      token: `mock-${Math.random().toString(36).slice(2)}`,
      expiry: null,
      admin: {
        correo: c.toLowerCase(),
        nombre: c.split('@')[0]!.replace(/[._-]+/g, ' ').replace(/\b\p{L}/gu, (l) => l.toUpperCase()),
        rol: c.toLowerCase().startsWith('soporte') ? ('soporte' as const) : ('admin' as const),
      },
    }));
  }
  guardarSesion({ token: r.token, expiry: r.expiry, ...r.admin });
  return { ...r.admin };
}

/**
 * Solo con datos de muestra: ver el panel como el otro rol, para demos.
 * Con la API no hace nada: el rol lo decide el servidor.
 */
export function cambiarRolDeMuestra(rol: Rol): void {
  const s = leerSesionGuardada();
  if (conectado('sesion') || !s || s.rol === rol) return;
  guardarSesion({ ...s, rol });
}

/** Sale del panel. En la API también borra el token en el servidor (POST /api/v1/logout). */
export async function cerrarSesion(): Promise<void> {
  if (conectado('sesion') && leerSesionGuardada()) {
    // Si falla (sin red, token ya vencido), igual se sale en este equipo.
    await pedir('/api/v1/logout', { metodo: 'POST' }).catch(() => undefined);
  }
  borrarSesion();
}
