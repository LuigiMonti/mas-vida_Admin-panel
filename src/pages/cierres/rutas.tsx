import type { RouteObject } from 'react-router';
import { PorConstruir } from '@/components/layout/PorConstruir';

// Se reemplaza en A48-admin-cierres-auditoria.
export const rutasCierres: RouteObject[] = [{ path: 'cierres/*', element: <PorConstruir titulo="Estado del cierre" branch="A48-admin-cierres-auditoria" /> }];
