import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, RouterProvider } from 'react-router';
import '@/styles/index.css';
import { AppShell } from '@/components/layout/AppShell';
import { RequiereSesion } from '@/components/layout/RequiereSesion';
import { Inicio } from '@/pages/Inicio';
import { Login } from '@/pages/Login';
import { NoEncontrada } from '@/pages/NoEncontrada';
// Cada sección define sus rutas en su carpeta: así cada branch toca solo lo suyo.
import { rutasUsuarios } from '@/pages/usuarios/rutas';
import { rutasPolizas } from '@/pages/polizas/rutas';
import { rutasRetroactivo } from '@/pages/retroactivo/rutas';
import { rutasObjetivos } from '@/pages/objetivos/rutas';
import { rutasCierres } from '@/pages/cierres/rutas';
import { rutasReglas } from '@/pages/reglas/rutas';
import { rutasBitacora } from '@/pages/bitacora/rutas';
import { rutasPremios } from '@/pages/premios/rutas';
import { rutasCupones } from '@/pages/cupones/rutas';
import { rutasEstadisticas } from '@/pages/estadisticas/rutas';
import { rutasLiga } from '@/pages/liga/rutas';
import { rutasPatrocinios } from '@/pages/patrocinios/rutas';
import { rutasAntifraude } from '@/pages/antifraude/rutas';
import { rutasTusLigas } from '@/pages/tus-ligas/rutas';
import { rutasComercios } from '@/pages/comercios/rutas';
import { rutasMiCuenta } from '@/pages/mi-cuenta/rutas';

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/',
    element: (
      <RequiereSesion>
        <AppShell />
      </RequiereSesion>
    ),
    children: [
      { index: true, element: <Inicio /> },
      ...rutasUsuarios,
      ...rutasPolizas,
      ...rutasRetroactivo,
      ...rutasObjetivos,
      ...rutasCierres,
      ...rutasReglas,
      ...rutasBitacora,
      ...rutasPremios,
      ...rutasCupones,
      ...rutasEstadisticas,
      ...rutasLiga,
      ...rutasPatrocinios,
      ...rutasAntifraude,
      ...rutasTusLigas,
      ...rutasComercios,
      ...rutasMiCuenta,
      { path: '*', element: <NoEncontrada /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
