import type { RouteObject } from 'react-router';

// Cada pantalla se carga cuando se abre, no con el resto del panel.
export const rutasEstadisticas: RouteObject[] = [
  { path: 'estadisticas', lazy: async () => ({ Component: (await import('./Estadisticas')).Estadisticas }) },
];
