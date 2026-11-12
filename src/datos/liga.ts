/*
 * La Liga: liga.LigaMensual, liga.PremioPodioLiga y liga.DesgloseLigaMensual.
 * Futuro: /api/v1/admin/liga/…
 *
 * - Un solo grupo con todos los que tienen póliza verificada. Compite por
 *   puntos del ciclo; desempata por pasos y después por workouts.
 * - El ciclo es una TEMPORADA (8 nov 2026): las 13 semanas de la season.
 *   Octubre de 2026 fue el último ciclo mensual y la primera temporada cuenta
 *   desde el 1 nov 2026 (ver temporadas.ts). `LigaMensual.mes` guarda el
 *   primer día del ciclo: aquí es `inicio`.
 * - Se cierra el martes de la temporada nueva (tabla final) y el podio se
 *   paga el martes siguiente.
 * - Las monedas del podio se fijan al cerrar: cambiar los montos vale para
 *   los ciclos que todavía no se cierran.
 * - `nombre` por ciclo ("Liga Nike") NO existe en LigaMensual: ver
 *   PENDIENTES_BACKEND.md. Vacío = "La Liga".
 */
import { pedir } from './api';
import { registrar } from './bitacora';
import { conectado } from './modo';
import { patrocinioDeLigaMock, type Patrocinio } from './patrocinios';
import { copia, ErrorPanel, hoyGT, simularRed } from './red';
import { puede } from './sesion';
import { ciclosDeLiga, diasEntre, nombreCiclo, PRIMER_CICLO_LIGA, type TipoCiclo } from './temporadas';

export type EstadoCiclo = 'futuro' | 'en_curso' | 'por_cerrar' | 'cerrado' | 'pagado';

export interface CicloDeLiga {
  /** Primer día del ciclo ("2026-11-01"): lo identifica. */
  inicio: string;
  fin: string;
  ciclo: TipoCiclo;
  nombre: string;
  estado: EstadoCiclo;
  total_participantes: number | null;
  /** Desde qué día se cierra y desde cuál se paga el podio. */
  cierre: string;
  pago: string;
  cerrada_en: string | null;
  pagada_en: string | null;
  /** Monedas del podio: las fijadas al cerrar, o las de ahora si no se cerró. */
  podio: [number, number, number];
  patrocinio: Pick<Patrocinio, 'comercio' | 'cupon' | 'logo' | 'fondo' | 'acento'> | null;
}

export interface FilaTabla {
  posicion: number;
  usuario_id: string;
  nombre: string;
  /** Como se ve en la app ("ana.lopez"). null si todavía no lo eligió. */
  nombre_de_miembro: string | null;
  puntos: number;
  /** Desempates. En la app nunca se muestran. */
  pasos: number;
  workouts: number;
  monedas: number;
}

export const NOMBRE_ESTADO_CICLO: Record<EstadoCiclo, string> = {
  futuro: 'Por venir',
  en_curso: 'En curso',
  por_cerrar: 'Por cerrar',
  cerrado: 'Por pagar',
  pagado: 'Pagado',
};

export const LARGO_MAXIMO_NOMBRE = 40;

/* ================================================================= mock */

const HOY = hoyGT();

let podioActual: [number, number, number] = [30, 20, 10];

interface CicloMock {
  inicio: string;
  fin: string;
  ciclo: TipoCiclo;
  cierre: string;
  pago: string;
  nombre: string;
  total_participantes: number | null;
  cerrada_en: string | null;
  pagada_en: string | null;
  podio_fijado: [number, number, number] | null;
}

// Octubre de 2026 (el último mes), la temporada en curso y las dos que siguen.
const NOMBRES_DE_MUESTRA: Record<string, string> = { '2026-10-01': 'Liga Smart Fit', '2026-11-01': 'Liga Sportcity' };
const ciclos: CicloMock[] = ciclosDeLiga(PRIMER_CICLO_LIGA, 4).map((c, i) => ({
  ...c,
  nombre: NOMBRES_DE_MUESTRA[c.inicio] ?? '',
  total_participantes: c.cierre <= HOY ? 61 + i * 13 : null,
  cerrada_en: c.cierre <= HOY ? c.cierre : null,
  pagada_en: c.pago <= HOY ? c.pago : null,
  podio_fijado: c.cierre <= HOY ? [30, 20, 10] : null,
}));

function estadoDe(c: CicloMock): EstadoCiclo {
  if (c.pagada_en) return 'pagado';
  if (c.cerrada_en) return 'cerrado';
  if (c.inicio > HOY) return 'futuro';
  if (HOY <= c.fin) return 'en_curso';
  return 'por_cerrar';
}

function aPublico(c: CicloMock): CicloDeLiga {
  const pat = patrocinioDeLigaMock(c.inicio);
  return {
    inicio: c.inicio,
    fin: c.fin,
    ciclo: c.ciclo,
    nombre: c.nombre,
    estado: estadoDe(c),
    total_participantes: c.total_participantes,
    cierre: c.cierre,
    pago: c.pago,
    cerrada_en: c.cerrada_en,
    pagada_en: c.pagada_en,
    podio: c.podio_fijado ?? podioActual,
    patrocinio: pat ? { comercio: pat.comercio, cupon: pat.cupon, logo: pat.logo, fondo: pat.fondo, acento: pat.acento } : null,
  };
}

const NOMBRES = ['Andrea Castillo', 'Ricardo Monzón', 'Sofía Ramírez', 'Carlos Méndez', 'Ana Gálvez', 'Gabriela Soto', 'José Luis Pérez', 'Marco Villagrán', 'Lucía Herrera', 'Diego López', 'Paola Reyes', 'Javier Morales', 'Fernanda Cruz', 'Luis Ortiz', 'Daniela Paz'];
const IDS = ['u_8f21', 'u_51be', 'u_4b6c', 'u_d118', 'u_e5d9', 'u_b2f8', 'u_3a90', 'u_6c40', 'u_9e02', 'u_7f3a', 'u_a301', 'u_a302', 'u_a303', 'u_a304', 'u_a305'];
// Diego López (u_7f3a) todavía no elige su nombre de miembro: sale como en la app vieja.
const miembro = (nombre: string, id: string) =>
  id === 'u_7f3a' ? null : nombre.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().split(/\s+/).filter((_, i, a) => i === 0 || i === a.length - 1).join('.');

function tablaMock(c: CicloMock): FilaTabla[] {
  let h = [...c.inicio].reduce((a, x) => (a * 31 + x.charCodeAt(0)) | 0, 7);
  const r = () => ((h = (Math.imul(h ^ (h >>> 15), 2246822507) ^ 0x9e3779b9) | 0) >>> 0) / 4294967296;
  const hasta = estadoDe(c) === 'en_curso' ? HOY : c.fin;
  const diasJugados = diasEntre(c.inicio, hasta) + 1;
  const filas = NOMBRES.map((nombre, i) => {
    const ritmo = 40 + r() * 110;
    return {
      usuario_id: IDS[i]!,
      nombre,
      nombre_de_miembro: miembro(nombre, IDS[i]!),
      puntos: Math.round(ritmo * diasJugados),
      pasos: Math.round((5000 + r() * 9000) * diasJugados),
      workouts: Math.round(r() * diasJugados * 0.5),
    };
  });
  // Un empate de puntos para que se vea el desempate por pasos.
  filas[2]!.puntos = filas[1]!.puntos;
  filas.sort((a, b) => b.puntos - a.puntos || b.pasos - a.pasos || b.workouts - a.workouts);
  const podio = c.podio_fijado ?? podioActual;
  return filas.map((f, i) => ({ ...f, posicion: i + 1, monedas: i < 3 ? podio[i]! : 0 }));
}

function buscar(inicio: string): CicloMock {
  const c = ciclos.find((x) => x.inicio === inicio);
  if (!c) throw new ErrorPanel('Ese ciclo de La Liga no existe.', undefined, { estado: 404 });
  return c;
}

/* ================================================================= API */

/** Los ciclos de La Liga, el más nuevo primero. */
export function listarCiclos(): Promise<CicloDeLiga[]> {
  if (conectado('liga')) return pedir<CicloDeLiga[]>('/api/v1/admin/liga/ciclos');
  return simularRed(() => copia([...ciclos].reverse().map(aPublico)));
}

/** La tabla del ciclo: la final si ya cerró, la provisional si está en curso. */
export function obtenerTabla(inicio: string): Promise<FilaTabla[]> {
  if (conectado('liga')) return pedir<FilaTabla[]>(`/api/v1/admin/liga/ciclos/${inicio}/tabla`);
  return simularRed(() => {
    const c = buscar(inicio);
    return estadoDe(c) === 'futuro' ? [] : tablaMock(c);
  });
}

export function validarNombre(nombre: string): string | null {
  const n = nombre.trim();
  if (n.length > LARGO_MAXIMO_NOMBRE) return `Máximo ${LARGO_MAXIMO_NOMBRE} caracteres: tiene que caber en el banner de la app.`;
  if (/[<>{}]/.test(n)) return 'Sin símbolos raros.';
  return null;
}

/** Cambia el nombre de un ciclo que todavía no se cierra. Vacío = "La Liga". */
export function renombrarCiclo(inicio: string, nombre: string): Promise<CicloDeLiga> {
  if (conectado('liga')) return pedir<CicloDeLiga>(`/api/v1/admin/liga/ciclos/${inicio}`, { metodo: 'PATCH', cuerpo: { nombre } });
  return simularRed(() => {
    if (!puede('editar_liga')) throw new ErrorPanel('Tu rol no puede cambiar La Liga.');
    const c = buscar(inicio);
    if (c.cerrada_en) throw new ErrorPanel('No se puede cambiar: ese ciclo ya se cerró.');
    const error = validarNombre(nombre);
    if (error) throw new ErrorPanel('Revisa el nombre.', { nombre: error });
    const antes = c.nombre || 'La Liga';
    c.nombre = nombre.trim();
    registrar('editar_liga', `La Liga · ${nombreCiclo(c)}`, `Nombre: «${antes}» → «${c.nombre || 'La Liga'}»`);
    return copia(aPublico(c));
  });
}

export function obtenerPodio(): Promise<[number, number, number]> {
  if (conectado('liga')) return pedir<[number, number, number]>('/api/v1/admin/liga/podio');
  return simularRed(() => [...podioActual] as [number, number, number], 200);
}

/** PremioPodioLiga: monedas de 1.º, 2.º y 3.º. Vale para los ciclos que no se cerraron. */
export function guardarPodio(podio: [number, number, number]): Promise<void> {
  if (conectado('liga')) return pedir<void>('/api/v1/admin/liga/podio', { metodo: 'PUT', cuerpo: podio.map((monedas, i) => ({ puesto: i + 1, monedas })) });
  return simularRed(() => {
    if (!puede('editar_liga')) throw new ErrorPanel('Tu rol no puede cambiar La Liga.');
    const campos: Record<string, string> = {};
    podio.forEach((m, i) => {
      if (!Number.isInteger(m) || m < 0) campos[`puesto_${i + 1}`] = 'Un entero, 0 o más.';
    });
    if (Object.keys(campos).length) throw new ErrorPanel('Revisa los montos.', campos);
    const antes = podioActual.join(' / ');
    podioActual = [...podio];
    registrar('editar_liga', 'Podio de La Liga', `${antes} → ${podio.join(' / ')} monedas`);
  });
}
