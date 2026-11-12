import { cx } from '@/lib/cx';
import { urlLogo } from '@/datos/premios';

interface LogoComercioProps {
  /** La ruta del logo en la app ("assets/img/premios/…") o una URL. */
  foto: string;
  fondo?: string;
  nombre: string;
  size?: 'sm' | 'md' | 'lg';
}

/** Logo de un comercio en su cuadrito, como en la Tienda. Sin logo, sus iniciales. */
export function LogoComercio({ foto, fondo, nombre, size = 'md' }: LogoComercioProps) {
  const caja = { sm: 'size-8 rounded-[10px] p-1', md: 'size-10 rounded-xl p-1.5', lg: 'size-14 rounded-2xl p-2' }[size];
  const url = urlLogo(foto);
  return (
    <span
      className={cx('grid shrink-0 place-items-center overflow-hidden border border-border bg-surface', caja)}
      style={fondo ? { background: fondo, borderColor: fondo } : undefined}
    >
      {url ? (
        <img src={url} alt="" className="max-h-full max-w-full object-contain" loading="lazy" />
      ) : (
        <span className="font-display text-[11px] font-bold text-text-muted">{nombre.slice(0, 2).toUpperCase()}</span>
      )}
    </span>
  );
}
