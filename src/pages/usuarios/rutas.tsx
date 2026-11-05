import type { RouteObject } from 'react-router';
import { PorConstruir } from '@/components/layout/PorConstruir';

// Se reemplaza en A47-admin-polizas-usuarios.
export const rutasUsuarios: RouteObject[] = [{ path: 'usuarios/*', element: <PorConstruir titulo="Usuarios" branch="A47-admin-polizas-usuarios" /> }];
