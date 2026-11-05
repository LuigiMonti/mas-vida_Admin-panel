const entero = new Intl.NumberFormat('es-GT');

/** 12000 → "12.000", como en la app. */
export function numero(n: number): string {
  return entero.format(n).replace(/,/g, '.');
}

/** "María José López" → "ML". */
export function iniciales(nombre: string): string {
  const partes = nombre
    .trim()
    .split(/\s+/)
    .map((p) => p.replace(/^[^\p{L}]+/u, ''))
    .filter(Boolean);
  const primera = partes[0]?.[0] ?? '';
  const ultima = partes.length > 1 ? partes[partes.length - 1]?.[0] ?? '' : '';
  return (primera + ultima).toUpperCase();
}

const fmtFechaHora = new Intl.DateTimeFormat('es-GT', {
  timeZone: 'America/Guatemala',
  weekday: 'long',
  day: 'numeric',
  month: 'short',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

/** ISO → "martes 3 nov · 00:02", en hora de Guatemala. */
export function fechaHora(iso: string): string {
  const p = Object.fromEntries(fmtFechaHora.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.weekday} ${p.day} ${String(p.month).replace('.', '')} · ${p.hour}:${p.minute}`;
}

/** 0.6123 → "61 %". */
export function porcentaje(parte: number, total: number): string {
  return total > 0 ? `${Math.round((parte / total) * 100)} %` : '—';
}
