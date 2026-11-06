import type { RouteObject } from 'react-router';

// Cada pantalla se carga cuando se abre, no con el resto del panel.
export const rutasRetroactivo: RouteObject[] = [
  { path: 'retroactivo', lazy: async () => ({ Component: (await import('./Retroactivo')).Retroactivo }) },
];
