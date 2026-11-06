/*
 * Vistas previas que imitan la app: así se ve lo que el usuario va a ver.
 * Sin mascota, sin monedas animadas, sin fotos.
 */
import type { ReactNode } from 'react';
import { ArrowDown, ArrowUp, Coins, Minus, Trophy } from 'lucide-react';
import { cx } from '@/lib/cx';
import { numero } from '@/lib/formato';
import { Avatar, ProgressBar } from './Progress';

/* ---------------------------------------------------------------- Ranking */

interface RankingRowProps {
  puesto: number;
  nombre: string;
  seed?: string;
  puntos: number;
  /** Puntos del líder, para la barra. */
  maxPuntos: number;
  /** Puestos que subió (+) o bajó (−) desde ayer. */
  tendencia: number;
  /** La fila de la persona que se está mirando. */
  destacado?: boolean;
}

/** Fila de ranking como "Liga con tus amigos". El primer lugar va en azul claro. */
export function RankingRow({ puesto, nombre, seed, puntos, maxPuntos, tendencia, destacado }: RankingRowProps) {
  const primero = puesto === 1;
  const Flecha = tendencia > 0 ? ArrowUp : tendencia < 0 ? ArrowDown : Minus;
  return (
    <li
      className={cx(
        'grid grid-cols-[2rem_auto_1fr_auto_1.5rem] items-center gap-3 rounded-inner px-3 py-2.5',
        primero && 'bg-primary-tint',
        destacado && !primero && 'ring-1 ring-primary-soft',
      )}
    >
      <span
        className={cx(
          'grid size-7 place-items-center rounded-full font-display text-[13px] font-bold tabular-nums',
          primero ? 'bg-accent text-on-accent' : 'text-text-muted',
        )}
      >
        {puesto}
      </span>
      <Avatar name={nombre} seed={seed} size="sm" />
      <div className="min-w-0">
        <div className="truncate text-[13.5px] font-semibold">{nombre}</div>
        <ProgressBar value={puntos} max={maxPuntos} size="sm" className="mt-1.5 bg-white" label={`Puntos de ${nombre}`} />
      </div>
      <span className="font-display text-[15px] font-bold tabular-nums">{numero(puntos)}</span>
      <Flecha
        size={16}
        strokeWidth={2.5}
        className={tendencia > 0 ? 'text-success' : tendencia < 0 ? 'text-danger' : 'text-text-muted'}
        aria-label={tendencia > 0 ? `Subió ${tendencia}` : tendencia < 0 ? `Bajó ${-tendencia}` : 'Sin cambio'}
      />
    </li>
  );
}

/* ---------------------------------------------------------------- Premio */

interface PremioCardProps {
  nombre: string;
  categoria: string;
  costoMonedas: number;
  /** Logo del comercio; sin logo se muestra el nombre del comercio. */
  logoUrl?: string;
  comercio: string;
  /** Color de fondo del área del logo (lo define el comercio). */
  fondo?: string;
  apagado?: boolean;
}

/** Card de la Tienda: área de logo arriba, nombre, categoría y costo en monedas. */
export function PremioCard({ nombre, categoria, costoMonedas, logoUrl, comercio, fondo, apagado }: PremioCardProps) {
  return (
    <article
      className={cx(
        'flex w-44 flex-col overflow-hidden rounded-[18px] bg-primary-tint shadow-card',
        apagado && 'opacity-55 grayscale',
      )}
    >
      <div className="grid aspect-[4/3] place-items-center bg-surface" style={fondo ? { background: fondo } : undefined}>
        {logoUrl ? (
          <img src={logoUrl} alt={comercio} className="max-h-16 max-w-[70%] object-contain" />
        ) : (
          <span className="font-display text-sm font-semibold text-text-muted">{comercio}</span>
        )}
      </div>
      <div className="flex items-stretch gap-2 px-2.5 pt-2.5 pb-3">
        <span className="w-[3px] shrink-0 rounded-full bg-primary" aria-hidden />
        <div className="min-w-0 flex-1">
          <div className="truncate text-[13px] leading-tight font-extrabold">{nombre}</div>
          <div className="truncate text-[11px] font-bold text-secondary">{categoria}</div>
        </div>
        <span className="flex items-center gap-1 self-center text-[13px] font-extrabold text-coin tabular-nums">
          <Coins size={15} strokeWidth={2.25} aria-hidden />
          {costoMonedas}
          <span className="sr-only"> monedas</span>
        </span>
      </div>
    </article>
  );
}

/* ---------------------------------------------------------------- La Liga */

interface LigaBannerProps {
  mes: string;
  /** El nombre del mes ("Liga Nike"). Vacío = "Compite por puntos del mes". */
  nombre?: string;
  /** Monedas del podio: 1.º, 2.º, 3.º. */
  podio: [number, number, number];
  /** El cupón que suma el patrocinador al podio. */
  cuponPatrocinador?: { comercio: string; cupon: string; logo?: string; fondo?: string };
  cierre: string;
}

/** Banner de La Liga del mes: "La Liga · noviembre" arriba y el nombre del mes abajo. */
export function LigaBanner({ mes, nombre, podio, cuponPatrocinador, cierre }: LigaBannerProps) {
  return (
    <div className="relative overflow-hidden rounded-card p-6 text-white" style={{ backgroundImage: 'var(--gradient-banner)' }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="text-[12px] font-bold tracking-[0.12em] text-white/70 uppercase">La Liga · {mes}</div>
          <h3 className="mt-1 font-display text-2xl font-bold tracking-tight break-words">{nombre?.trim() || 'Compite por puntos del mes'}</h3>
          <p className="mt-1 text-[13px] text-white/75">{cierre}</p>
        </div>
        {cuponPatrocinador?.logo ? (
          <span className="grid size-12 shrink-0 place-items-center overflow-hidden rounded-full bg-white p-1.5" style={cuponPatrocinador.fondo ? { background: cuponPatrocinador.fondo } : undefined}>
            <img src={cuponPatrocinador.logo} alt={cuponPatrocinador.comercio} className="max-h-full max-w-full object-contain" />
          </span>
        ) : (
          <Trophy size={28} className="text-accent" aria-hidden />
        )}
      </div>
      {cuponPatrocinador && (
        <p className="mt-3 inline-flex rounded-full bg-white/12 px-3 py-1 text-[12.5px] font-semibold">
          El podio también gana: {cuponPatrocinador.cupon} en {cuponPatrocinador.comercio}
        </p>
      )}
      <ol className="mt-5 grid grid-cols-3 gap-2">
        {podio.map((m, i) => (
          <li key={i} className={cx('rounded-inner px-3 py-2.5', i === 0 ? 'bg-accent text-on-accent' : 'bg-white/12')}>
            <div className="text-[11px] font-bold opacity-80">{i + 1}.º lugar</div>
            <div className="flex items-center gap-1 font-display text-lg font-bold tabular-nums">
              {m} <span className="text-[12px] font-semibold">monedas</span>
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}

/* ---------------------------------------------------------------- Semana */

const LETRAS = ['L', 'M', 'M', 'J', 'V', 'S', 'D'] as const;
const DIAS = ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] as const;

export type EstadoDia = 'cumplido' | 'parcial' | 'nada' | 'futuro' | 'hoy';

interface WeekRowProps {
  dias: [EstadoDia, EstadoDia, EstadoDia, EstadoDia, EstadoDia, EstadoDia, EstadoDia];
  /** Texto bajo la fila: "3 de 4 workouts". */
  pie?: ReactNode;
}

/** La fila L M M J V S D de la app. */
export function WeekRow({ dias, pie }: WeekRowProps) {
  return (
    <div>
      <ol className="flex gap-1.5">
        {dias.map((estado, i) => (
          <li key={i} className="flex flex-1 flex-col items-center gap-1.5">
            <span
              aria-label={`${DIAS[i]}: ${estado}`}
              className={cx(
                'grid size-9 place-items-center rounded-full text-[13px] font-bold',
                estado === 'cumplido' && 'bg-primary text-white',
                estado === 'parcial' && 'bg-primary-tint-strong text-primary',
                estado === 'nada' && 'bg-surface-muted text-text-muted',
                estado === 'futuro' && 'border border-dashed border-border text-text-muted',
                estado === 'hoy' && 'border-2 border-primary text-primary',
              )}
            >
              {LETRAS[i]}
            </span>
          </li>
        ))}
      </ol>
      {pie && <div className="mt-2 text-center text-[12.5px] text-text-muted">{pie}</div>}
    </div>
  );
}
