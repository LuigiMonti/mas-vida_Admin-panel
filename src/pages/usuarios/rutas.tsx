import type { RouteObject } from 'react-router';

// Cada pantalla se carga cuando se abre, no con el resto del panel.
export const rutasUsuarios: RouteObject[] = [
  { path: 'usuarios', lazy: async () => ({ Component: (await import('./ListaUsuarios')).ListaUsuarios }) },
  { path: 'usuarios/:usuarioId', lazy: async () => ({ Component: (await import('./FichaUsuario')).FichaUsuario }) },
];
