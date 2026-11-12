/*
 * Premios del catálogo: coins.Premio. Futuro: /api/v1/admin/premios/…
 *
 * - Un premio no se borra: se apaga (`activo=false`). Los cupones ya
 *   canjeados siguen apuntando a él.
 * - `comercio_aliado`: hoy importar_premios lo llena con el mismo nombre del
 *   premio; el panel lo deja editar aparte.
 * - `cupo` (cuántos cupones puede dar el comercio) NO existe en el modelo:
 *   ver PENDIENTES_BACKEND.md.
 * - Los datos de muestra son el catálogo real de la app
 *   (DEMO/vida_demo/assets/mock/premios.json). Ningún beneficio está cerrado.
 */
import { pedir } from './api';
import { registrar } from './bitacora';
import { conectado } from './modo';
import { copia, ErrorPanel, hoyGT, simularRed } from './red';
import { puede } from './sesion';

export const CATEGORIAS = ['Restaurantes', 'Ropa', 'Cafecitos', 'Conveniencia', 'Deportes/ejercicio', 'Farmacias'] as const;

export interface Premio {
  id: number;
  nombre: string;
  comercio_aliado: string;
  descripcion: string;
  costo_monedas: number;
  zona: string;
  categoria: string;
  detalle: string;
  condiciones: string;
  /** Ruta del logo dentro de la app: "assets/img/premios/…". */
  foto: string;
  /** "#RRGGBB" detrás del logo; vacío = blanco. */
  fondo: string;
  activo: boolean;
  /** Último día en que se puede canjear. null = sin fecha. */
  vigente_hasta: string | null;
  /** Cuántos cupones puede dar. null = sin límite. (Campo nuevo: falta en el backend.) */
  cupo: number | null;
}

/** Lo que muestra la lista: el premio y sus números. */
export interface FilaPremio extends Premio {
  canjeados: number;
  usados: number;
  /** Tiene un patrocinio "destacado" vigente. */
  destacado: boolean;
}

export type DatosPremio = Omit<Premio, 'id'>;

export type EstadoPremio = 'activos' | 'apagados' | 'vencidos' | 'todos';

/** El logo de la app, servido por el panel en /premios/… */
export function urlLogo(foto: string): string | undefined {
  if (!foto) return undefined;
  return foto.startsWith('http') ? foto : `/${foto.replace(/^assets\/img\//, '')}`;
}

/* ================================================================= mock */

const HOY = hoyGT();

const CATALOGO: Array<[string, string, number, string, string?]> = [
  ['Ookii', 'Restaurantes', 40, 'restaurantes/ookii.webp'],
  ['Smart Fit', 'Deportes/ejercicio', 45, 'deportes-ejercicio/smart-fit.webp'],
  ['El Cafecito', 'Cafecitos', 20, 'cafecitos/el-cafecito.webp'],
  ['Cruz Verde', 'Farmacias', 30, 'farmacias/cruz-verde.svg'],
  ['Sportcity', 'Ropa', 55, 'ropa/sportcity.webp'],
  ['Yum Greens', 'Restaurantes', 35, 'restaurantes/yum-greens.webp'],
  ['Super 24', 'Conveniencia', 15, 'conveniencia/super-24.webp'],
  ['Frutalle', 'Restaurantes', 25, 'restaurantes/frutalle.webp', '#000000'],
  ['Fabletics', 'Ropa', 60, 'ropa/fabletics.webp'],
  ['C3ntro', 'Deportes/ejercicio', 65, 'deportes-ejercicio/c3ntro.webp'],
  ['La Torre', 'Conveniencia', 35, 'conveniencia/la-torre.webp'],
  ['Padel Arena', 'Deportes/ejercicio', 70, 'deportes-ejercicio/padel-arena.webp'],
  ['Le Café', 'Cafecitos', 22, 'cafecitos/le-cafe.webp'],
  ['Montanos', 'Restaurantes', 35, 'restaurantes/montanos.webp', '#000000'],
  ['Cemaco', 'Conveniencia', 50, 'conveniencia/cemaco.webp'],
  ['12 Onzas', 'Cafecitos', 22, 'cafecitos/12-onzas.webp'],
  ['Alma Active', 'Ropa', 45, 'ropa/alma-active.webp'],
  ['Voltio', 'Deportes/ejercicio', 65, 'deportes-ejercicio/voltio.webp'],
  ['Panito Bakery', 'Cafecitos', 28, 'cafecitos/panito-bakery.webp'],
  ['La Cantina del Gringo', 'Restaurantes', 30, 'restaurantes/la-cantina-del-gringo.webp'],
  ['Aera', 'Deportes/ejercicio', 70, 'deportes-ejercicio/aera.webp'],
  ['Skechers', 'Ropa', 75, 'ropa/skechers.webp'],
  ['Novex', 'Conveniencia', 40, 'conveniencia/novex.webp'],
  ['Sporta', 'Deportes/ejercicio', 55, 'deportes-ejercicio/sporta.webp'],
  ['Farmacias Batres', 'Farmacias', 25, 'farmacias/farmacias-batres.webp'],
  ['Plantiful', 'Restaurantes', 45, 'restaurantes/plantiful.webp'],
  ['Cinema Bistro', 'Conveniencia', 60, 'conveniencia/cinema-bistro.webp'],
  ['La Torre Express', 'Conveniencia', 18, 'conveniencia/la-torre-express.webp'],
];

const premios: Premio[] = CATALOGO.map(([nombre, categoria, costo, foto, fondo], i) => ({
  id: i + 1,
  nombre,
  comercio_aliado: nombre,
  descripcion: 'Beneficio por definir',
  costo_monedas: costo,
  zona: 'Guatemala',
  categoria,
  detalle: 'Todavía no se cierra el beneficio con este comercio. Acá va lo que el asegurado recibe al canjear.',
  condiciones: 'Pendiente de acordar con el comercio.',
  foto: `assets/img/premios/${foto}`,
  fondo: fondo ?? '',
  // Un par apagados y uno vencido, para ver esos estados.
  activo: nombre !== 'Cinema Bistro' && nombre !== 'Novex',
  vigente_hasta: nombre === 'La Torre Express' ? '2026-10-31' : '2026-12-31',
  cupo: nombre === 'Smart Fit' ? 50 : nombre === 'Padel Arena' ? 20 : null,
}));

let siguienteId = premios.length + 1;

/** Para cupones.ts y patrocinios.ts (mock): el premio por id, sin copiar. */
export function premioMock(id: number): Premio | undefined {
  return premios.find((p) => p.id === id);
}

export function premiosMock(): readonly Premio[] {
  return premios;
}

// Los números de la lista los ponen cupones.ts (canjeados, usados) y
// patrocinios.ts (destacado), sin que este archivo los importe: así no hay
// importaciones circulares. Las pantallas de premios importan los dos.
type Numeros = { canjeados: number; usados: number; destacado: boolean };
const fuentes: Array<(id: number) => Partial<Numeros>> = [];
export function registrarNumerosDePremio(fn: (id: number) => Partial<Numeros>): void {
  fuentes.push(fn);
}
function numeros(id: number): Numeros {
  return Object.assign({ canjeados: 0, usados: 0, destacado: false }, ...fuentes.map((f) => f(id)));
}

function estadoDe(p: Premio): Exclude<EstadoPremio, 'todos'> {
  if (!p.activo) return 'apagados';
  if (p.vigente_hasta && p.vigente_hasta < HOY) return 'vencidos';
  return 'activos';
}

/* ================================================================= API */

export function listarPremios(filtro: { q?: string; categoria?: string; estado?: EstadoPremio } = {}): Promise<FilaPremio[]> {
  if (conectado('premios'))
    return pedir<FilaPremio[]>('/api/v1/admin/premios', { query: { q: filtro.q, categoria: filtro.categoria, estado: filtro.estado === 'todos' ? undefined : filtro.estado } });
  return simularRed(() => {
    const q = (filtro.q ?? '').trim().toLowerCase();
    return copia(
      premios
        .filter((p) => !filtro.categoria || p.categoria === filtro.categoria)
        .filter((p) => !filtro.estado || filtro.estado === 'todos' || estadoDe(p) === filtro.estado)
        .filter((p) => !q || [p.nombre, p.comercio_aliado, p.descripcion, p.categoria].some((v) => v.toLowerCase().includes(q)))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
        .map((p) => ({ ...p, ...numeros(p.id) })),
    );
  });
}

export function obtenerPremio(id: number): Promise<FilaPremio> {
  if (conectado('premios')) return pedir<FilaPremio>(`/api/v1/admin/premios/${id}`);
  return simularRed(() => {
    const p = premioMock(id);
    if (!p) throw new ErrorPanel('Ese premio no existe.', undefined, { estado: 404 });
    return copia({ ...p, ...numeros(p.id) });
  });
}

/** Valida igual que el backend tiene que validar. Exportado para los tests. */
export function validarPremio(d: DatosPremio): Record<string, string> {
  const e: Record<string, string> = {};
  if (!d.nombre.trim()) e.nombre = 'Escribe el nombre.';
  else if (d.nombre.length > 150) e.nombre = 'Máximo 150 caracteres.';
  if (!d.comercio_aliado.trim()) e.comercio_aliado = 'Escribe el comercio.';
  if (!d.descripcion.trim()) e.descripcion = 'Escribe qué recibe la persona.';
  if (!Number.isInteger(d.costo_monedas) || d.costo_monedas < 0) e.costo_monedas = 'Un entero, 0 o más.';
  if (d.fondo && !/^#[0-9a-fA-F]{6}$/.test(d.fondo)) e.fondo = 'Como #RRGGBB.';
  if (d.cupo !== null && (!Number.isInteger(d.cupo) || d.cupo < 1)) e.cupo = 'Al menos 1, o vacío para sin límite.';
  if (d.zona.length > 100) e.zona = 'Máximo 100 caracteres.';
  return e;
}

/** Crea (id null) o edita un premio. Solo admin. */
export function guardarPremio(id: number | null, d: DatosPremio): Promise<Premio> {
  if (conectado('premios'))
    return id === null ? pedir<Premio>('/api/v1/admin/premios', { cuerpo: d }) : pedir<Premio>(`/api/v1/admin/premios/${id}`, { metodo: 'PUT', cuerpo: d });
  return simularRed(() => {
    if (!puede('editar_premios')) throw new ErrorPanel('Tu rol no puede editar premios.');
    const campos = validarPremio(d);
    if (Object.keys(campos).length) throw new ErrorPanel('Revisa los campos marcados.', campos);
    const limpio: DatosPremio = { ...d, nombre: d.nombre.trim(), comercio_aliado: d.comercio_aliado.trim(), fondo: d.fondo.toUpperCase() };
    if (id === null) {
      const nuevo = { id: siguienteId++, ...limpio };
      premios.push(nuevo);
      registrar('editar_premio', nuevo.nombre, `Premio creado · ${nuevo.costo_monedas} monedas`);
      return copia(nuevo);
    }
    const p = premioMock(id);
    if (!p) throw new ErrorPanel('Ese premio no existe.', undefined, { estado: 404 });
    const cambios = (Object.keys(limpio) as Array<keyof DatosPremio>).filter((k) => p[k] !== limpio[k]);
    Object.assign(p, limpio);
    registrar('editar_premio', p.nombre, cambios.length ? `Cambió: ${cambios.join(', ')}` : 'Sin cambios');
    return copia(p);
  });
}

/** Apaga o prende un premio. Apagarlo lo saca del catálogo; los cupones ya dados siguen valiendo. */
export function cambiarActivo(id: number, activo: boolean): Promise<void> {
  if (conectado('premios')) return pedir<void>(`/api/v1/admin/premios/${id}`, { metodo: 'PATCH', cuerpo: { activo } });
  return simularRed(() => {
    if (!puede('editar_premios')) throw new ErrorPanel('Tu rol no puede editar premios.');
    const p = premioMock(id);
    if (!p) throw new ErrorPanel('Ese premio no existe.', undefined, { estado: 404 });
    p.activo = activo;
    registrar('editar_premio', p.nombre, activo ? 'Premio prendido' : 'Premio archivado');
  });
}

/* ================================================================= importar */

export interface ResultadoImportacion {
  crear: string[];
  actualizar: string[];
  errores: string[];
}

interface PremioJson {
  nombre?: unknown;
  descripcion?: unknown;
  costo_monedas?: unknown;
  zona?: unknown;
  categoria?: unknown;
  detalle?: unknown;
  condiciones?: unknown;
  foto?: unknown;
  fondo?: unknown;
  vence?: unknown;
}

function leerJson(texto: string): { premios: DatosPremio[]; errores: string[] } {
  let datos: unknown;
  try {
    datos = JSON.parse(texto);
  } catch {
    return { premios: [], errores: ['No es un JSON válido.'] };
  }
  const lista = Array.isArray(datos) ? datos : (datos as { premios?: unknown })?.premios;
  if (!Array.isArray(lista)) return { premios: [], errores: ['Falta la lista "premios".'] };
  const errores: string[] = [];
  const salida: DatosPremio[] = [];
  lista.forEach((crudo: PremioJson, i) => {
    const s = (v: unknown) => (typeof v === 'string' ? v : '');
    const d: DatosPremio = {
      nombre: s(crudo.nombre),
      // Igual que importar_premios: el comercio es el nombre.
      comercio_aliado: s(crudo.nombre),
      descripcion: s(crudo.descripcion),
      costo_monedas: typeof crudo.costo_monedas === 'number' ? crudo.costo_monedas : NaN,
      zona: s(crudo.zona) || 'Guatemala',
      categoria: s(crudo.categoria),
      detalle: s(crudo.detalle),
      condiciones: s(crudo.condiciones),
      foto: s(crudo.foto),
      fondo: s(crudo.fondo),
      activo: true,
      vigente_hasta: s(crudo.vence) || null,
      cupo: null,
    };
    const e = validarPremio(d);
    if (Object.keys(e).length) errores.push(`Premio #${i + 1} (${d.nombre || 'sin nombre'}): ${Object.values(e).join(' ')}`);
    else salida.push(d);
  });
  return { premios: salida, errores };
}

/**
 * = python manage.py importar_premios. Con `aplicar=false` solo dice qué haría.
 * Si un premio viene mal no se guarda nada (igual que el comando).
 */
export function importarCatalogo(texto: string, aplicar: boolean): Promise<ResultadoImportacion> {
  if (conectado('premios')) return pedir<ResultadoImportacion>('/api/v1/admin/premios/importar', { cuerpo: { json: texto, aplicar } });
  return simularRed(() => {
    if (!puede('editar_premios')) throw new ErrorPanel('Tu rol no puede importar premios.');
    const { premios: leidos, errores } = leerJson(texto);
    const r: ResultadoImportacion = { crear: [], actualizar: [], errores };
    for (const d of leidos) (premios.some((p) => p.nombre === d.nombre) ? r.actualizar : r.crear).push(d.nombre);
    if (!aplicar || errores.length) return r;
    for (const d of leidos) {
      const p = premios.find((x) => x.nombre === d.nombre);
      if (p) Object.assign(p, { ...d, activo: p.activo, cupo: p.cupo });
      else premios.push({ id: siguienteId++, ...d });
    }
    registrar('editar_premio', 'Catálogo', `Importado: ${r.crear.length} creados, ${r.actualizar.length} actualizados`);
    return r;
  }, 600);
}
