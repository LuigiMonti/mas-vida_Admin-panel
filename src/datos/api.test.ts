import { afterEach, describe, expect, it, vi } from 'vitest';
import { API_URL, pedir, traducirError } from './api';
import { ErrorPanel } from './red';
import { borrarSesion, guardarSesion, huboSesionVencida, leerSesionGuardada } from './token';

const TOKEN = 'clave-super-secreta-123';

function entrar() {
  guardarSesion({ token: TOKEN, expiry: null, correo: 'admin@masvidaapp.com', nombre: 'Admin', rol: 'admin' });
}

function respuesta(estado: number, cuerpo?: unknown, crudo?: string): Response {
  const texto = crudo ?? (cuerpo === undefined ? '' : JSON.stringify(cuerpo));
  return new Response(estado === 204 ? null : texto, { status: estado });
}

/** Un fetch falso que guarda lo que le pidieron. */
function fetchFalso(r: Response | Error) {
  const llamadas: Array<{ url: string; init: RequestInit }> = [];
  const fn = vi.fn(async (url: RequestInfo | URL, init?: RequestInit) => {
    llamadas.push({ url: String(url), init: init ?? {} });
    if (r instanceof Error) throw r;
    return r;
  }) as unknown as typeof fetch;
  return { fn, llamadas };
}

afterEach(() => borrarSesion());

describe('traducirError: las respuestas de error del backend', () => {
  it('400 con errores por campo (DRF) → campos', () => {
    const e = traducirError(400, { cantidad: ['Escribe un entero.'], motivo: ['Este campo es obligatorio.', 'Muy corto.'] });
    expect(e.campos).toEqual({ cantidad: 'Escribe un entero.', motivo: 'Este campo es obligatorio. Muy corto.' });
    expect(e.message).toBe('Revisa los campos marcados.');
    expect(e.estado).toBe(400);
  });

  it('400 con non_field_errors → mensaje general', () => {
    const e = traducirError(400, { non_field_errors: ['No se puede iniciar sesión con las credenciales proporcionadas.'] });
    expect(e.campos).toBeUndefined();
    expect(e.message).toBe('No se puede iniciar sesión con las credenciales proporcionadas.');
  });

  it('respuesta propia { error, mensaje } usa el mensaje del backend si el panel no tiene uno', () => {
    const e = traducirError(400, { error: 'nombre_invalido', mensaje: 'Ese nombre no se puede usar.' });
    expect(e.message).toBe('Ese nombre no se puede usar.');
    expect(e.codigo).toBe('nombre_invalido');
  });

  it('429 dice en cuánto se puede volver a intentar', () => {
    const e = traducirError(429, { error: 'demasiados_intentos', mensaje: 'x', reintentar_en: 90 });
    expect(e.message).toMatch(/2 min/);
    expect(e.codigo).toBe('demasiados_intentos');
  });

  it('403 en inglés de DRF → texto del panel', () => {
    expect(traducirError(403, { detail: 'You do not have permission to perform this action.' }).message).toBe('No tienes permiso para esto.');
  });

  it('401, 404, 413 y 500 tienen su texto', () => {
    expect(traducirError(401, { detail: 'Invalid token.' }).message).toMatch(/sesión venció/);
    expect(traducirError(404, undefined).message).toMatch(/No se encontró/);
    expect(traducirError(413, { error: 'demasiado_grande', limite_bytes: 10 }).message).toMatch(/demasiado grande/);
    expect(traducirError(502, undefined).message).toMatch(/servidor tuvo un problema/);
  });
});

describe('pedir', () => {
  it('manda el token de knox en Authorization y arma la URL con la query', async () => {
    entrar();
    const { fn, llamadas } = fetchFalso(respuesta(200, [{ id: 1 }]));
    const r = await pedir<Array<{ id: number }>>('/api/v1/admin/usuarios', { query: { q: 'ana', estado: undefined, vacio: '' }, fetchFn: fn });
    expect(r).toEqual([{ id: 1 }]);
    expect(llamadas[0]!.url).toBe(`${API_URL}/api/v1/admin/usuarios?q=ana`);
    expect((llamadas[0]!.init.headers as Record<string, string>).Authorization).toBe(`Token ${TOKEN}`);
    expect(llamadas[0]!.init.method).toBe('GET');
  });

  it('con cuerpo es POST con JSON', async () => {
    entrar();
    const { fn, llamadas } = fetchFalso(respuesta(201, { ok: true }));
    await pedir('/x', { cuerpo: { a: 1 }, fetchFn: fn });
    expect(llamadas[0]!.init.method).toBe('POST');
    expect(llamadas[0]!.init.body).toBe('{"a":1}');
    expect((llamadas[0]!.init.headers as Record<string, string>)['Content-Type']).toBe('application/json');
  });

  it('sinSesion (el login) no manda el token', async () => {
    entrar();
    const { fn, llamadas } = fetchFalso(respuesta(200, {}));
    await pedir('/api/v1/admin/login', { cuerpo: {}, sinSesion: true, fetchFn: fn });
    expect((llamadas[0]!.init.headers as Record<string, string>).Authorization).toBeUndefined();
  });

  it('204 resuelve sin cuerpo', async () => {
    const { fn } = fetchFalso(respuesta(204));
    await expect(pedir('/api/v1/logout', { metodo: 'POST', fetchFn: fn })).resolves.toBeUndefined();
  });

  it('401 borra la sesión y deja el aviso de sesión vencida', async () => {
    entrar();
    const { fn } = fetchFalso(respuesta(401, { detail: 'Invalid token.' }));
    await expect(pedir('/x', { fetchFn: fn })).rejects.toBeInstanceOf(ErrorPanel);
    expect(leerSesionGuardada()).toBeNull();
    expect(huboSesionVencida()).toBe(true);
  });

  it('401 en el login no se trata como sesión vencida', async () => {
    entrar();
    const { fn } = fetchFalso(respuesta(401, { detail: 'x' }));
    await expect(pedir('/login', { sinSesion: true, fetchFn: fn })).rejects.toBeInstanceOf(ErrorPanel);
    expect(leerSesionGuardada()).not.toBeNull();
  });

  it('un 500 en HTML no se muestra: mensaje genérico', async () => {
    const { fn } = fetchFalso(respuesta(500, undefined, '<html><body>Traceback…</body></html>'));
    await expect(pedir('/x', { fetchFn: fn })).rejects.toThrow(/servidor tuvo un problema/);
  });

  it('sin red: mensaje de conexión', async () => {
    const { fn } = fetchFalso(new TypeError('Failed to fetch'));
    await expect(pedir('/x', { fetchFn: fn })).rejects.toThrow(/No se pudo conectar/);
  });

  it('el token nunca aparece en un mensaje de error', async () => {
    entrar();
    for (const r of [respuesta(400, { detail: 'x' }), respuesta(500, undefined, TOKEN), respuesta(403, { detail: `bad ${TOKEN}` })]) {
      const { fn } = fetchFalso(r);
      entrar();
      const e = await pedir('/x', { fetchFn: fn }).catch((x: ErrorPanel) => x);
      expect(String((e as ErrorPanel).message)).not.toContain(TOKEN);
    }
  });
});
