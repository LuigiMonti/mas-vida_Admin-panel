import type { RouteObject } from 'react-router';

// Cada pantalla se carga cuando se abre, no con el resto del panel.
export const rutasCupones: RouteObject[] = [
  { path: 'cupones', lazy: async () => ({ Component: (await import('./Cupones')).Cupones }) },
];
