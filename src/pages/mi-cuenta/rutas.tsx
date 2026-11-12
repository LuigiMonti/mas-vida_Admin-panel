import type { RouteObject } from 'react-router';

export const rutasMiCuenta: RouteObject[] = [{ path: 'mi-cuenta', lazy: async () => ({ Component: (await import('./MiCuenta')).MiCuenta }) }];
