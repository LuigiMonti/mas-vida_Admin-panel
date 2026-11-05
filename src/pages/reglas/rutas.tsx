import type { RouteObject } from 'react-router';
import { PorConstruir } from '@/components/layout/PorConstruir';

// Se reemplaza en A46-admin-objetivos-liga.
export const rutasReglas: RouteObject[] = [{ path: 'reglas/*', element: <PorConstruir titulo="Reglas y configuración" branch="A46-admin-objetivos-liga" /> }];
