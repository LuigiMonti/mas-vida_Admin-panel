import type { RouteObject } from 'react-router';

export const rutasAntifraude: RouteObject[] = [{ path: 'antifraude', lazy: async () => ({ Component: (await import('./Antifraude')).Antifraude }) }];
