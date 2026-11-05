import type { RouteObject } from 'react-router';
import { PorConstruir } from '@/components/layout/PorConstruir';

// Se reemplaza en A47-admin-polizas-usuarios.
export const rutasPolizas: RouteObject[] = [{ path: 'polizas/*', element: <PorConstruir titulo="Pólizas" branch="A47-admin-polizas-usuarios" /> }];
