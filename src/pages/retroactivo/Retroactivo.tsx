import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, RotateCw, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { MotivoDialog } from '@/components/ui/MotivoDialog';
import { PageTitle } from '@/components/ui/PageTitle';
import { Avatar } from '@/components/ui/Progress';
import { Alert, EmptyState, ErrorState } from '@/components/ui/States';
import { listarRetroactivoDenegado, restituirRetroactivo, veredictoPrevio, type CasoRetroactivo } from '@/datos/cuentas';
import { puede } from '@/datos/sesion';
import { useConsulta } from '@/datos/useConsulta';
import { cx } from '@/lib/cx';
import { fecha, fechaCorta, fechaHora, numero } from '@/lib/formato';

function Caso({ c, onRestituido }: { c: CasoRetroactivo; onRestituido: (aviso: string) => void }) {
  const [abierto, setAbierto] = useState(false);
  const [restituir, setRestituir] = useState(false);
  // Por qué se denegó, con las edades del día de la verificación.
  const porque = c.corte && c.birth_date_confirmada ? veredictoPrevio(c.birth_date, c.birth_date_confirmada, c.corte).explicacion : '';
  return (
    <Card className="p-0">
      <button
        type="button"
        onClick={() => setAbierto((v) => !v)}
        aria-expanded={abierto}
        className="grid w-full grid-cols-[auto_1fr_auto] items-center gap-4 rounded-card p-5 text-left hover:bg-surface-muted/60 md:grid-cols-[auto_1.4fr_1fr_repeat(3,auto)_auto]"
      >
        <Avatar name={c.nombre} seed={c.usuario_id} />
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <span className="truncate font-semibold">{c.nombre}</span>
            {c.restituido_en && <Chip tone="success">Restituido</Chip>}
          </div>
          <div className="font-mono text-[11.5px] text-text-muted">
            {c.usuario_id} · {c.policy_number}
          </div>
        </div>
        <div className="hidden text-[13px] md:block">
          <div className="text-text-muted">
            Declaró <strong className="text-text">{fecha(c.birth_date)}</strong>
          </div>
          <div className="text-text-muted">
            Aseguradora <strong className="text-text">{fecha(c.birth_date_confirmada)}</strong>
          </div>
        </div>
        <div className="hidden text-right md:block">
          <div className="font-display text-lg font-bold tabular-nums">{c.dias.length}</div>
          <div className="text-[12px] text-text-muted">días</div>
        </div>
        <div className="hidden text-right md:block">
          <div className="font-display text-lg font-bold text-danger tabular-nums">−{numero(c.puntos_anulados)}</div>
          <div className="text-[12px] text-text-muted">puntos</div>
        </div>
        <div className="hidden text-right md:block">
          <div className="font-display text-lg font-bold text-danger tabular-nums">−{numero(c.monedas_anuladas)}</div>
          <div className="text-[12px] text-text-muted">monedas</div>
        </div>
        <ChevronDown size={18} className={cx('text-text-muted transition-transform', abierto && 'rotate-180')} aria-hidden />
      </button>
      {abierto && (
        <div className="border-t border-border px-5 pt-4 pb-5">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2 text-[13px]">
            <span className="text-text-muted">
              Corte: <strong className="text-text">{fecha(c.corte)}</strong>. Todo lo anterior quedó en 0 con una fila <code className="font-mono">retroactivo_denegado</code> por día.
            </span>
            <Link to={`/usuarios/${c.usuario_id}?tab=puntos`} className="font-semibold text-primary hover:underline">
              Ver ledger →
            </Link>
          </div>
          {porque && <p className="mb-3 text-[13px] text-text-muted">Por qué se denegó: {porque}</p>}
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {c.dias.map((d) => (
              <li key={d.fecha} className={cx('flex items-center justify-between rounded-inner px-3 py-2 text-[12.5px]', c.restituido_en ? 'bg-surface-muted' : 'bg-danger-tint')}>
                <span className="text-text-muted">{fechaCorta(d.fecha)}</span>
                <span className={cx('font-bold tabular-nums', c.restituido_en ? 'text-text-muted line-through' : 'text-danger')}>−{d.puntos}</span>
              </li>
            ))}
          </ol>
          <div className="mt-4">
            {c.restituido_en ? (
              <Alert tone="success">Restituido el {fechaHora(c.restituido_en)}: se devolvieron los puntos de cada día y las monedas, con filas nuevas en los ledgers.</Alert>
            ) : puede('administrar_cuenta') ? (
              <div className="flex flex-wrap items-center justify-between gap-3 rounded-inner bg-surface-muted px-4 py-3">
                <span className="text-[13px] text-text-muted">Si al revisarlo fue un error (de la persona o de la aseguradora) y no una mentira, se le devuelve lo anulado.</span>
                <Button size="sm" variant="secondary" icon={RotateCw} onClick={() => setRestituir(true)}>
                  Restituir lo anulado
                </Button>
              </div>
            ) : (
              <Alert tone="info">Solo un admin puede restituir lo anulado.</Alert>
            )}
          </div>
        </div>
      )}
      <MotivoDialog
        open={restituir}
        title="Restituir lo anulado"
        description={`A ${c.nombre} se le devuelven ${numero(c.puntos_anulados)} puntos (${c.dias.length} días) y ${numero(c.monedas_anuladas)} monedas, con filas nuevas de ajuste. Lo anulado no se borra del ledger.`}
        confirmLabel="Restituir"
        sugerencias={['Error de la aseguradora en la fecha', 'Se equivocó al escribir su fecha', 'La fecha no le daba ventaja real']}
        onClose={() => setRestituir(false)}
        onConfirm={async (motivo) => {
          const r = await restituirRetroactivo(c.usuario_id, motivo);
          onRestituido(`Restituido a ${c.nombre}: ${numero(r.puntos)} puntos de ${r.dias} días y ${numero(r.monedas)} monedas.`);
        }}
      />
    </Card>
  );
}

export function Retroactivo() {
  const [vuelta, setVuelta] = useState(0);
  const [aviso, setAviso] = useState<string>();
  const casos = useConsulta(listarRetroactivoDenegado, [vuelta]);
  return (
    <>
      <PageTitle
        title="Retroactivo"
        accent="denegado"
        description="Cuentas en las que la fecha de nacimiento no coincidió con la aseguradora y se anuló lo ganado antes de verificar. Si fue un error y no una mentira, un admin puede restituirlo."
      />
      {aviso && (
        <Alert tone="success" className="mb-5">
          {aviso}
        </Alert>
      )}
      {casos.estado === 'error' ? (
        <Card>
          <ErrorState description={casos.error} onRetry={casos.recargar} />
        </Card>
      ) : !casos.datos ? (
        <div className="h-24 animate-pulse rounded-card bg-surface shadow-card" aria-hidden />
      ) : casos.datos.length === 0 ? (
        <Card>
          <EmptyState icon={ShieldCheck} title="No hay retroactivos denegados" description="Cuando una fecha no coincida al verificar, aparece aquí." />
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {casos.datos.map((c) => (
            <Caso
              key={c.usuario_id}
              c={c}
              onRestituido={(m) => {
                setAviso(m);
                setVuelta((v) => v + 1);
              }}
            />
          ))}
        </div>
      )}
    </>
  );
}
