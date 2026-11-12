import type { RouteObject } from 'react-router';

// Cada pantalla se carga cuando se abre, no con el resto del panel.
export const rutasPremios: RouteObject[] = [
  { path: 'premios', lazy: async () => ({ Component: (await import('./ListaPremios')).ListaPremios }) },
  { path: 'premios/:premioId', lazy: async () => ({ Component: (await import('./EditarPremio')).EditarPremio }) },
];
