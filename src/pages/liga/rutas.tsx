import type { RouteObject } from 'react-router';

// Cada pantalla se carga cuando se abre, no con el resto del panel.
export const rutasLiga: RouteObject[] = [
  { path: 'liga', lazy: async () => ({ Component: (await import('./Liga')).Liga }) },
];
