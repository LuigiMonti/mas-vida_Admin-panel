/*
 * Base de la capa de datos del panel.
 *
 * Cada tema (cuentas, objetivos, reglas, cierres…) tiene su archivo en
 * src/datos/. Cada función decide de dónde lee con `conectado()`
 * (src/datos/modo.ts):
 *   - mock: datos de muestra en memoria. Al recargar, vuelven los de muestra.
 *   - api: llama a /api/v1/admin/… con el cliente de src/datos/api.ts.
 * Las pantallas no saben de dónde vienen los datos.
 */

export interface OpcionesError {
  /** Errores por campo, como los devuelve DRF: { costo_monedas: "…" }. */
  campos?: Record<string, string>;
  /** Estado HTTP, si vino de la API. */
  estado?: number;
  /** El `error` de las respuestas propias del backend: "demasiados_intentos"… */
  codigo?: string;
}

/** Error que el panel le muestra a la persona, con el texto ya listo. */
export class ErrorPanel extends Error {
  campos?: Record<string, string>;
  estado?: number;
  codigo?: string;

  constructor(mensaje: string, campos?: Record<string, string>, opciones: Omit<OpcionesError, 'campos'> = {}) {
    super(mensaje);
    this.name = 'ErrorPanel';
    this.campos = campos;
    this.estado = opciones.estado;
    this.codigo = opciones.codigo;
  }
}

// En los tests los mocks responden al instante.
const SIN_ESPERA = import.meta.env.MODE === 'test';

/** Simula la espera de la red, para que los estados de carga se vean. */
export function simularRed<T>(valor: T | (() => T), ms = 350): Promise<T> {
  return new Promise((resolve, reject) => {
    setTimeout(
      () => {
        try {
          resolve(typeof valor === 'function' ? (valor as () => T)() : valor);
        } catch (e) {
          reject(e);
        }
      },
      SIN_ESPERA ? 0 : ms,
    );
  });
}

/** Copia profunda: el mock nunca entrega su propio objeto (como una API). */
export function copia<T>(v: T): T {
  return structuredClone(v);
}

/** Hoy, en hora de Guatemala, como "AAAA-MM-DD". */
export function hoyGT(): string {
  return new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Guatemala' }).format(new Date());
}
