import type { RouteObject } from 'react-router';

export const rutasComercios: RouteObject[] = [{ path: 'comercios', lazy: async () => ({ Component: (await import('./Comercios')).Comercios }) }];
