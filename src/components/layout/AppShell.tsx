import { useState, type ReactNode } from 'react';
import { NavLink, Outlet } from 'react-router';
import {
  BadgePercent,
  CalendarCheck,
  ChartColumn,
  FileCheck2,
  Gift,
  Handshake,
  House,
  Menu,
  Palette,
  ShieldAlert,
  Trophy,
  Users,
  Wallet,
  X,
  type LucideIcon,
} from 'lucide-react';
import { cx } from '@/lib/cx';
import { Avatar } from '@/components/ui/Progress';
import { SearchInput } from '@/components/ui/Field';

interface NavItem {
  to: string;
  label: string;
  icon: LucideIcon;
}

// Orden y nombres de las secciones de panel-admin.md.
export const NAV: Array<{ group?: string; items: NavItem[] }> = [
  { items: [{ to: '/', label: 'Inicio', icon: House }] },
  {
    group: 'Cuentas',
    items: [
      { to: '/usuarios', label: 'Usuarios', icon: Users },
      { to: '/polizas', label: 'Pólizas', icon: FileCheck2 },
      { to: '/puntos-monedas', label: 'Puntos y monedas', icon: Wallet },
    ],
  },
  {
    group: 'Juego',
    items: [
      { to: '/objetivo-semanal', label: 'Objetivo semanal', icon: CalendarCheck },
      { to: '/liga', label: 'La Liga', icon: Trophy },
      { to: '/premios', label: 'Premios y cupones', icon: Gift },
      { to: '/patrocinios', label: 'Patrocinios', icon: Handshake },
    ],
  },
  {
    group: 'Operación',
    items: [
      { to: '/reportes', label: 'Aseguradora', icon: ChartColumn },
      { to: '/antifraude', label: 'Antifraude', icon: ShieldAlert },
      { to: '/cashback', label: 'Cashback', icon: BadgePercent },
    ],
  },
  { group: 'Diseño', items: [{ to: '/estilo', label: 'Guía de estilo', icon: Palette }] },
];

function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  return (
    <nav aria-label="Secciones" className="flex h-full flex-col gap-6 overflow-y-auto bg-primary-deep px-4 py-6 text-white">
      <div className="flex items-center justify-between px-2">
        <img src="/marca/logo-vida-blanco.png" alt="+vida" className="h-7 w-auto" />
        <span className="rounded-full bg-white/12 px-2 py-0.5 text-[11px] font-semibold text-white/80">Panel</span>
      </div>
      {NAV.map((g, i) => (
        <div key={i} className="flex flex-col gap-0.5">
          {g.group && <div className="px-3 pb-1.5 text-[11px] font-bold tracking-[0.1em] text-white/50 uppercase">{g.group}</div>}
          {g.items.map((it) => (
            <NavLink
              key={it.to}
              to={it.to}
              end={it.to === '/'}
              onClick={onNavigate}
              className={({ isActive }) =>
                cx(
                  'flex h-9 items-center gap-2.5 rounded-full px-3 text-[13.5px] font-semibold transition-colors',
                  isActive ? 'bg-primary-tint text-primary-deep' : 'text-white/85 hover:bg-white/10 hover:text-white',
                )
              }
            >
              <it.icon size={17} strokeWidth={2} aria-hidden />
              {it.label}
            </NavLink>
          ))}
        </div>
      ))}
    </nav>
  );
}

interface HeaderProps {
  /** Navegación secundaria de la página: gris, y azul la activa. */
  tabs?: ReactNode;
  menuOpen: boolean;
  onToggleMenu: () => void;
}

function Header({ tabs, menuOpen, onToggleMenu }: HeaderProps) {
  return (
    <header className="sticky top-0 z-20 border-b border-border bg-surface">
      <div className="flex h-16 items-center gap-4 px-6">
        <button
          type="button"
          onClick={onToggleMenu}
          className="grid size-9 shrink-0 place-items-center rounded-full text-text-muted transition-colors hover:bg-surface-muted hover:text-primary"
          aria-label={menuOpen ? 'Ocultar menú' : 'Mostrar menú'}
          aria-expanded={menuOpen}
          aria-controls="menu-lateral"
        >
          <Menu size={20} />
        </button>
        <SearchInput placeholder="Buscar usuario, usuario_id o póliza" className="w-full max-w-md" aria-label="Buscar" />
        <div className="ml-auto flex items-center gap-3">
          <div className="hidden text-right sm:block">
            <div className="text-[13px] font-semibold">Equipo +vida</div>
            <div className="text-[12px] text-text-muted">Administrador</div>
          </div>
          <Avatar name="Equipo Vida" seed="admin" />
        </div>
      </div>
      {tabs && <div className="flex gap-6 overflow-x-auto px-6">{tabs}</div>}
    </header>
  );
}

/** Pestaña del header: gris, y azul con subrayado cuando está activa. */
export function HeaderTab({ href, active, children }: { href: string; active?: boolean; children: ReactNode }) {
  return (
    <a
      href={href}
      aria-current={active ? 'true' : undefined}
      className={cx(
        'relative py-3 text-[13.5px] font-semibold whitespace-nowrap transition-colors',
        active ? 'text-primary after:absolute after:inset-x-0 after:bottom-0 after:h-0.5 after:rounded-full after:bg-primary' : 'text-text-muted hover:text-primary',
      )}
    >
      {children}
    </a>
  );
}

const esEscritorio = () => window.matchMedia('(min-width: 1024px)').matches;

export function AppShell({ tabs }: { tabs?: ReactNode }) {
  // Escritorio: la barra va fija al costado. Siempre arranca oculta; se muestra con ☰.
  const [fija, setFija] = useState(false);
  // Tablet: la barra se abre encima del contenido.
  const [menu, setMenu] = useState(false);

  const alternar = () => {
    if (esEscritorio()) setFija((v) => !v);
    else setMenu((v) => !v);
  };

  return (
    <div className="flex min-h-screen">
      <aside
        id="menu-lateral"
        aria-hidden={!fija}
        inert={!fija}
        className={cx(
          'sticky top-0 hidden h-screen shrink-0 overflow-hidden transition-[width] duration-300 ease-out lg:block',
          fija ? 'w-[248px]' : 'w-0',
        )}
      >
        <div className="h-full w-[248px]">
          <Sidebar />
        </div>
      </aside>
      {menu && (
        <div className="fixed inset-0 z-40 lg:hidden">
          <button type="button" aria-label="Cerrar menú" className="absolute inset-0 bg-primary-deep/40" onClick={() => setMenu(false)} />
          <div className="relative h-full w-[260px] shadow-pop">
            <Sidebar onNavigate={() => setMenu(false)} />
            <button
              type="button"
              onClick={() => setMenu(false)}
              aria-label="Cerrar menú"
              className="absolute top-5 right-3 grid size-8 place-items-center rounded-full text-white/80 hover:bg-white/10"
            >
              <X size={18} />
            </button>
          </div>
        </div>
      )}
      <div className="min-w-0 flex-1">
        <Header tabs={tabs} menuOpen={fija || menu} onToggleMenu={alternar} />
        <main className="mx-auto max-w-[1280px] px-6 py-8">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
