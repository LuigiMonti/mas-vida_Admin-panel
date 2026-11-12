/*
 * Comercios aliados: la ficha de cada marca (contacto, contrato y cuota).
 * Futuro: /api/v1/admin/comercios/… con un modelo nuevo `Comercio`.
 *
 * Hoy el comercio es solo un texto en el premio (`Premio.comercio_aliado`).
 * La ficha junta lo que el equipo necesita para hablar con la marca: a quién
 * llamar, hasta cuándo va el contrato y cuánto paga al mes. Es interna: la
 * app nunca la ve.
 */
import { pedir } from './api';
import { registrar } from './bitacora';
import { conectado } from './modo';
import { patrociniosVigentesMock } from './patrocinios';
import { premiosMock } from './premios';
import { copia, ErrorPanel, hoyGT, simularRed } from './red';
import { puede } from './sesion';
import { diasEntre } from './temporadas';

export interface DatosComercio {
  contacto_nombre: string;
  contacto_telefono: string;
  contacto_correo: string;
  contrato_desde: string | null;
  contrato_hasta: string | null;
  /** Quetzales al mes, como texto con dos decimales ("1500.00"): es dinero. null = sin cuota. */
  cuota_mensual_gtq: string | null;
  notas: string;
}

export type EstadoContrato = 'sin_contrato' | 'por_empezar' | 'vigente' | 'por_vencer' | 'vencido';

export const NOMBRE_ESTADO_CONTRATO: Record<EstadoContrato, string> = {
  sin_contrato: 'Sin contrato',
  por_empezar: 'Por empezar',
  vigente: 'Vigente',
  por_vencer: 'Vence pronto',
  vencido: 'Vencido',
};

export interface Comercio extends DatosComercio {
  id: number;
  /** El mismo texto que `Premio.comercio_aliado`. */
  nombre: string;
  logo: string;
  fondo: string;
  premios: number;
  premios_activos: number;
  /** Patrocinios encendidos que no han terminado (semanas, La Liga y destacados). */
  patrocinios_vigentes: number;
  estado_contrato: EstadoContrato;
}

const HOY = hoyGT();
/** Con menos de 30 días por delante, el contrato "vence pronto". */
const DIAS_DE_AVISO = 30;

export function estadoDelContrato(d: Pick<DatosComercio, 'contrato_desde' | 'contrato_hasta'>, hoy = HOY): EstadoContrato {
  if (!d.contrato_desde) return 'sin_contrato';
  if (d.contrato_desde > hoy) return 'por_empezar';
  if (!d.contrato_hasta) return 'vigente';
  if (d.contrato_hasta < hoy) return 'vencido';
  return diasEntre(hoy, d.contrato_hasta) <= DIAS_DE_AVISO ? 'por_vencer' : 'vigente';
}

/* ================================================================= mock */

const VACIO: DatosComercio = { contacto_nombre: '', contacto_telefono: '', contacto_correo: '', contrato_desde: null, contrato_hasta: null, cuota_mensual_gtq: null, notas: '' };

// Datos de ejemplo: ninguna alianza está cerrada (los define Diego).
const fichas = new Map<string, DatosComercio>([
  ['Ookii', { contacto_nombre: 'Persona de contacto', contacto_telefono: '5555 0101', contacto_correo: 'alianzas@ookii.example', contrato_desde: '2026-09-15', contrato_hasta: '2027-03-14', cuota_mensual_gtq: '1500.00', notas: 'Dos semanas patrocinadas en la temporada 4.' }],
  ['Smart Fit', { contacto_nombre: 'Persona de contacto', contacto_telefono: '5555 0102', contacto_correo: 'marketing@smartfit.example', contrato_desde: '2026-09-01', contrato_hasta: '2026-11-30', cuota_mensual_gtq: '2500.00', notas: 'Renovación en conversación.' }],
  ['Sportcity', { contacto_nombre: 'Persona de contacto', contacto_telefono: '5555 0103', contacto_correo: 'patrocinios@sportcity.example', contrato_desde: '2026-11-01', contrato_hasta: '2027-01-31', cuota_mensual_gtq: '3000.00', notas: 'La Liga de la temporada 4.' }],
  ['El Cafecito', { contacto_nombre: 'Persona de contacto', contacto_telefono: '5555 0104', contacto_correo: '', contrato_desde: '2026-08-01', contrato_hasta: '2026-10-31', cuota_mensual_gtq: null, notas: 'Canje sin cuota: solo el beneficio.' }],
]);

function armar(): Comercio[] {
  const porNombre = new Map<string, { id: number; logo: string; fondo: string; premios: number; activos: number }>();
  for (const p of premiosMock()) {
    const c = porNombre.get(p.comercio_aliado) ?? { id: p.id, logo: p.foto, fondo: p.fondo, premios: 0, activos: 0 };
    c.premios++;
    if (p.activo) c.activos++;
    porNombre.set(p.comercio_aliado, c);
  }
  return [...porNombre.entries()].map(([nombre, c]) => {
    const d = fichas.get(nombre) ?? VACIO;
    return { id: c.id, nombre, logo: c.logo, fondo: c.fondo, premios: c.premios, premios_activos: c.activos, patrocinios_vigentes: patrociniosVigentesMock(nombre), estado_contrato: estadoDelContrato(d), ...d };
  });
}

const CORREO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/** Exportado para los tests. */
export function validarComercio(d: DatosComercio): Record<string, string> {
  const e: Record<string, string> = {};
  if (d.contacto_correo && !CORREO.test(d.contacto_correo.trim())) e.contacto_correo = 'Ese correo no está bien escrito.';
  if (d.contacto_telefono && !/^[\d\s+()-]{8,20}$/.test(d.contacto_telefono.trim())) e.contacto_telefono = 'Solo números, de 8 a 20 caracteres.';
  if (d.contrato_hasta && !d.contrato_desde) e.contrato_desde = 'Falta desde cuándo va el contrato.';
  if (d.contrato_desde && d.contrato_hasta && d.contrato_hasta < d.contrato_desde) e.contrato_hasta = 'Tiene que ser el mismo día o después de «desde».';
  if (d.cuota_mensual_gtq !== null && !/^\d{1,7}(\.\d{1,2})?$/.test(d.cuota_mensual_gtq)) e.cuota_mensual_gtq = 'Un monto en quetzales, 0 o más (por ejemplo 1500.00).';
  if (d.notas.length > 500) e.notas = 'Máximo 500 caracteres.';
  return e;
}

/* ================================================================= API */

export function listarComercios(filtro: { q?: string } = {}): Promise<Comercio[]> {
  if (conectado('comercios')) return pedir<Comercio[]>('/api/v1/admin/comercios', { query: { q: filtro.q } });
  return simularRed(() => {
    const q = (filtro.q ?? '').trim().toLowerCase();
    return copia(
      armar()
        .filter((c) => !q || c.nombre.toLowerCase().includes(q) || c.contacto_nombre.toLowerCase().includes(q))
        .sort((a, b) => a.nombre.localeCompare(b.nombre, 'es')),
    );
  });
}

/** Guarda la ficha del comercio. El nombre y el logo se cambian en sus premios. */
export function guardarComercio(id: number, d: DatosComercio): Promise<Comercio> {
  if (conectado('comercios')) return pedir<Comercio>(`/api/v1/admin/comercios/${id}`, { metodo: 'PUT', cuerpo: d });
  return simularRed(() => {
    if (!puede('editar_comercios')) throw new ErrorPanel('Tu rol no puede cambiar la ficha de un comercio.');
    const c = armar().find((x) => x.id === id);
    if (!c) throw new ErrorPanel('Ese comercio no existe.', undefined, { estado: 404 });
    const campos = validarComercio(d);
    if (Object.keys(campos).length) throw new ErrorPanel('Revisa los campos marcados.', campos);
    const limpio: DatosComercio = {
      contacto_nombre: d.contacto_nombre.trim(),
      contacto_telefono: d.contacto_telefono.trim(),
      contacto_correo: d.contacto_correo.trim(),
      contrato_desde: d.contrato_desde || null,
      contrato_hasta: d.contrato_hasta || null,
      cuota_mensual_gtq: d.cuota_mensual_gtq === null ? null : Number(d.cuota_mensual_gtq).toFixed(2),
      notas: d.notas.trim(),
    };
    fichas.set(c.nombre, limpio);
    // En la bitácora va qué cambió, no los datos de contacto.
    registrar('editar_comercio', c.nombre, `Ficha actualizada · contrato ${NOMBRE_ESTADO_CONTRATO[estadoDelContrato(limpio)].toLowerCase()}${limpio.cuota_mensual_gtq ? ` · Q${limpio.cuota_mensual_gtq} al mes` : ''}`);
    return copia(armar().find((x) => x.id === id)!);
  }, 500);
}
