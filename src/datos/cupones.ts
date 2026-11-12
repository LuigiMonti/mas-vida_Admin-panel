/*
 * Cupones (coins.Canje) y estadísticas de canje. Futuro: /api/v1/admin/cupones/…
 *
 * - Un cupón nace de tres formas: se compra en la tienda con monedas, se gana
 *   completando una semana patrocinada, o se gana en el podio de La Liga.
 * - Dura 3 semanas (21 días). Estados: activo, usado, expirado.
 * - Marcar como usado lo hace hoy el equipo a mano (lo pide la caja del
 *   comercio con el código). Solo un cupón activo y sin vencer.
 * - `usado_por` (quién lo marcó) NO existe en el modelo: ver PENDIENTES_BACKEND.md.
 */
import { pedir } from './api';
import { registrar } from './bitacora';
import { conectado } from './modo';
import { premioMock, premiosMock, registrarNumerosDePremio, urlLogo } from './premios';
import { copia, ErrorPanel, hoyGT, simularRed } from './red';
import { correoActual, puede } from './sesion';

export type EstadoCupon = 'activo' | 'usado' | 'expirado';
export type OrigenCupon = 'tienda' | 'semana' | 'liga';

export const NOMBRE_ORIGEN: Record<OrigenCupon, string> = { tienda: 'Tienda', semana: 'Semana patrocinada', liga: 'La Liga' };
export const NOMBRE_ESTADO_CUPON: Record<EstadoCupon, string> = { activo: 'Activo', usado: 'Usado', expirado: 'Vencido' };
export const DIAS_DE_VIDA = 21;

export interface Cupon {
  codigo: string;
  usuario_id: string;
  premio_id: number;
  comercio: string;
  /** Lo que dice el cupón: el beneficio del patrocinio o la descripción del premio. */
  beneficio: string;
  logo: string;
  /** Fondo detrás del logo ("#RRGGBB" o vacío). */
  fondo: string;
  origen: OrigenCupon;
  /** "Semana 3", "La Liga de octubre", "La Liga · temporada 4". Vacío en los de la tienda. */
  ganado_en: string;
  costo_monedas: number;
  fecha_canje: string;
  fecha_expiracion_cupon: string;
  estado: EstadoCupon;
  usado_en: string | null;
  /** Quién lo marcó como usado. (Campo nuevo: falta en el backend.) */
  usado_por: string | null;
}

/* ================================================================= fechas y mock */

const HOY = hoyGT();

function sumar(f: string, dias: number): string {
  const d = new Date(`${f.slice(0, 10)}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

function rng(semilla: number) {
  let h = semilla >>> 0;
  return () => {
    h = Math.imul(h ^ (h >>> 15), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    return ((h ^= h >>> 16) >>> 0) / 4294967296;
  };
}

const LETRAS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
function codigo(r: () => number, comercio: string): string {
  const pre = comercio.replace(/[^A-Za-z]/g, '').slice(0, 2).toUpperCase().padEnd(2, 'X');
  const t = (n: number) => Array.from({ length: n }, () => LETRAS[Math.floor(r() * LETRAS.length)]).join('');
  return `MV-${pre}${t(2)}-${t(4)}`;
}

const USUARIOS = ['u_8f21', 'u_3a90', 'u_c7d4', 'u_51be', 'u_9e02', 'u_d118', 'u_4b6c', 'u_7f3a', 'u_e5d9', 'u_b2f8', 'u_6c40'];

const cupones: Cupon[] = [];

(function sembrar() {
  const r = rng(45);
  const lista = premiosMock();
  // Los más baratos se canjean más: pesa por el inverso del costo.
  const pesos = lista.map((p) => 1 / Math.max(10, p.costo_monedas));
  const total = pesos.reduce((a, b) => a + b, 0);
  const elegir = () => {
    let x = r() * total;
    for (let i = 0; i < lista.length; i++) if ((x -= pesos[i]!) <= 0) return lista[i]!;
    return lista[0]!;
  };
  for (let n = 0; n < 140; n++) {
    const p = elegir();
    const hace = Math.floor(r() * 60);
    const canje = sumar(HOY, -hace);
    const vence = sumar(canje, DIAS_DE_VIDA);
    const usado = r() < 0.55 && hace > 0;
    const usadoEn = usado ? sumar(canje, Math.min(hace, 1 + Math.floor(r() * 14))) : null;
    cupones.push({
      codigo: codigo(r, p.comercio_aliado),
      usuario_id: USUARIOS[Math.floor(r() * USUARIOS.length)]!,
      premio_id: p.id,
      comercio: p.comercio_aliado,
      beneficio: p.descripcion,
      logo: p.foto,
      fondo: p.fondo,
      origen: 'tienda',
      ganado_en: '',
      costo_monedas: p.costo_monedas,
      fecha_canje: `${canje}T${String(8 + Math.floor(r() * 12)).padStart(2, '0')}:15:00-06:00`,
      fecha_expiracion_cupon: vence,
      estado: usado ? 'usado' : vence < HOY ? 'expirado' : 'activo',
      usado_en: usadoEn ? `${usadoEn}T13:40:00-06:00` : null,
      usado_por: usado ? 'soporte@masvidaapp.com' : null,
    });
  }
  // Semanas patrocinadas por Ookii (semanas 1 y 5) y podio de La Liga de octubre.
  const ookii = lista.find((p) => p.nombre === 'Ookii')!;
  const smart = lista.find((p) => p.nombre === 'Smart Fit')!;
  const ganados: Array<[typeof ookii, OrigenCupon, string, string, string, number]> = [
    [ookii, 'semana', 'Semana 1', '2x1 en sushi', '2026-10-06', 9],
    [ookii, 'semana', 'Semana 5', '2x1 en sushi', '2026-11-03', 7],
    [smart, 'liga', 'La Liga de octubre', 'Un mes gratis', '2026-11-09', 3],
  ];
  for (const [p, origen, donde, beneficio, fecha, cuantos] of ganados) {
    for (let i = 0; i < cuantos; i++) {
      const vence = sumar(fecha, DIAS_DE_VIDA);
      const usado = r() < 0.5 && fecha < HOY;
      cupones.push({
        codigo: codigo(r, p.comercio_aliado),
        usuario_id: USUARIOS[(i * 3 + cuantos) % USUARIOS.length]!,
        premio_id: p.id,
        comercio: p.comercio_aliado,
        beneficio,
        logo: p.foto,
        fondo: p.fondo,
        origen,
        ganado_en: donde,
        costo_monedas: 0,
        fecha_canje: `${fecha}T00:05:00-06:00`,
        fecha_expiracion_cupon: vence,
        estado: usado ? 'usado' : vence < HOY ? 'expirado' : 'activo',
        usado_en: usado ? `${sumar(fecha, 4)}T19:10:00-06:00` : null,
        usado_por: usado ? 'admin@masvidaapp.com' : null,
      });
    }
  }
  // Uno fijo, fácil de probar en el buscador.
  cupones.push({
    codigo: 'MV-OK41-7XQ2',
    usuario_id: 'u_8f21',
    premio_id: ookii.id,
    comercio: 'Ookii',
    beneficio: '2x1 en sushi',
    logo: ookii.foto,
    fondo: ookii.fondo,
    origen: 'semana',
    ganado_en: 'Semana 5',
    costo_monedas: 0,
    fecha_canje: `${sumar(HOY, -2)}T00:05:00-06:00`,
    fecha_expiracion_cupon: sumar(HOY, DIAS_DE_VIDA - 2),
    estado: 'activo',
    usado_en: null,
    usado_por: null,
  });
})();

// La lista de premios muestra cuántos se canjearon y usaron.
registrarNumerosDePremio((id) => {
  const de = cupones.filter((c) => c.premio_id === id);
  return { canjeados: de.length, usados: de.filter((c) => c.estado === 'usado').length };
});

/** Para patrocinios.ts (mock). */
export function cuponesMock(): readonly Cupon[] {
  return cupones;
}

/** El código como lo escriben en la caja: sin espacios, en mayúsculas, con guiones. */
export function normalizarCodigo(c: string): string {
  const s = c.toUpperCase().replace(/[^A-Z0-9]/g, '');
  if (s.length === 10 && s.startsWith('MV')) return `MV-${s.slice(2, 6)}-${s.slice(6)}`;
  return c.trim().toUpperCase();
}

/** Un activo cuya fecha ya pasó cuenta como vencido aunque nadie lo haya marcado. */
function alDia(c: Cupon): Cupon {
  return c.estado === 'activo' && c.fecha_expiracion_cupon < HOY ? { ...c, estado: 'expirado' } : c;
}

/* ================================================================= API */

export function buscarCupon(codigoEscrito: string): Promise<Cupon> {
  const cod = normalizarCodigo(codigoEscrito);
  if (conectado('cupones')) return pedir<Cupon>(`/api/v1/admin/cupones/${encodeURIComponent(cod)}`);
  return simularRed(() => {
    if (!cod) throw new ErrorPanel('Escribe el código.', { codigo: 'Escribe el código del cupón.' });
    const c = cupones.find((x) => x.codigo === cod);
    if (!c) throw new ErrorPanel(`No existe un cupón con el código ${cod}.`, undefined, { estado: 404 });
    return copia(alDia(c));
  });
}

export interface FiltroCupones {
  q?: string;
  usuario_id?: string;
  estado?: EstadoCupon | 'todos';
  origen?: OrigenCupon | 'todos';
  premio_id?: number;
}

export function listarCupones(f: FiltroCupones = {}): Promise<Cupon[]> {
  if (conectado('cupones'))
    return pedir<Cupon[]>('/api/v1/admin/cupones', {
      query: { q: f.q, usuario_id: f.usuario_id, estado: f.estado === 'todos' ? undefined : f.estado, origen: f.origen === 'todos' ? undefined : f.origen, premio_id: f.premio_id },
    });
  return simularRed(() => {
    const q = (f.q ?? '').trim().toLowerCase();
    return copia(
      cupones
        .map(alDia)
        .filter((c) => !f.usuario_id || c.usuario_id === f.usuario_id)
        .filter((c) => !f.premio_id || c.premio_id === f.premio_id)
        .filter((c) => !f.estado || f.estado === 'todos' || c.estado === f.estado)
        .filter((c) => !f.origen || f.origen === 'todos' || c.origen === f.origen)
        .filter((c) => !q || [c.codigo, c.comercio, c.usuario_id, c.beneficio].some((v) => v.toLowerCase().includes(q)))
        .sort((a, b) => b.fecha_canje.localeCompare(a.fecha_canje)),
    );
  });
}

/** Marca un cupón como usado. Solo si está activo y no venció. */
export function marcarUsado(codigoEscrito: string): Promise<Cupon> {
  const cod = normalizarCodigo(codigoEscrito);
  if (conectado('cupones')) return pedir<Cupon>(`/api/v1/admin/cupones/${encodeURIComponent(cod)}/usar`, { metodo: 'POST' });
  return simularRed(() => {
    if (!puede('marcar_cupon')) throw new ErrorPanel('Tu rol no puede marcar cupones.');
    const c = cupones.find((x) => x.codigo === cod);
    if (!c) throw new ErrorPanel(`No existe un cupón con el código ${cod}.`, undefined, { estado: 404 });
    const actual = alDia(c);
    if (actual.estado === 'usado') throw new ErrorPanel(`Este cupón ya se usó${c.usado_en ? ` el ${c.usado_en.slice(0, 10)}` : ''}.`, undefined, { codigo: 'cupon_usado' });
    if (actual.estado === 'expirado') throw new ErrorPanel(`Este cupón venció el ${c.fecha_expiracion_cupon}. No se puede usar.`, undefined, { codigo: 'cupon_vencido' });
    c.estado = 'usado';
    c.usado_en = new Date().toISOString();
    c.usado_por = correoActual();
    registrar('marcar_cupon', c.usuario_id, `${c.codigo} · ${c.comercio} · ${c.beneficio}`);
    return copia(c);
  }, 450);
}

/* ================================================================= estadísticas */

export type Periodo = '7' | '30' | 'season' | 'todo';

export interface FilaEstadistica {
  premio_id: number;
  nombre: string;
  categoria: string;
  logo: string;
  fondo: string;
  /** Todos los cupones de ese premio (comprados + ganados). */
  canjeados: number;
  comprados: number;
  ganados: number;
  usados: number;
  vencidos: number;
  activos: number;
  monedas_gastadas: number;
  cupo: number | null;
  /** Todos los cupones que ha dado, sin importar el periodo: es lo que se resta del cupo. */
  canjeados_total: number;
}

export interface EstadisticasCanje {
  periodo: Periodo;
  desde: string | null;
  totales: { canjeados: number; usados: number; vencidos: number; activos: number; monedas_gastadas: number };
  por_origen: Record<OrigenCupon, number>;
  /** Cupones canjeados por día, para la gráfica. */
  por_dia: Array<{ fecha: string; canjeados: number }>;
  premios: FilaEstadistica[];
}

function desdeDe(periodo: Periodo): string | null {
  if (periodo === '7') return sumar(HOY, -6);
  if (periodo === '30') return sumar(HOY, -29);
  if (periodo === 'season') return '2026-09-28';
  return null;
}

export function obtenerEstadisticas(periodo: Periodo): Promise<EstadisticasCanje> {
  if (conectado('cupones')) return pedir<EstadisticasCanje>('/api/v1/admin/cupones/estadisticas', { query: { periodo } });
  return simularRed(() => {
    const desde = desdeDe(periodo);
    const del = cupones.map(alDia).filter((c) => !desde || c.fecha_canje.slice(0, 10) >= desde);
    const porPremio = new Map<number, FilaEstadistica>();
    for (const c of del) {
      const p = premioMock(c.premio_id);
      const f =
        porPremio.get(c.premio_id) ??
        ({ premio_id: c.premio_id, nombre: p?.nombre ?? c.comercio, categoria: p?.categoria ?? '', logo: p?.foto ?? c.logo, fondo: p?.fondo ?? '', canjeados: 0, comprados: 0, ganados: 0, usados: 0, vencidos: 0, activos: 0, monedas_gastadas: 0, cupo: p?.cupo ?? null, canjeados_total: cupones.filter((x) => x.premio_id === c.premio_id).length } satisfies FilaEstadistica);
      f.canjeados++;
      if (c.origen === 'tienda') f.comprados++;
      else f.ganados++;
      if (c.estado === 'usado') f.usados++;
      if (c.estado === 'expirado') f.vencidos++;
      if (c.estado === 'activo') f.activos++;
      f.monedas_gastadas += c.costo_monedas;
      porPremio.set(c.premio_id, f);
    }
    const inicio = desde ?? del.reduce((m, c) => (c.fecha_canje < m ? c.fecha_canje.slice(0, 10) : m), HOY);
    const por_dia: EstadisticasCanje['por_dia'] = [];
    for (let f = inicio; f <= HOY; f = sumar(f, 1)) por_dia.push({ fecha: f, canjeados: del.filter((c) => c.fecha_canje.slice(0, 10) === f).length });
    const premios = [...porPremio.values()].sort((a, b) => b.canjeados - a.canjeados || a.nombre.localeCompare(b.nombre, 'es'));
    return {
      periodo,
      desde,
      totales: {
        canjeados: del.length,
        usados: del.filter((c) => c.estado === 'usado').length,
        vencidos: del.filter((c) => c.estado === 'expirado').length,
        activos: del.filter((c) => c.estado === 'activo').length,
        monedas_gastadas: del.reduce((s, c) => s + c.costo_monedas, 0),
      },
      por_origen: {
        tienda: del.filter((c) => c.origen === 'tienda').length,
        semana: del.filter((c) => c.origen === 'semana').length,
        liga: del.filter((c) => c.origen === 'liga').length,
      },
      por_dia,
      premios,
    };
  });
}

export { urlLogo };
