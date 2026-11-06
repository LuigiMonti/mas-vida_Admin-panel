/*
 * Cliente HTTP del panel contra el backend de Django.
 *
 * - URL base: VITE_API_URL (ver .env.example).
 * - Encabezado: `Authorization: Token <clave>` (django-rest-knox), igual que
 *   la app. El token nunca sale de aquí.
 * - Respuestas de error que entiende (las del backend de +Vida):
 *     DRF:    400 { campo: ["…"] }, { non_field_errors: ["…"] }, { detail: "…" }
 *     Propias: { error: "codigo", mensaje?: "…" }   (429 trae reintentar_en)
 *   Todas terminan en un ErrorPanel con el texto listo para mostrar.
 * - 401: la sesión venció o la cerraron. Se borra y el panel vuelve al login.
 */
import { ErrorPanel } from './red';
import { marcarSesionVencida, tokenActual } from './token';

export const API_URL = (import.meta.env.VITE_API_URL ?? 'http://localhost:8000').replace(/\/+$/, '');

/** Cuánto esperar una respuesta antes de rendirse. */
const TIEMPO_MAXIMO_MS = 20_000;

/** Textos del panel para los `error` propios del backend. Si no está, se usa su `mensaje`. */
const MENSAJES: Record<string, string> = {
  demasiados_intentos: 'Demasiados intentos. Espera un momento y vuelve a probar.',
  demasiado_grande: 'Lo que se envió es demasiado grande.',
  cierre_en_curso: 'Hay otro cierre en curso. Espera a que termine.',
  sin_permiso: 'Tu rol no puede hacer esto.',
};

type Metodo = 'GET' | 'POST' | 'PUT' | 'PATCH' | 'DELETE';

export interface OpcionesPedido {
  metodo?: Metodo;
  cuerpo?: unknown;
  /** Para el login: no manda el token ni trata el 401 como sesión vencida. */
  sinSesion?: boolean;
  /** Parámetros de la URL; los vacíos no se mandan. */
  query?: Record<string, string | number | boolean | undefined | null>;
  /** Para pruebas: otro fetch. */
  fetchFn?: typeof fetch;
}

function armarUrl(ruta: string, query?: OpcionesPedido['query']): string {
  const url = `${API_URL}${ruta.startsWith('/') ? ruta : `/${ruta}`}`;
  if (!query) return url;
  const p = new URLSearchParams();
  for (const [k, v] of Object.entries(query)) if (v !== undefined && v !== null && v !== '') p.set(k, String(v));
  const qs = p.toString();
  return qs ? `${url}?${qs}` : url;
}

const texto = (v: unknown): string => (Array.isArray(v) ? v.map(String).join(' ') : typeof v === 'string' ? v : '');

/** Convierte el cuerpo de un error del backend en un ErrorPanel. Exportado para los tests. */
export function traducirError(estado: number, cuerpo: unknown): ErrorPanel {
  const c = (cuerpo && typeof cuerpo === 'object' ? cuerpo : {}) as Record<string, unknown>;
  const codigo = typeof c.error === 'string' ? c.error : undefined;
  const opciones = { estado, codigo };

  // Respuesta propia: { error, mensaje }
  if (codigo) {
    let m = MENSAJES[codigo] ?? (typeof c.mensaje === 'string' ? c.mensaje : `Error del servidor (${codigo}).`);
    if (estado === 429 && typeof c.reintentar_en === 'number') m = `${m} Puedes volver a intentar en ${Math.max(1, Math.ceil(c.reintentar_en / 60))} min.`;
    return new ErrorPanel(m, undefined, opciones);
  }

  if (estado === 400) {
    const campos: Record<string, string> = {};
    let general = '';
    for (const [k, v] of Object.entries(c)) {
      if (k === 'non_field_errors' || k === 'detail') general = texto(v);
      else if (texto(v)) campos[k] = texto(v);
    }
    if (Object.keys(campos).length) return new ErrorPanel(general || 'Revisa los campos marcados.', campos, opciones);
    return new ErrorPanel(general || 'Los datos no son válidos.', undefined, opciones);
  }

  const detalle = texto(c.detail);
  if (estado === 401) return new ErrorPanel('Tu sesión venció. Vuelve a entrar.', undefined, opciones);
  if (estado === 403) return new ErrorPanel(detalle && !/permission|credentials/i.test(detalle) ? detalle : 'No tienes permiso para esto.', undefined, opciones);
  if (estado === 404) return new ErrorPanel('No se encontró lo que buscabas.', undefined, opciones);
  if (estado === 409) return new ErrorPanel(detalle || 'Alguien más cambió esto. Recarga y vuelve a intentar.', undefined, opciones);
  if (estado === 413) return new ErrorPanel(MENSAJES.demasiado_grande!, undefined, opciones);
  if (estado === 429) return new ErrorPanel(MENSAJES.demasiados_intentos!, undefined, opciones);
  if (estado >= 500) return new ErrorPanel('El servidor tuvo un problema. Inténtalo de nuevo en un momento.', undefined, opciones);
  return new ErrorPanel(detalle || `El servidor respondió ${estado}.`, undefined, opciones);
}

async function leerCuerpo(r: Response): Promise<unknown> {
  if (r.status === 204) return undefined;
  const t = await r.text();
  if (!t) return undefined;
  try {
    return JSON.parse(t);
  } catch {
    // HTML de un 500 o de un proxy: no se muestra.
    return undefined;
  }
}

/** Pide algo a la API. Resuelve con el JSON, o rechaza con un ErrorPanel. */
export async function pedir<T>(ruta: string, o: OpcionesPedido = {}): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  if (o.cuerpo !== undefined) headers['Content-Type'] = 'application/json';
  const token = o.sinSesion ? null : tokenActual();
  if (token) headers.Authorization = `Token ${token}`;

  const controlador = new AbortController();
  const reloj = setTimeout(() => controlador.abort(), TIEMPO_MAXIMO_MS);
  let r: Response;
  try {
    r = await (o.fetchFn ?? fetch)(armarUrl(ruta, o.query), {
      method: o.metodo ?? (o.cuerpo !== undefined ? 'POST' : 'GET'),
      headers,
      body: o.cuerpo !== undefined ? JSON.stringify(o.cuerpo) : undefined,
      signal: controlador.signal,
    });
  } catch (e) {
    const abortado = e instanceof DOMException && e.name === 'AbortError';
    throw new ErrorPanel(abortado ? 'El servidor tardó demasiado en responder.' : 'No se pudo conectar con el servidor. Revisa tu conexión.');
  } finally {
    clearTimeout(reloj);
  }

  const cuerpo = await leerCuerpo(r);
  if (r.ok) return cuerpo as T;
  if (r.status === 401 && !o.sinSesion) marcarSesionVencida();
  throw sinToken(traducirError(r.status, cuerpo), token);
}

/** Si el servidor devolviera el token dentro de un mensaje, se tapa antes de mostrarlo. */
function sinToken(e: ErrorPanel, token: string | null): ErrorPanel {
  if (!token) return e;
  const tapar = (t: string) => t.split(token).join('•••');
  e.message = tapar(e.message);
  if (e.campos) e.campos = Object.fromEntries(Object.entries(e.campos).map(([k, v]) => [k, tapar(v)]));
  return e;
}
