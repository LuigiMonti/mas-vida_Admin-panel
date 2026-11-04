import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { createBrowserRouter, Navigate, RouterProvider } from 'react-router';
import { Construction } from 'lucide-react';
import '@/styles/index.css';
import { AppShell } from '@/components/layout/AppShell';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';
import { Estilo, EstiloTabs } from '@/pages/Estilo';
import { Login } from '@/pages/Login';

function PorConstruir() {
  return (
    <Card>
      <EmptyState icon={Construction} title="Esta sección todavía no existe" description="Se construye después de aprobar la guía de estilo." />
    </Card>
  );
}

const router = createBrowserRouter([
  { path: '/login', element: <Login /> },
  {
    path: '/estilo',
    element: <AppShell tabs={<EstiloTabs />} />,
    children: [{ index: true, element: <Estilo /> }],
  },
  {
    path: '/',
    element: <AppShell />,
    children: [
      // Mientras se aprueba el estilo, el inicio abre la guía.
      { index: true, element: <Navigate to="/estilo" replace /> },
      { path: '*', element: <PorConstruir /> },
    ],
  },
]);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <RouterProvider router={router} />
  </StrictMode>,
);
