import type { RouteObject } from 'react-router';
import { PorConstruir } from '@/components/layout/PorConstruir';

// Se reemplaza en A48-admin-cierres-auditoria.
export const rutasBitacora: RouteObject[] = [{ path: 'bitacora/*', element: <PorConstruir titulo="Bitácora" branch="A48-admin-cierres-auditoria" /> }];
