const entero = new Intl.NumberFormat('es-GT');

/** 12000 → "12.000", como en la app. */
export function numero(n: number): string {
  return entero.format(n).replace(/,/g, '.');
}

/** "María José López" → "ML". */
export function iniciales(nombre: string): string {
  const partes = nombre.trim().split(/\s+/).filter(Boolean);
  const primera = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? partes[partes.length - 1]?.[0] ?? '' : '';
  return (primera + ultima).toUpperCase();
}
