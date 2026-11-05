/*
 * Base de la capa de datos del panel.
 *
 * HOY: cada tema (premios, objetivos, liga, pólizas…) tiene su archivo en
 * src/datos/ con los tipos (copiados de los modelos de Django) y un mock en
 * memoria. Los cambios viven mientras la pestaña está abierta: al recargar,
 * vuelven los datos de muestra.
 *
 * DESPUÉS: cada función del mock se reemplaza por la llamada a
 * /api/v1/admin/… con la misma firma, y las pantallas no se tocan.
 */

/** Error que el panel le muestra a la persona, con el texto ya listo. */
export class ErrorPanel extends Error {
  /** Errores por campo, como los devuelve DRF: { costo_monedas: "…" }. */
  campos?: Record<string, string>;

  constructor(mensaje: string, campos?: Record<string, string>) {
    super(mensaje);
    this.name = 'ErrorPanel';
    this.campos = campos;
  }
}

/** Simula la espera de la red, para que los estados de carga se vean. */
export function simularRed<T>(valor: T | (() => T), ms = 350): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(() => {
      try {
        resolve(typeof valor === 'function' ? (valor as () => T)() : valor);
      } catch (e) {
        reject(e);
      }
    }, ms);
  });
}

/** Copia profunda: el mock nunca entrega su propio objeto (como una API). */
export function copia<T>(v: T): T {
  return structuredClone(v);
}

/** Quien hace los cambios. Sale del login cuando exista. */
export const ADMIN_ACTUAL = 'admin@masvidaapp.com';

/** Hoy, en hora de Guatemala, como "AAAA-MM-DD". */
export function hoyGT(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date());
}
