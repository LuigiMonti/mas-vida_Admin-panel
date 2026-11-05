import { useState } from 'react';
import { Link } from 'react-router';
import { ChevronDown, ShieldCheck } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { PageTitle } from '@/components/ui/PageTitle';
import { Avatar } from '@/components/ui/Progress';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { listarRetroactivoDenegado, type CasoRetroactivo } from '@/datos/cuentas';
import { useConsulta } from '@/datos/useConsulta';
import { cx } from '@/lib/cx';
import { fecha, fechaCorta, numero } from '@/lib/formato';

function Caso({ c }: { c: CasoRetroactivo }) {
  const [abierto, setAbierto] = useState(false);
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
          <div className="truncate font-semibold">{c.nombre}</div>
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
          <ol className="grid grid-cols-2 gap-2 sm:grid-cols-4 lg:grid-cols-7">
            {c.dias.map((d) => (
              <li key={d.fecha} className="flex items-center justify-between rounded-inner bg-danger-tint px-3 py-2 text-[12.5px]">
                <span className="text-text-muted">{fechaCorta(d.fecha)}</span>
                <span className="font-bold text-danger tabular-nums">−{d.puntos}</span>
              </li>
            ))}
          </ol>
        </div>
      )}
    </Card>
  );
}

export function Retroactivo() {
  const casos = useConsulta(listarRetroactivoDenegado);
  return (
    <>
      <PageTitle
        title="Retroactivo"
        accent="denegado"
        description="Cuentas en las que la fecha de nacimiento no coincidió con la aseguradora y se anuló lo ganado antes de verificar. Solo lectura."
      />
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
            <Caso key={c.usuario_id} c={c} />
          ))}
        </div>
      )}
    </>
  );
}
