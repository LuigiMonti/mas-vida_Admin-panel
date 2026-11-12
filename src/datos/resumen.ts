import { contarBloqueadosDeMuestra, contarParaRevisarDeMuestra } from './antifraude';
import { ultimaCorrida } from './cierres';
import { contarSemanasPendientes } from './objetivos';
import { pedir } from './api';
import { conectado } from './modo';
import { hoyGT, simularRed } from './red';
import { sumarDias } from './temporadas';

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
  /** Antifraude: cuentas con algo que revisar y límites de intentos bloqueados ahora. */
  antifraude: { para_revisar: number; bloqueados: number };
}

/** El próximo martes 00:00 (hora de Guatemala), como lo escribe el panel. */
function proximoCierre(): string {
  let f = sumarDias(hoyGT(), 1);
  while (new Date(`${f}T12:00:00Z`).getUTCDay() !== 2) f = sumarDias(f, 1);
  const t = new Intl.DateTimeFormat('es-GT', { timeZone: 'UTC', day: 'numeric', month: 'short' }).format(new Date(`${f}T12:00:00Z`)).replace('.', '');
  return `Martes ${t} · 00:00`;
}

export function obtenerResumen(): Promise<ResumenPanel> {
  if (conectado('resumen')) return pedir<ResumenPanel>('/api/v1/admin/resumen');
  return simularRed(() => {
    // El estado del cierre sale del mismo mock que la pantalla de cierres.
    const ultima = ultimaCorrida();
    return {
      usuarios_activos: 84,
      usuarios_total: 100,
      polizas_verificadas: 61,
      polizas_pendientes: 7,
      pendiente_mas_vieja_dias: 3,
      objetivo: { semana: 44, cumplieron: 37, evaluados: 92 },
      monedas: { emitidas: 4310, vencidas: 2875, season: 'Season 4 · 2026' },
      cierre: {
        ultima_corrida: ultima?.empezo ?? null,
        ultima_corrida_ok: ultima?.estado !== 'fallo',
        semanas_pendientes: contarSemanasPendientes(),
        proximo: proximoCierre(),
      },
      version_regla_activa: 'v3',
      antifraude: { para_revisar: contarParaRevisarDeMuestra(), bloqueados: contarBloqueadosDeMuestra() },
    };
  });
}
