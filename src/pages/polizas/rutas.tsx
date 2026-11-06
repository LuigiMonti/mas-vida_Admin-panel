import type { RouteObject } from 'react-router';

// Cada pantalla se carga cuando se abre, no con el resto del panel.
export const rutasPolizas: RouteObject[] = [
  { path: 'polizas', lazy: async () => ({ Component: (await import('./Polizas')).Polizas }) },
];
