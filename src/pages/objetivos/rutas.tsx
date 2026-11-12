import type { RouteObject } from 'react-router';

// Cada pantalla se carga cuando se abre, no con el resto del panel.
export const rutasObjetivos: RouteObject[] = [
  { path: 'objetivos', lazy: async () => ({ Component: (await import('./Objetivos')).Objetivos }) },
];
