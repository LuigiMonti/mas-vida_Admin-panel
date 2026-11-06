import { useLocation, useNavigate } from 'react-router';
import { House, MapPinOff } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { EmptyState } from '@/components/ui/States';

/** Una dirección que no existe en el panel. */
export function NoEncontrada() {
  const { pathname } = useLocation();
  const ir = useNavigate();
  return (
    <Card className="mt-6">
      <EmptyState
        icon={MapPinOff}
        title="Esta página no existe"
        description={`No hay nada en ${pathname}. Puede que el enlace esté mal escrito.`}
        action={
          <Button size="sm" icon={House} onClick={() => ir('/')}>
            Ir al inicio
          </Button>
        }
      />
    </Card>
  );
}
