/*
 * Patrocinios: coins.Patrocinio. Futuro: /api/v1/admin/patrocinios/…
 *
 * Tres cosas que un comercio puede comprar (4 oct 2026):
 *   semana    → paga un cupón a quien completa esa semana (lunes a domingo)
 *   liga      → paga un cupón al podio de La Liga de ese mes (día 1 al último)
 *   destacado → su premio sale destacado en el catálogo (cualquier rango)
 * La marca, el logo y el fondo salen del premio; aquí van el periodo, el
 * cupón y el color de acento. Un patrocinio no se borra: se apaga.
 * Las validaciones son las de Patrocinio.clean() del backend.
 */
import { pedir } from './api';
import { registrar } from './bitacora';
import { cuponesMock } from './cupones';
import { conectado } from './modo';
import { premioMock, premiosMock, registrarNumerosDePremio } from './premios';
import { copia, ErrorPanel, hoyGT, simularRed } from './red';
import { puede } from './sesion';

export type TipoPatrocinio = 'semana' | 'liga' | 'destacado';

export const NOMBRE_TIPO_PATROCINIO: Record<TipoPatrocinio, string> = { semana: 'Semana', liga: 'La Liga', destacado: 'Premio destacado' };

export interface Patrocinio {
  id: number;
  tipo: TipoPatrocinio;
  premio_id: number;
  /** Del premio: nombre del comercio, logo y fondo. */
  comercio: string;
  logo: string;
  fondo: string;
  desde: string;
  hasta: string;
  /** Lo que se lleva quien gana ("2x1 en sushi"). Obligatorio en semana y liga. */
  cupon: string;
  /** "#RRGGBB" de los detalles de la marca. Vacío = el azul de +vida. */
  acento: string;
  activo: boolean;
}

export type DatosPatrocinio = Pick<Patrocinio, 'tipo' | 'premio_id' | 'desde' | 'hasta' | 'cupon' | 'acento'>;

export interface ReportePatrocinio {
  /** Cuántos cupones dio (los ganadores) y cuántos se usaron en el comercio. */
  ganados: number;
  usados: number;
  vencidos: number;
  activos: number;
}

/* ================================================================= fechas */

const HOY = hoyGT();
export const SEASON = { numero: 4, anio: 2026, fecha_inicio: '2026-09-28', fecha_fin: '2027-01-03' };

export function sumarDias(f: string, dias: number): string {
  const d = new Date(`${f}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + dias);
  return d.toISOString().slice(0, 10);
}

const diaSemana = (f: string) => new Date(`${f}T12:00:00Z`).getUTCDay(); // 0 domingo, 1 lunes
export function ultimoDelMes(f: string): string {
  const [y, m] = f.split('-').map(Number) as [number, number];
  return new Date(Date.UTC(y, m, 0)).toISOString().slice(0, 10);
}

/* ================================================================= mock */

let siguienteId = 1;
const patrocinios: Patrocinio[] = [];

function agregar(tipo: TipoPatrocinio, nombrePremio: string, desde: string, hasta: string, cupon: string, acento = ''): void {
  const p = premiosMock().find((x) => x.nombre === nombrePremio)!;
  patrocinios.push({ id: siguienteId++, tipo, premio_id: p.id, comercio: p.comercio_aliado, logo: p.foto, fondo: p.fondo, desde, hasta, cupon, acento, activo: true });
}

// Las alianzas del demo: placeholders de Diego, ninguna está cerrada.
agregar('semana', 'Ookii', '2026-09-28', '2026-10-04', '2x1 en sushi', '#C8102E');
agregar('semana', 'Ookii', '2026-10-26', '2026-11-01', '2x1 en sushi', '#C8102E');
agregar('semana', 'Smart Fit', '2026-11-16', '2026-11-22', 'Una semana gratis', '#FFC20E');
agregar('liga', 'Smart Fit', '2026-09-01', '2026-09-30', 'Un mes gratis', '#FFC20E');
agregar('liga', 'Sportcity', '2026-11-01', '2026-11-30', 'Q100 de descuento');
agregar('destacado', 'Ookii', '2026-10-01', '2026-12-31', '');
agregar('destacado', 'Smart Fit', '2026-10-01', '2026-12-31', '');

const vigenteHoy = (p: Patrocinio) => p.activo && p.desde <= HOY && HOY <= p.hasta;

registrarNumerosDePremio((id) => ({ destacado: patrocinios.some((p) => p.tipo === 'destacado' && p.premio_id === id && vigenteHoy(p)) }));

/** Para liga.ts (mock): el patrocinio de La Liga de un mes. */
export function patrocinioDeLigaMock(mes: string): Patrocinio | undefined {
  return patrocinios.find((p) => p.tipo === 'liga' && p.activo && p.desde === mes);
}

/* ================================================================= calendario */

export interface SemanaCalendario {
  numero: number;
  desde: string;
  hasta: string;
  patrocinio: Patrocinio | null;
  ya_paso: boolean;
}

export interface MesCalendario {
  mes: string;
  hasta: string;
  patrocinio: Patrocinio | null;
  ya_paso: boolean;
}

export interface Calendario {
  semanas: SemanaCalendario[];
  meses: MesCalendario[];
  destacados: Patrocinio[];
}

export function obtenerCalendario(): Promise<Calendario> {
  if (conectado('patrocinios')) return pedir<Calendario>('/api/v1/admin/patrocinios/calendario');
  return simularRed(() => {
    const semanas: SemanaCalendario[] = [];
    for (let i = 0; ; i++) {
      const desde = sumarDias(SEASON.fecha_inicio, i * 7);
      if (desde > SEASON.fecha_fin) break;
      const hasta = sumarDias(desde, 6);
      semanas.push({ numero: i + 1, desde, hasta, patrocinio: patrocinios.find((p) => p.tipo === 'semana' && p.activo && p.desde === desde) ?? null, ya_paso: hasta < HOY });
    }
    const meses: MesCalendario[] = [];
    let mes = '2026-09-01';
    for (let i = 0; i < 7; i++) {
      const hasta = ultimoDelMes(mes);
      meses.push({ mes, hasta, patrocinio: patrocinioDeLigaMock(mes) ?? null, ya_paso: hasta < HOY });
      mes = sumarDias(hasta, 1);
    }
    const destacados = patrocinios.filter((p) => p.tipo === 'destacado').sort((a, b) => b.desde.localeCompare(a.desde));
    return copia({ semanas, meses, destacados });
  });
}

/** Valida igual que Patrocinio.clean() del backend. Exportado para los tests. */
export function validarPatrocinio(d: DatosPatrocinio, existentes: readonly Patrocinio[] = patrocinios): Record<string, string> {
  const e: Record<string, string> = {};
  const p = premioMock(d.premio_id);
  if (!d.premio_id) e.premio_id = 'Elige el comercio.';
  if (!d.desde) e.desde = 'Elige desde cuándo.';
  if (!d.hasta) e.hasta = 'Elige hasta cuándo.';
  if (d.desde && d.hasta && d.hasta < d.desde) e.hasta = 'Tiene que ser el mismo día o después de «desde».';
  if (d.desde && d.hasta && !e.hasta) {
    if (d.tipo === 'semana' && (diaSemana(d.desde) !== 1 || d.hasta !== sumarDias(d.desde, 6)))
      e.desde = 'Una semana va de lunes a domingo: «desde» es el lunes y «hasta» el domingo.';
    if (d.tipo === 'liga' && (!d.desde.endsWith('-01') || d.hasta !== ultimoDelMes(d.desde))) e.desde = 'Un mes de La Liga va del día 1 al último día del mes.';
  }
  if (d.tipo !== 'destacado') {
    if (!d.cupon.trim()) e.cupon = 'Hace falta el texto del cupón que se gana.';
    if (p && !p.foto) e.premio_id = 'El comercio necesita logo (campo foto del premio).';
    if (!e.desde && existentes.some((x) => x.tipo === d.tipo && x.desde === d.desde && x.activo))
      e.desde = d.tipo === 'semana' ? 'Esa semana ya está vendida.' : 'Ese mes de La Liga ya está vendido.';
  }
  if (d.cupon.length > 150) e.cupon = 'Máximo 150 caracteres.';
  if (d.acento && !/^#[0-9a-fA-F]{6}$/.test(d.acento)) e.acento = 'Como #RRGGBB.';
  return e;
}

export function crearPatrocinio(d: DatosPatrocinio): Promise<Patrocinio> {
  if (conectado('patrocinios')) return pedir<Patrocinio>('/api/v1/admin/patrocinios', { cuerpo: d });
  return simularRed(() => {
    if (!puede('editar_patrocinios')) throw new ErrorPanel('Tu rol no puede vender patrocinios.');
    const campos = validarPatrocinio(d);
    if (Object.keys(campos).length) throw new ErrorPanel('Revisa los campos marcados.', campos);
    const p = premioMock(d.premio_id)!;
    const nuevo: Patrocinio = { id: siguienteId++, ...d, cupon: d.cupon.trim(), acento: d.acento.toUpperCase(), comercio: p.comercio_aliado, logo: p.foto, fondo: p.fondo, activo: true };
    patrocinios.push(nuevo);
    registrar('editar_patrocinio', p.comercio_aliado, `${NOMBRE_TIPO_PATROCINIO[d.tipo]} del ${d.desde} al ${d.hasta}${d.cupon ? ` · ${d.cupon}` : ''}`);
    return copia(nuevo);
  });
}

/** Apaga un patrocinio (lo quita de la app). Los cupones ya ganados siguen valiendo. */
export function apagarPatrocinio(id: number): Promise<void> {
  if (conectado('patrocinios')) return pedir<void>(`/api/v1/admin/patrocinios/${id}`, { metodo: 'PATCH', cuerpo: { activo: false } });
  return simularRed(() => {
    if (!puede('editar_patrocinios')) throw new ErrorPanel('Tu rol no puede cambiar patrocinios.');
    const p = patrocinios.find((x) => x.id === id);
    if (!p) throw new ErrorPanel('Ese patrocinio no existe.', undefined, { estado: 404 });
    p.activo = false;
    registrar('editar_patrocinio', p.comercio, `${NOMBRE_TIPO_PATROCINIO[p.tipo]} del ${p.desde} apagado`);
  });
}

/** Para el comercio: cuántos ganaron su cupón y cuántos lo usaron. */
export function reportePatrocinio(id: number): Promise<ReportePatrocinio> {
  if (conectado('patrocinios')) return pedir<ReportePatrocinio>(`/api/v1/admin/patrocinios/${id}/reporte`);
  return simularRed(() => {
    const p = patrocinios.find((x) => x.id === id);
    if (!p) throw new ErrorPanel('Ese patrocinio no existe.', undefined, { estado: 404 });
    if (p.tipo === 'destacado') return { ganados: 0, usados: 0, vencidos: 0, activos: 0 };
    // Los cupones se dan al cerrar: el martes después de la semana, o el día 9 del mes siguiente.
    const hastaPago = p.tipo === 'semana' ? sumarDias(p.hasta, 3) : sumarDias(p.hasta, 10);
    const de = cuponesMock().filter((c) => c.premio_id === p.premio_id && c.origen === p.tipo && c.fecha_canje.slice(0, 10) > p.hasta && c.fecha_canje.slice(0, 10) <= hastaPago);
    const vencido = (c: (typeof de)[number]) => c.estado === 'expirado' || (c.estado === 'activo' && c.fecha_expiracion_cupon < HOY);
    return {
      ganados: de.length,
      usados: de.filter((c) => c.estado === 'usado').length,
      vencidos: de.filter(vencido).length,
      activos: de.filter((c) => c.estado === 'activo' && !vencido(c)).length,
    };
  });
}
