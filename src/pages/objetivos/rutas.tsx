import type { RouteObject } from 'react-router';
import { PorConstruir } from '@/components/layout/PorConstruir';

// Se reemplaza en A46-admin-objetivos-liga.
export const rutasObjetivos: RouteObject[] = [{ path: 'objetivos/*', element: <PorConstruir titulo="Semanas y metas" branch="A46-admin-objetivos-liga" /> }];
