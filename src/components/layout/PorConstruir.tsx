import { Construction } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { PageTitle } from '@/components/ui/PageTitle';
import { EmptyState } from '@/components/ui/States';

/** Sección que todavía no existe. */
export function PorConstruir({ titulo, branch }: { titulo?: string; branch?: string }) {
  return (
    <>
      {titulo && <PageTitle title={titulo} />}
      <Card>
        <EmptyState
          icon={Construction}
          title="Esta sección todavía no existe"
          description={branch ? `Se construye en ${branch}.` : 'Está en el plan de panel-admin.md.'}
        />
      </Card>
    </>
  );
}
