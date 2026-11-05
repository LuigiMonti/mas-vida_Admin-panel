import { copia, simularRed } from './red';
import { sesionActual } from './sesion';

/**
 * Bitácora de acciones del admin: quién hizo qué y cuándo.
 * Nunca guarda tokens ni datos de salud, solo la acción y a quién afectó.
 * Futuro: la escribe el backend en cada endpoint de /api/v1/admin/; el panel solo la lee.
 */
export type TipoAccion =
  | 'verificar_poliza'
  | 'rechazar_poliza'
  | 'ajuste_puntos'
  | 'ajuste_monedas'
  | 'editar_objetivo'
  | 'correr_cierre'
  | 'editar_reglas';

export interface EntradaBitacora {
  id: number;
  creado_en: string;
  autor: string;
  accion: TipoAccion;
  /** A quién o a qué afectó: un usuario_id, "Semana 45"… */
  objetivo: string;
  detalle: string;
}

const entradas: EntradaBitacora[] = [
  {
    id: 1,
    creado_en: '2026-11-03T09:14:00-06:00',
    autor: 'soporte@masvidaapp.com',
    accion: 'verificar_poliza',
    objetivo: 'u_8f21',
    detalle: 'GT-114-55021 verificada · retroactivo aplicado',
  },
  {
    id: 2,
    creado_en: '2026-11-02T16:40:00-06:00',
    autor: 'admin@masvidaapp.com',
    accion: 'ajuste_puntos',
    objetivo: 'u_51be',
    detalle: '+50 pts · Chequeo médico del demo',
  },
];

let siguienteId = entradas.length + 1;

/** Lo llaman las acciones del mock; en el backend lo hace el servidor. */
export function registrar(accion: TipoAccion, objetivo: string, detalle: string): void {
  entradas.unshift({
    id: siguienteId++,
    creado_en: new Date().toISOString(),
    autor: sesionActual.correo,
    accion,
    objetivo,
    detalle,
  });
}

export function listarBitacora(filtro?: { objetivo?: string }): Promise<EntradaBitacora[]> {
  return simularRed(() => copia(filtro?.objetivo ? entradas.filter((e) => e.objetivo === filtro.objetivo) : entradas));
}
