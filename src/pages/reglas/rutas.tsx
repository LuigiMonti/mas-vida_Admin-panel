import type { RouteObject } from 'react-router';

// Cada pantalla se carga cuando se abre, no con el resto del panel.
export const rutasReglas: RouteObject[] = [
  { path: 'reglas', lazy: async () => ({ Component: (await import('./Reglas')).Reglas }) },
];
