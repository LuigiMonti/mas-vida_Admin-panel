import type { RouteObject } from 'react-router';

// Cada pantalla se carga cuando se abre, no con el resto del panel.
export const rutasCierres: RouteObject[] = [
  { path: 'cierres', lazy: async () => ({ Component: (await import('./Cierres')).Cierres }) },
];
