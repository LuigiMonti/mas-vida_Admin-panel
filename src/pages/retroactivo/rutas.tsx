import type { RouteObject } from 'react-router';
import { PorConstruir } from '@/components/layout/PorConstruir';

// Se reemplaza en A47-admin-polizas-usuarios.
export const rutasRetroactivo: RouteObject[] = [{ path: 'retroactivo/*', element: <PorConstruir titulo="Retroactivo denegado" branch="A47-admin-polizas-usuarios" /> }];
