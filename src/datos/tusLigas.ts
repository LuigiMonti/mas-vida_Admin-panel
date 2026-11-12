/*
 * Tus Ligas: liga.LigaAmigos y liga.MiembroLigaAmigos. Moderación.
 * Futuro: /api/v1/admin/tus-ligas/…
 *
 * - Son los grupos que arma cada persona: con o sin póliza, sin premios, se
 *   entra con un código de 6 caracteres. El nombre lo escribe quien lo crea
 *   (hasta 60 caracteres) y lo ven todos sus miembros.
 * - Moderar es cambiar un nombre ofensivo o borrar el grupo. Borrarlo saca a
 *   todos y su código deja de valer; nadie pierde puntos, porque el ranking
 *   sale de los puntos de cada quien y no de la membresía.
 * - Un grupo se borra solo cuando sale su último miembro. Uno sin miembros
 *   solo puede quedar por una baja de cuenta a medias: se borra desde aquí.
 */
import { pedir } from './api';
import { registrar } from './bitacora';
import { cuentasDeMuestra, HOY } from './cuentas';
import { conectado } from './modo';
import { copia, ErrorPanel, simularRed } from './red';
import { puede } from './sesion';
import { sumarDias } from './temporadas';

export const LARGO_MAXIMO_GRUPO = 60;

export interface GrupoLiga {
  id: number;
  nombre: string;
  /** Código de invitación: 6 caracteres, sin O/0 ni I/1. */
  codigo: string;
  /** Quien lo creó. null si esa cuenta se dio de baja. */
  creado_por: { usuario_id: string; nombre: string } | null;
  creado_en: string;
  miembros: number;
}

export interface MiembroGrupo {
  usuario_id: string;
  nombre: string;
  nombre_de_miembro: string | null;
  fecha_union: string;
  /** Puntos del mes en curso: con eso se ordena el grupo en la app. */
  puntos_mes: number;
  es_creador: boolean;
}

/* ================================================================= mock */

interface GrupoMock {
  id: number;
  nombre: string;
  codigo: string;
  creador: string | null;
  creado_en: string;
  miembros: Array<{ usuario_id: string; fecha_union: string }>;
}

const grupo = (id: number, nombre: string, codigo: string, hace: number, ids: string[]): GrupoMock => ({
  id,
  nombre,
  codigo,
  creador: ids[0] ?? null,
  creado_en: `${sumarDias(HOY, -hace)}T19:${String(10 + id * 7).padStart(2, '0')}:00-06:00`,
  miembros: ids.map((usuario_id, i) => ({ usuario_id, fecha_union: sumarDias(HOY, -Math.max(0, hace - i * 2)) })),
});

let grupos: GrupoMock[] = [
  grupo(1, 'Oficina', 'K7QM2X', 38, ['u_8f21', 'u_51be', 'u_4b6c', 'u_3a90', 'u_c7d4', 'u_6c40']),
  grupo(2, 'Los Runners GT', 'R4WZ8N', 31, ['u_4b6c', 'u_8f21', 'u_d118', 'u_e5d9']),
  grupo(3, 'Familia Castillo', 'F9HC3T', 24, ['u_8f21', 'u_b2f8', 'u_9e02']),
  // Un nombre para moderar (placeholder del demo).
  grupo(4, '(Ejemplo) un nombre que no puede quedarse', 'D6PLY5', 9, ['u_7f3a', 'u_6c40']),
  grupo(5, 'Gym 6am', 'G2VXA8', 5, ['u_51be']),
  // Quedó sin miembros: su creador se dio de baja.
  grupo(6, 'Prueba', 'P8TJQ4', 40, []),
];

function validarNombreDeGrupo(nombre: string): string | null {
  const n = nombre.trim();
  if (!n) return 'El grupo necesita un nombre.';
  if (n.length > LARGO_MAXIMO_GRUPO) return `Máximo ${LARGO_MAXIMO_GRUPO} caracteres.`;
  return null;
}

export { validarNombreDeGrupo };

function aPublico(g: GrupoMock): GrupoLiga {
  const creador = g.creador ? cuentasDeMuestra().find((c) => c.usuario_id === g.creador && !c.dado_de_baja) : undefined;
  return { id: g.id, nombre: g.nombre, codigo: g.codigo, creado_por: creador ? { usuario_id: creador.usuario_id, nombre: creador.nombre } : null, creado_en: g.creado_en, miembros: g.miembros.length };
}

function buscar(id: number): GrupoMock {
  const g = grupos.find((x) => x.id === id);
  if (!g) throw new ErrorPanel('Ese grupo ya no existe.', undefined, { estado: 404 });
  return g;
}

function exigirMotivo(motivo: string): string {
  const m = motivo.trim();
  if (m.length < 5) throw new ErrorPanel('Falta el motivo.', { motivo: 'Escribe el motivo: queda en la bitácora.' });
  return m;
}

/* ================================================================= API */

/** Los grupos de Tus Ligas, el más nuevo primero. Busca por nombre, código o `usuario_id` de un miembro. */
export function listarGrupos(filtro: { q?: string } = {}): Promise<GrupoLiga[]> {
  if (conectado('tus_ligas')) return pedir<GrupoLiga[]>('/api/v1/admin/tus-ligas', { query: { q: filtro.q } });
  return simularRed(() => {
    const q = (filtro.q ?? '').trim().toLowerCase();
    return copia(
      grupos
        .filter((g) => !q || g.nombre.toLowerCase().includes(q) || g.codigo.toLowerCase() === q || g.miembros.some((m) => m.usuario_id.toLowerCase() === q))
        .sort((a, b) => b.creado_en.localeCompare(a.creado_en))
        .map(aPublico),
    );
  });
}

export function listarMiembros(id: number): Promise<MiembroGrupo[]> {
  if (conectado('tus_ligas')) return pedir<MiembroGrupo[]>(`/api/v1/admin/tus-ligas/${id}/miembros`);
  return simularRed(() => {
    const g = buscar(id);
    const cuentas = cuentasDeMuestra();
    return g.miembros
      .map((m, i) => {
        const c = cuentas.find((x) => x.usuario_id === m.usuario_id);
        return {
          usuario_id: m.usuario_id,
          nombre: c?.nombre ?? m.usuario_id,
          nombre_de_miembro: c?.nombre_de_miembro ?? null,
          fecha_union: m.fecha_union,
          puntos_mes: 1480 - ((i * 337 + g.id * 91) % 1200),
          es_creador: m.usuario_id === g.creador,
        };
      })
      .sort((a, b) => b.puntos_mes - a.puntos_mes);
  }, 250);
}

/** Cambia un nombre que no puede quedarse. Los miembros ven el nuevo en la app. */
export function renombrarGrupo(id: number, nombre: string, motivo: string): Promise<GrupoLiga> {
  if (conectado('tus_ligas')) return pedir<GrupoLiga>(`/api/v1/admin/tus-ligas/${id}`, { metodo: 'PATCH', cuerpo: { nombre, motivo } });
  return simularRed(() => {
    if (!puede('moderar_ligas')) throw new ErrorPanel('Tu rol no puede moderar Tus Ligas.');
    const g = buscar(id);
    const error = validarNombreDeGrupo(nombre);
    if (error) throw new ErrorPanel('Revisa el nombre.', { nombre: error });
    if (nombre.trim() === g.nombre) throw new ErrorPanel('Revisa el nombre.', { nombre: 'Es el mismo nombre que ya tiene.' });
    const m = exigirMotivo(motivo);
    const antes = g.nombre;
    g.nombre = nombre.trim();
    registrar('moderar_liga', `Grupo ${g.codigo}`, `Nombre: «${antes}» → «${g.nombre}» · ${m}`);
    return copia(aPublico(g));
  }, 500);
}

/** Borra el grupo: saca a todos y su código deja de valer. No se deshace. */
export function borrarGrupo(id: number, motivo: string): Promise<void> {
  if (conectado('tus_ligas')) return pedir<void>(`/api/v1/admin/tus-ligas/${id}`, { metodo: 'DELETE', cuerpo: { motivo } });
  return simularRed(() => {
    if (!puede('moderar_ligas')) throw new ErrorPanel('Tu rol no puede moderar Tus Ligas.');
    const g = buscar(id);
    const m = exigirMotivo(motivo);
    grupos = grupos.filter((x) => x.id !== id);
    registrar('moderar_liga', `Grupo ${g.codigo}`, `«${g.nombre}» borrado (${g.miembros.length} miembros) · ${m}`);
  }, 500);
}
