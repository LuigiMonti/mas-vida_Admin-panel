import { afterEach, describe, expect, it } from 'vitest';
import { cerrarSesion, iniciarSesion, puede, sesionActual } from './sesion';
import { ErrorPanel } from './red';
import { leerSesionGuardada } from './token';

afterEach(() => cerrarSesion());

describe('sesión del panel (datos de muestra)', () => {
  it('pide correo y contraseña', async () => {
    const e = await iniciarSesion('no-es-correo', '').catch((x: ErrorPanel) => x);
    expect((e as ErrorPanel).campos).toEqual({ username: 'Escribe un correo válido.', password: 'Escribe tu contraseña.' });
    expect(sesionActual()).toBeNull();
  });

  it('un correo que empieza con soporte entra como soporte, y no puede configurar', async () => {
    await iniciarSesion('Soporte.Ana@masvidaapp.com', 'x');
    expect(sesionActual()).toMatchObject({ rol: 'soporte', correo: 'soporte.ana@masvidaapp.com' });
    expect(puede('verificar_poliza')).toBe(true);
    expect(puede('ajustar_ledger')).toBe(false);
    expect(puede('ver_bitacora')).toBe(false);
  });

  it('cualquier otro correo entra como admin', async () => {
    await iniciarSesion('luis@masvidaapp.com', 'x');
    expect(sesionActual()?.rol).toBe('admin');
    expect(puede('editar_reglas')).toBe(true);
  });

  it('la sesión pública no expone el token', async () => {
    await iniciarSesion('luis@masvidaapp.com', 'x');
    expect(leerSesionGuardada()?.token).toBeTruthy();
    expect(Object.keys(sesionActual()!)).toEqual(['correo', 'nombre', 'rol']);
  });

  it('sin sesión no se puede nada', async () => {
    await cerrarSesion();
    expect(puede('ver')).toBe(false);
  });
});
