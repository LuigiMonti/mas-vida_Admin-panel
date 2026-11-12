/*
 * Doble factor para entrar al panel (TOTP: una app de autenticación).
 * Futuro: /api/v1/admin/2fa/… Va con la sección `sesion`.
 *
 * - Cada quien lo activa en su propia cuenta: el servidor entrega un secreto,
 *   la persona lo guarda en su app y confirma con un código de 6 dígitos.
 * - Activo, el login pide ese código después de la contraseña (ver
 *   iniciarSesion en sesion.ts).
 * - Quitarlo pide la contraseña otra vez. El secreto se muestra una sola vez
 *   y nunca se escribe en la bitácora.
 */
import { pedir } from './api';
import { registrar } from './bitacora';
import { conectado } from './modo';
import { ErrorPanel, simularRed } from './red';
import { CODIGO_DE_MUESTRA, correoActual, marcarDobleFactorDeMuestra, tieneDobleFactorDeMuestra } from './sesion';

export interface EstadoDobleFactor {
  activo: boolean;
}

export interface AltaDobleFactor {
  /** Para escribirlo a mano en la app de autenticación (base32). */
  secreto: string;
  /** `otpauth://…`: lo mismo, para un QR. */
  uri: string;
}

export function obtenerDobleFactor(): Promise<EstadoDobleFactor> {
  if (conectado('sesion')) return pedir<EstadoDobleFactor>('/api/v1/admin/2fa');
  return simularRed(() => ({ activo: tieneDobleFactorDeMuestra(correoActual()) }), 200);
}

/** Empieza el alta: devuelve el secreto. No queda activo hasta confirmar. */
export function empezarDobleFactor(): Promise<AltaDobleFactor> {
  if (conectado('sesion')) return pedir<AltaDobleFactor>('/api/v1/admin/2fa/empezar', { metodo: 'POST' });
  return simularRed(() => {
    const secreto = 'JBSW Y3DP EHPK 3PXP';
    return { secreto, uri: `otpauth://totp/+vida%20Panel:${encodeURIComponent(correoActual())}?secret=${secreto.replace(/\s/g, '')}&issuer=%2Bvida%20Panel` };
  });
}

const SEIS_DIGITOS = /^\d{6}$/;

/** Confirma el alta con el primer código de la app. */
export function confirmarDobleFactor(codigo: string): Promise<EstadoDobleFactor> {
  const c = codigo.trim();
  if (!SEIS_DIGITOS.test(c)) return Promise.reject(new ErrorPanel('Revisa el código.', { codigo: 'Son 6 dígitos.' }));
  if (conectado('sesion')) return pedir<EstadoDobleFactor>('/api/v1/admin/2fa/confirmar', { cuerpo: { codigo: c } });
  return simularRed(() => {
    if (c !== CODIGO_DE_MUESTRA) throw new ErrorPanel('Revisa el código.', { codigo: 'Ese código no es correcto.' });
    marcarDobleFactorDeMuestra(correoActual(), true);
    registrar('seguridad_panel', correoActual(), 'Activó el doble factor');
    return { activo: true };
  });
}

/** Quita el doble factor. Pide la contraseña de nuevo. */
export function quitarDobleFactor(contrasena: string): Promise<EstadoDobleFactor> {
  if (!contrasena) return Promise.reject(new ErrorPanel('Falta la contraseña.', { password: 'Escribe tu contraseña.' }));
  if (conectado('sesion')) return pedir<EstadoDobleFactor>('/api/v1/admin/2fa/quitar', { cuerpo: { password: contrasena } });
  return simularRed(() => {
    marcarDobleFactorDeMuestra(correoActual(), false);
    registrar('seguridad_panel', correoActual(), 'Quitó el doble factor');
    return { activo: false };
  });
}
