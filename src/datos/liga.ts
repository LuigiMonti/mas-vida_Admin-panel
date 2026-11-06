/*
 * La Liga: liga.LigaMensual, liga.PremioPodioLiga y liga.DesgloseLigaMensual.
 * Futuro: /api/v1/admin/liga/…
 *
 * - Un solo grupo con todos los que tienen póliza verificada; ciclo mensual;
 *   compite por puntos del mes; desempata por pasos y después por workouts.
 * - El mes se cierra el día 2 (tabla final) y el podio se paga el día 9.
 * - Las monedas del podio se fijan al cerrar: cambiar los montos vale para
 *   los meses que todavía no se cierran.
 * - `nombre` por mes ("Liga Nike") NO existe en LigaMensual: ver
 *   PENDIENTES_BACKEND.md. Vacío = "La Liga".
 */
import { pedir } from './api';
import { registrar } from './bitacora';
import { conectado } from './modo';
import { patrocinioDeLigaMock, sumarDias, ultimoDelMes, type Patrocinio } from './patrocinios';
import { copia, ErrorPanel, hoyGT, simularRed } from './red';
import { puede } from './sesion';

export type EstadoMes = 'futuro' | 'en_curso' | 'por_cerrar' | 'cerrado' | 'pagado';

export interface MesLiga {
  /** Día 1 del mes: "2026-11-01". */
  mes: string;
  nombre: string;
  estado: EstadoMes;
  total_participantes: number | null;
  /** Cuándo se cierra (día 2) y cuándo se paga (día 9) del mes siguiente. */
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
  puntos_mes: number;
  pasos_acumulados_mes: number;
  workouts_acumulados_mes: number;
  monedas: number;
}

export const NOMBRE_ESTADO_MES: Record<EstadoMes, string> = {
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

interface MesMock {
  mes: string;
  nombre: string;
  total_participantes: number | null;
  cerrada_en: string | null;
  pagada_en: string | null;
  podio_fijado: [number, number, number] | null;
}

const meses: MesMock[] = [];
(function sembrar() {
  let mes = '2026-09-01';
  for (let i = 0; i < 6; i++) {
    const fin = ultimoDelMes(mes);
    const cierre = sumarDias(fin, 2);
    const pago = sumarDias(fin, 9);
    meses.push({
      mes,
      nombre: mes === '2026-09-01' ? 'Liga Smart Fit' : mes === '2026-11-01' ? 'Liga Sportcity' : '',
      total_participantes: cierre <= HOY ? 48 + i * 13 : null,
      cerrada_en: cierre <= HOY ? cierre : null,
      pagada_en: pago <= HOY ? pago : null,
      podio_fijado: cierre <= HOY ? [30, 20, 10] : null,
    });
    mes = sumarDias(fin, 1);
  }
})();

function estadoDe(m: MesMock): EstadoMes {
  const fin = ultimoDelMes(m.mes);
  if (m.pagada_en) return 'pagado';
  if (m.cerrada_en) return 'cerrado';
  if (m.mes > HOY) return 'futuro';
  if (HOY <= fin) return 'en_curso';
  return 'por_cerrar';
}

function aPublico(m: MesMock): MesLiga {
  const fin = ultimoDelMes(m.mes);
  const pat = patrocinioDeLigaMock(m.mes);
  return {
    mes: m.mes,
    nombre: m.nombre,
    estado: estadoDe(m),
    total_participantes: m.total_participantes,
    cierre: sumarDias(fin, 2),
    pago: sumarDias(fin, 9),
    cerrada_en: m.cerrada_en,
    pagada_en: m.pagada_en,
    podio: m.podio_fijado ?? podioActual,
    patrocinio: pat ? { comercio: pat.comercio, cupon: pat.cupon, logo: pat.logo, fondo: pat.fondo, acento: pat.acento } : null,
  };
}

const NOMBRES = ['Andrea Castillo', 'Ricardo Monzón', 'Sofía Ramírez', 'Carlos Méndez', 'Ana Gálvez', 'Gabriela Soto', 'José Luis Pérez', 'Marco Villagrán', 'Lucía Herrera', 'Diego López', 'Paola Reyes', 'Javier Morales', 'Fernanda Cruz', 'Luis Ortiz', 'Daniela Paz'];
const IDS = ['u_8f21', 'u_51be', 'u_4b6c', 'u_d118', 'u_e5d9', 'u_b2f8', 'u_3a90', 'u_6c40', 'u_9e02', 'u_7f3a', 'u_a301', 'u_a302', 'u_a303', 'u_a304', 'u_a305'];

function tablaMock(m: MesMock): FilaTabla[] {
  let h = [...m.mes].reduce((a, c) => (a * 31 + c.charCodeAt(0)) | 0, 7);
  const r = () => ((h = (Math.imul(h ^ (h >>> 15), 2246822507) ^ 0x9e3779b9) | 0) >>> 0) / 4294967296;
  const enCurso = estadoDe(m) === 'en_curso';
  const diasJugados = enCurso ? Number(HOY.slice(8, 10)) : Number(ultimoDelMes(m.mes).slice(8, 10));
  const filas = NOMBRES.map((nombre, i) => {
    const ritmo = 40 + r() * 110;
    return {
      usuario_id: IDS[i]!,
      nombre,
      puntos_mes: Math.round(ritmo * diasJugados),
      pasos_acumulados_mes: Math.round((5000 + r() * 9000) * diasJugados),
      workouts_acumulados_mes: Math.round(r() * diasJugados * 0.5),
    };
  });
  // Un empate de puntos para que se vea el desempate por pasos.
  filas[2]!.puntos_mes = filas[1]!.puntos_mes;
  filas.sort((a, b) => b.puntos_mes - a.puntos_mes || b.pasos_acumulados_mes - a.pasos_acumulados_mes || b.workouts_acumulados_mes - a.workouts_acumulados_mes);
  const podio = m.podio_fijado ?? podioActual;
  return filas.map((f, i) => ({ ...f, posicion: i + 1, monedas: i < 3 ? podio[i]! : 0 }));
}

function buscar(mes: string): MesMock {
  const m = meses.find((x) => x.mes === mes);
  if (!m) throw new ErrorPanel('Ese mes de La Liga no existe.', undefined, { estado: 404 });
  return m;
}

/* ================================================================= API */

export function listarMeses(): Promise<MesLiga[]> {
  if (conectado('liga')) return pedir<MesLiga[]>('/api/v1/admin/liga/meses');
  return simularRed(() => copia([...meses].reverse().map(aPublico)));
}

/** La tabla del mes: la final si ya cerró, la provisional si está en curso. */
export function obtenerTabla(mes: string): Promise<FilaTabla[]> {
  if (conectado('liga')) return pedir<FilaTabla[]>(`/api/v1/admin/liga/meses/${mes}/tabla`);
  return simularRed(() => {
    const m = buscar(mes);
    return estadoDe(m) === 'futuro' ? [] : tablaMock(m);
  });
}

export function validarNombre(nombre: string): string | null {
  const n = nombre.trim();
  if (n.length > LARGO_MAXIMO_NOMBRE) return `Máximo ${LARGO_MAXIMO_NOMBRE} caracteres: tiene que caber en el banner de la app.`;
  if (/[<>{}]/.test(n)) return 'Sin símbolos raros.';
  return null;
}

/** Cambia el nombre de un mes que todavía no se cierra. Vacío = "La Liga". */
export function renombrarMes(mes: string, nombre: string): Promise<MesLiga> {
  if (conectado('liga')) return pedir<MesLiga>(`/api/v1/admin/liga/meses/${mes}`, { metodo: 'PATCH', cuerpo: { nombre } });
  return simularRed(() => {
    if (!puede('editar_liga')) throw new ErrorPanel('Tu rol no puede cambiar La Liga.');
    const m = buscar(mes);
    if (m.cerrada_en) throw new ErrorPanel('No se puede cambiar: ese mes ya se cerró.');
    const error = validarNombre(nombre);
    if (error) throw new ErrorPanel('Revisa el nombre.', { nombre: error });
    const antes = m.nombre || 'La Liga';
    m.nombre = nombre.trim();
    registrar('editar_liga', `La Liga · ${mes.slice(0, 7)}`, `Nombre: «${antes}» → «${m.nombre || 'La Liga'}»`);
    return copia(aPublico(m));
  });
}

export function obtenerPodio(): Promise<[number, number, number]> {
  if (conectado('liga')) return pedir<[number, number, number]>('/api/v1/admin/liga/podio');
  return simularRed(() => [...podioActual] as [number, number, number], 200);
}

/** PremioPodioLiga: monedas de 1.º, 2.º y 3.º. Vale para los meses que no se cerraron. */
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
