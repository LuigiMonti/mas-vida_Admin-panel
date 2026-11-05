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

const fmtFecha = new Intl.DateTimeFormat('es-GT', { timeZone: 'UTC', day: 'numeric', month: 'short', year: 'numeric' });
const fmtFechaCorta = new Intl.DateTimeFormat('es-GT', { timeZone: 'UTC', weekday: 'short', day: 'numeric', month: 'short' });

/** "2026-11-04" → "4 nov 2026". */
export function fecha(iso: string): string {
  return fmtFecha.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)).replace(/\./g, '').replace(/ de /g, ' ');
}

/** "2026-11-04" → "mié 4 nov". */
export function fechaCorta(iso: string): string {
  return fmtFechaCorta.format(new Date(`${iso.slice(0, 10)}T00:00:00Z`)).replace(/\./g, '').replace(/,/g, '').replace(/ de /g, ' ');
}

/** ISO con hora → "hace 3 horas" / "hace 2 días". */
export function haceCuanto(iso: string, ahora: Date = new Date()): string {
  const min = Math.floor((ahora.getTime() - new Date(iso).getTime()) / 60000);
  if (min < 1) return 'hace un momento';
  if (min < 60) return `hace ${min} min`;
  const h = Math.floor(min / 60);
  if (h < 24) return h === 1 ? 'hace 1 hora' : `hace ${h} horas`;
  const d = Math.floor(h / 24);
  return d === 1 ? 'hace 1 día' : `hace ${d} días`;
}

/** Con signo: 25 → "+25", -10 → "−10". */
export function conSigno(n: number): string {
  return n > 0 ? `+${numero(n)}` : n < 0 ? `−${numero(-n)}` : '0';
}
