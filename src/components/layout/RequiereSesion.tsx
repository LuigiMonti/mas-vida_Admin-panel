import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router';
import { useSesion } from '@/datos/sesion';

/**
 * Sin sesión, al login, y después de entrar vuelve a donde iba.
 * Si la sesión vence a mitad de camino (401), esto también lo lleva al login.
 */
export function RequiereSesion({ children }: { children: ReactNode }) {
  const sesion = useSesion();
  const donde = useLocation();
  if (!sesion) {
    const volver = donde.pathname + donde.search;
    return <Navigate to={volver === '/' ? '/login' : `/login?volver=${encodeURIComponent(volver)}`} replace />;
  }
  return <>{children}</>;
}
