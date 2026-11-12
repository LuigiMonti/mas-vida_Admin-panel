import type { RouteObject } from 'react-router';

export const rutasTusLigas: RouteObject[] = [{ path: 'tus-ligas', lazy: async () => ({ Component: (await import('./TusLigas')).TusLigas }) }];
