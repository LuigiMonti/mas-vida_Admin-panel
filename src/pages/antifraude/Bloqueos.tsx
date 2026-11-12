import { useState } from 'react';
import { Link } from 'react-router';
import { LockOpen, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Chip } from '@/components/ui/Chip';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Alert, EmptyState, ErrorState } from '@/components/ui/States';
import { DataTable, type Column } from '@/components/ui/Table';
import { desbloquear, estaBloqueado, LIMITES, listarBloqueos, type Bloqueo } from '@/datos/antifraude';
import { ErrorPanel } from '@/datos/red';
import { puede } from '@/datos/sesion';
import { useConsulta } from '@/datos/useConsulta';
import { faltan, haceCuanto } from '@/lib/formato';

/** A quién le pega el bloqueo, con lo que el backend pudo reconocer. */
function Sobre({ b }: { b: Bloqueo }) {
  if (b.usuario_id)
    return (
      <div>
        <Link to={`/usuarios/${b.usuario_id}`} className="font-mono text-[12.5px] font-semibold text-primary hover:underline">
          {b.usuario_id}
        </Link>
        {b.policy_number && <div className="font-mono text-[11.5px] text-text-muted">{b.policy_number}</div>}
      </div>
    );
  if (b.ip) return <span className="font-mono text-[12.5px]">{b.ip}</span>;
  return <span className="text-text-muted">Ninguna cuenta ni póliza conocida</span>;
}

/** Pide confirmación y quita el bloqueo. */
function useDesbloquear(onListo: (aviso: string) => void) {
  const [elegido, setElegido] = useState<Bloqueo | null>(null);
  const [error, setError] = useState<string>();
  const dialogo = (
    <ConfirmDialog
      open={elegido !== null}
      title="¿Quitar este bloqueo?"
      body={
        elegido && (
          <>
            {LIMITES[elegido.tipo].nombre}: se borran sus {elegido.intentos} intentos y lo correcto vuelve a pasar. No cambia nada más de la cuenta.
          </>
        )
      }
      confirmLabel="Desbloquear"
      onCancel={() => setElegido(null)}
      onConfirm={async () => {
        if (!elegido) return;
        setError(undefined);
        try {
          await desbloquear(elegido.id);
          onListo(`Bloqueo quitado: ${LIMITES[elegido.tipo].nombre.toLowerCase()}.`);
        } catch (e) {
          setError(e instanceof ErrorPanel ? e.message : 'No se pudo desbloquear.');
        } finally {
          setElegido(null);
        }
      }}
    />
  );
  return { pedir: setElegido, dialogo, error };
}

/**
 * Aviso en la ficha de una cuenta o de una póliza: si está bloqueada por
 * intentos, lo dice y deja desbloquear ahí mismo.
 */
export function AvisoBloqueos({ usuario_id, policy_number, onCambio, className }: { usuario_id?: string; policy_number?: string; onCambio?: (aviso: string) => void; className?: string }) {
  const [vuelta, setVuelta] = useState(0);
  const bloqueos = useConsulta(() => listarBloqueos({ usuario_id, policy_number }), [usuario_id, policy_number, vuelta]);
  const d = useDesbloquear((aviso) => {
    setVuelta((v) => v + 1);
    onCambio?.(aviso);
  });
  const activos = (bloqueos.datos ?? []).filter((b) => estaBloqueado(b));
  if (activos.length === 0 && !d.error) return null;
  return (
    <div className={className}>
      <div className="flex flex-col gap-2">
        {activos.map((b) => (
          <Alert key={b.id} tone="danger">
            <span className="flex flex-wrap items-center justify-between gap-2">
              <span>
                <strong>Bloqueada por intentos</strong> ({LIMITES[b.tipo].regla}). Se libera sola en {faltan(b.bloqueado_hasta!)}; mientras tanto no pasa ni lo correcto.
              </span>
              {puede('atender_cuenta') && (
                <Button size="sm" variant="secondary" icon={LockOpen} onClick={() => d.pedir(b)}>
                  Desbloquear
                </Button>
              )}
            </span>
          </Alert>
        ))}
        {d.error && <Alert tone="danger">{d.error}</Alert>}
      </div>
      {d.dialogo}
    </div>
  );
}

/** La pestaña de Antifraude: todos los intentos que cuentan hoy para algún límite. */
export function TablaBloqueos({ onCambio }: { onCambio: (aviso: string) => void }) {
  const [vuelta, setVuelta] = useState(0);
  const bloqueos = useConsulta(() => listarBloqueos(), [vuelta]);
  const d = useDesbloquear((aviso) => {
    setVuelta((v) => v + 1);
    onCambio(aviso);
  });

  const columnas: Column<Bloqueo>[] = [
    {
      key: 'limite',
      header: 'Límite',
      render: (b) => (
        <div>
          <div className="font-semibold">{LIMITES[b.tipo].nombre}</div>
          <div className="text-[12px] text-text-muted">{LIMITES[b.tipo].regla}</div>
        </div>
      ),
    },
    { key: 'sobre', header: 'Sobre', render: (b) => <Sobre b={b} /> },
    {
      key: 'intentos',
      header: 'Intentos',
      numeric: true,
      render: (b) => (
        <span className="font-display font-bold tabular-nums">
          {b.intentos} <span className="text-[12px] font-semibold text-text-muted">de {b.maximo}</span>
        </span>
      ),
    },
    { key: 'ultimo', header: 'Último intento', render: (b) => <span className="whitespace-nowrap text-text-muted">{haceCuanto(b.ultimo_intento)}</span> },
    {
      key: 'estado',
      header: 'Estado',
      render: (b) =>
        estaBloqueado(b) ? (
          <Chip tone="danger" dot>
            Bloqueado · {faltan(b.bloqueado_hasta!)}
          </Chip>
        ) : (
          <Chip tone="neutral" dot>
            Sin bloquear
          </Chip>
        ),
    },
    {
      key: 'accion',
      header: '',
      align: 'right',
      render: (b) =>
        estaBloqueado(b) && puede('atender_cuenta') ? (
          <Button size="sm" variant="secondary" icon={LockOpen} onClick={() => d.pedir(b)}>
            Desbloquear
          </Button>
        ) : null,
    },
  ];

  if (bloqueos.estado === 'error') return <ErrorState description={bloqueos.error} onRetry={bloqueos.recargar} />;
  if (!bloqueos.datos) return <div className="h-40 animate-pulse rounded-inner bg-surface-muted" aria-busy />;
  return (
    <>
      {d.error && (
        <Alert tone="danger" className="mb-4">
          {d.error}
        </Alert>
      )}
      <DataTable
        columns={columnas}
        rows={bloqueos.datos}
        rowKey={(b) => b.id}
        caption="Intentos y bloqueos"
        empty={<EmptyState icon={ShieldCheck} title="Nadie está cerca de un límite" description="Aquí salen los intentos fallidos de vincular una póliza, de login y de registro." />}
      />
      {d.dialogo}
    </>
  );
}
