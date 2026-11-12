import type { RouteObject } from 'react-router';

// Cada pantalla se carga cuando se abre, no con el resto del panel.
export const rutasBitacora: RouteObject[] = [
  { path: 'bitacora', lazy: async () => ({ Component: (await import('./Bitacora')).Bitacora }) },
];
