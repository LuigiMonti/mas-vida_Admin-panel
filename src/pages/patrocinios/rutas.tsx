import type { RouteObject } from 'react-router';

// Cada pantalla se carga cuando se abre, no con el resto del panel.
export const rutasPatrocinios: RouteObject[] = [
  { path: 'patrocinios', lazy: async () => ({ Component: (await import('./Patrocinios')).Patrocinios }) },
];
