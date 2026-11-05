import { simularRed } from './red';

/**
 * Lo que muestra el inicio: las métricas rápidas y lo que pide atención.
 * Futuro: GET /api/v1/admin/resumen.
 */
export interface ResumenPanel {
  /** Usuarios que sincronizaron en los últimos 7 días. */
  usuarios_activos: number;
  usuarios_total: number;
  polizas_verificadas: number;
  polizas_pendientes: number;
  pendiente_mas_vieja_dias: number | null;
  /** Última semana cerrada: cuántos cumplieron el objetivo (los dos componentes). */
  objetivo: { semana: number; cumplieron: number; evaluados: number };
  /** Monedas de la season en curso. Las vencidas son las que volvieron a 0 al cerrar la season anterior. */
  monedas: { emitidas: number; vencidas: number; season: string };
  /** El punto ciego: si el programador corrió y si quedaron semanas sin cerrar. */
  cierre: {
    ultima_corrida: string | null;
    ultima_corrida_ok: boolean;
    semanas_pendientes: number;
    proximo: string;
  };
  /** Sin VersionRegla activa el sync responde 500. */
  version_regla_activa: string | null;
}

export function obtenerResumen(): Promise<ResumenPanel> {
  return simularRed({
    usuarios_activos: 84,
    usuarios_total: 100,
    polizas_verificadas: 61,
    polizas_pendientes: 7,
    pendiente_mas_vieja_dias: 3,
    objetivo: { semana: 44, cumplieron: 37, evaluados: 92 },
    monedas: { emitidas: 4310, vencidas: 2875, season: 'Season 4 · 2026' },
    cierre: {
      ultima_corrida: '2026-11-03T00:02:00-06:00',
      ultima_corrida_ok: true,
      semanas_pendientes: 0,
      proximo: 'Martes 10 nov · 00:00',
    },
    version_regla_activa: 'v1.2',
  });
}
