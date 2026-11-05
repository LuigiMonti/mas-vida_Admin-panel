import { cx } from '@/lib/cx';
import { numero } from '@/lib/formato';

/*
 * Escalones de pasos y niveles de cashback. Se usan SOLO donde se
 * muestra un escalón o un nivel; nunca como decoración.
 * Nunca Bronze/Silver/Gold/Platinum en el texto: se dice "Nivel 3" o "50 pts".
 */

export type Escalon = 0 | 25 | 50 | 100;

export const ESCALONES: Array<{ pts: Escalon; desde: number; hasta?: number }> = [
  { pts: 0, desde: 0, hasta: 6999 },
  { pts: 25, desde: 7000, hasta: 9999 },
  { pts: 50, desde: 10000, hasta: 14999 },
  { pts: 100, desde: 15000 },
];

export function escalonDePasos(pasos: number): Escalon {
  if (pasos >= 15000) return 100;
  if (pasos >= 10000) return 50;
  if (pasos >= 7000) return 25;
  return 0;
}

// Los degradados de la tabla de pasos de la web, armados con los tokens.
const tierStyle: Record<Escalon, { bg: string; fg: string }> = {
  0: {
    bg: 'linear-gradient(90deg, var(--color-tier-0), var(--color-tier-0-hi) 55%, var(--color-tier-0))',
    fg: 'text-white',
  },
  25: {
    bg: 'linear-gradient(90deg, var(--color-tier-25), var(--color-tier-25-hi) 55%, var(--color-tier-25))',
    fg: 'text-white',
  },
  50: {
    bg: 'linear-gradient(90deg, var(--color-tier-50), var(--color-tier-50-hi) 55%, var(--color-tier-50))',
    fg: 'text-on-tier-50',
  },
  100: { bg: 'var(--gradient-tier-100)', fg: 'text-white' },
};

const rango = (e: (typeof ESCALONES)[number]) =>
  e.hasta === undefined ? `${numero(e.desde)} o más` : e.desde === 0 ? `Menos de ${numero(e.hasta + 1)}` : `${numero(e.desde)} a ${numero(e.hasta)}`;

/** Pastilla chica del escalón ganado: "50 pts". */
export function TierBadge({ pts }: { pts: Escalon }) {
  const s = tierStyle[pts];
  return (
    <span
      className={cx('inline-flex h-6 items-center rounded-full px-2.5 text-[12px] font-bold tabular-nums', s.fg)}
      style={{ backgroundImage: s.bg, textShadow: '0 1px 2px rgb(0 0 0 / 0.18)' }}
    >
      {pts} pts
    </span>
  );
}

/** Fila de la tabla de escalones, como en la web. */
export function TierRow({ pts }: { pts: Escalon }) {
  const e = ESCALONES.find((x) => x.pts === pts)!;
  const s = tierStyle[pts];
  return (
    <div
      className={cx('flex items-center justify-between gap-3 rounded-inner px-4 py-2.5', s.fg)}
      style={{ backgroundImage: s.bg, textShadow: '0 1px 2px rgb(0 0 0 / 0.18)' }}
    >
      <span className="text-[14px] font-semibold">{rango(e)}</span>
      <span className="font-display text-lg font-bold tabular-nums">{pts}</span>
    </div>
  );
}

export type Nivel = 0 | 1 | 2 | 3 | 4;

export const NIVELES: Array<{ nivel: Nivel; desde: number; hasta?: number; cashback: string }> = [
  { nivel: 0, desde: 0, hasta: 2499, cashback: '0 %' },
  { nivel: 1, desde: 2500, hasta: 4999, cashback: '5 %' },
  { nivel: 2, desde: 5000, hasta: 9999, cashback: '7,5 %' },
  { nivel: 3, desde: 10000, hasta: 14999, cashback: '10 %' },
  { nivel: 4, desde: 15000, cashback: '20 %' },
];

const levelBg: Record<Nivel, string> = {
  0: 'bg-surface-muted text-text-muted',
  1: 'bg-level-1 text-white',
  2: 'bg-level-2 text-white',
  3: 'bg-level-3 text-white',
  4: 'bg-level-4 text-white',
};

/** "Nivel 3" en pastilla, con el azul de su escalón (escala de la app). */
export function LevelBadge({ nivel, withCashback }: { nivel: Nivel; withCashback?: boolean }) {
  const n = NIVELES[nivel]!;
  return (
    <span className="inline-flex items-center gap-1.5 text-[12px] font-semibold whitespace-nowrap">
      <span className={cx('inline-flex h-6 items-center rounded-full px-2.5', levelBg[nivel])}>Nivel {nivel}</span>
      {withCashback && <span className="text-text-muted tabular-nums">{n.cashback}</span>}
    </span>
  );
}
