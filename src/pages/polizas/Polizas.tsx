import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Check, FileCheck2, FileSearch, Inbox, SearchX, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { FilterChip } from '@/components/ui/Chip';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { Dialog } from '@/components/ui/Dialog';
import { SearchInput, SelectField, TextField } from '@/components/ui/Field';
import { PageTitle } from '@/components/ui/PageTitle';
import { Alert, EmptyState, ErrorState } from '@/components/ui/States';
import { DataTable, type Column } from '@/components/ui/Table';
import {
  HOY,
  listarPolizas,
  MOTIVOS_RECHAZO,
  rechazarPoliza,
  veredictoPrevio,
  verificarPoliza,
  type EstadoPoliza,
  type FilaPoliza,
} from '@/datos/cuentas';
import { ErrorPanel } from '@/datos/red';
import { puede } from '@/datos/sesion';
import { useConsulta } from '@/datos/useConsulta';
import { fecha, haceCuanto } from '@/lib/formato';
import { EstadoPolizaChip, motivoRechazo, NOMBRE_ESTADO, RetroactivoChip } from '../usuarios/comun';

type Filtro = Exclude<EstadoPoliza, 'sin_poliza'> | 'todas';
const FILTROS: Filtro[] = ['pendiente', 'verificada', 'rechazada', 'todas'];

const titular = (f: FilaPoliza) => (f.poliza.nombre ? `${f.poliza.nombre} ${f.poliza.apellido ?? ''}`.trim() : f.correo);

const COLUMNAS: Column<FilaPoliza>[] = [
  {
    key: 'titular',
    header: 'Titular',
    render: (f) => (
      <div className="min-w-0">
        <div className="truncate font-semibold">{titular(f)}</div>
        <div className="font-mono text-[11.5px] text-text-muted">{f.usuario_id}</div>
      </div>
    ),
  },
  { key: 'numero', header: 'Póliza', render: (f) => <span className="font-mono text-[12.5px]">{f.poliza.policy_number}</span> },
  {
    key: 'estado',
    header: 'Estado',
    render: (f) => (
      <div className="flex flex-col items-start gap-1">
        <EstadoPolizaChip estado={f.poliza.estado_verificacion} />
        {f.poliza.estado_verificacion === 'rechazada' && <span className="text-[12px] text-text-muted">{motivoRechazo(f.poliza.motivo_rechazo)}</span>}
      </div>
    ),
  },
  { key: 'vinculada', header: 'Vinculada', align: 'right', render: (f) => <span className="whitespace-nowrap text-text-muted">{haceCuanto(f.poliza.fecha_vinculacion)}</span> },
];

/* ----------------------------------------------------------------- panel de la póliza */

function PanelPoliza({ f, onCambio }: { f: FilaPoliza; onCambio: (mensaje: string, tono: 'success' | 'warning') => void }) {
  const p = f.poliza;
  const [confirmada, setConfirmada] = useState(p.birth_date_confirmada ?? '');
  const [error, setError] = useState<ErrorPanel>();
  const [guardando, setGuardando] = useState(false);
  const [confirmarDenegado, setConfirmarDenegado] = useState(false);
  const [rechazo, setRechazo] = useState(false);
  const [motivo, setMotivo] = useState('');

  useEffect(() => {
    setConfirmada(p.birth_date_confirmada ?? '');
    setError(undefined);
    setMotivo(f.en_otra_cuenta ? 'poliza_en_otra_cuenta' : '');
  }, [f.usuario_id, p.birth_date_confirmada, f.en_otra_cuenta]);

  const pendiente = p.estado_verificacion === 'pendiente' || p.estado_verificacion === 'rechazada';
  const v = confirmada ? veredictoPrevio(f.birth_date, confirmada, HOY) : null;
  const puedeActuar = puede('verificar_poliza');

  const verificar = async () => {
    setGuardando(true);
    setError(undefined);
    try {
      const r = await verificarPoliza(f.usuario_id, confirmada);
      setConfirmarDenegado(false);
      onCambio(
        r.veredicto.resultado === 'denegado'
          ? `${p.policy_number} verificada. La fecha no coincide: se anularon ${r.dias_anulados} días (${r.puntos_anulados} pts) y ${r.monedas_anuladas} monedas.`
          : `${p.policy_number} verificada. Retroactivo ${r.veredicto.resultado}: se conserva lo ganado.`,
        r.veredicto.resultado === 'denegado' ? 'warning' : 'success',
      );
    } catch (e) {
      setConfirmarDenegado(false);
      setError(e instanceof ErrorPanel ? e : new ErrorPanel('No se pudo verificar.'));
    } finally {
      setGuardando(false);
    }
  };

  const rechazar = async () => {
    setGuardando(true);
    setError(undefined);
    try {
      await rechazarPoliza(f.usuario_id, motivo);
      setRechazo(false);
      onCambio(`${p.policy_number} rechazada: ${MOTIVOS_RECHAZO[motivo]}.`, 'success');
    } catch (e) {
      setError(e instanceof ErrorPanel ? e : new ErrorPanel('No se pudo rechazar.'));
    } finally {
      setGuardando(false);
    }
  };

  return (
    <Card className="lg:sticky lg:top-24">
      <CardHeader
        title={titular(f)}
        description={
          <Link to={`/usuarios/${f.usuario_id}`} className="font-mono text-[12.5px] hover:text-primary">
            {f.usuario_id} →
          </Link>
        }
        icon={FileCheck2}
      />
      <div className="mb-4 flex flex-wrap gap-2">
        <EstadoPolizaChip estado={p.estado_verificacion} />
        <RetroactivoChip r={p.retroactivo} />
      </div>

      <dl className="mb-5 grid grid-cols-2 gap-x-4 gap-y-3 text-[13.5px]">
        <div>
          <dt className="text-[12px] font-semibold text-text-muted">Póliza</dt>
          <dd className="font-mono">{p.policy_number}</dd>
        </div>
        <div>
          <dt className="text-[12px] font-semibold text-text-muted">Aseguradora</dt>
          <dd>{p.insurer}</dd>
        </div>
        <div>
          <dt className="text-[12px] font-semibold text-text-muted">Inicio</dt>
          <dd>{p.policy_start_date ? fecha(p.policy_start_date) : '—'}</dd>
        </div>
        <div>
          <dt className="text-[12px] font-semibold text-text-muted">Nacimiento declarado</dt>
          <dd className="font-semibold">{fecha(f.birth_date)}</dd>
        </div>
      </dl>

      {f.en_otra_cuenta && p.estado_verificacion !== 'verificada' && (
        <Alert tone="danger" className="mb-4">
          Esta póliza ya está verificada en otra cuenta ({f.en_otra_cuenta}). Una cuenta verificada por póliza: recházala o libera la otra.
        </Alert>
      )}

      {p.estado_verificacion === 'verificada' ? (
        <Alert tone="info">
          Verificada con nacimiento {p.birth_date_confirmada ? fecha(p.birth_date_confirmada) : '—'}. Una póliza verificada no se rechaza.
        </Alert>
      ) : !puedeActuar ? (
        <Alert tone="info">Tu rol solo puede ver pólizas.</Alert>
      ) : (
        pendiente && (
          <div className="flex flex-col gap-4">
            <TextField
              label="Nacimiento confirmado por la aseguradora"
              type="date"
              max={HOY}
              value={confirmada}
              onChange={(e) => setConfirmada(e.target.value)}
              error={error?.campos?.birth_date_confirmada}
              hint="Sin esta fecha no se puede verificar."
            />
            {v && (
              <Alert tone={v.resultado === 'aplicado' ? 'success' : v.resultado === 'tolerado' ? 'info' : 'danger'}>
                <strong>Retroactivo {v.resultado}.</strong> {v.explicacion}
              </Alert>
            )}
            {error && !error.campos && <Alert tone="danger">{error.message}</Alert>}
            <div className="flex flex-wrap gap-2">
              <Button
                icon={Check}
                disabled={!confirmada || guardando || !!f.en_otra_cuenta}
                onClick={() => (v?.resultado === 'denegado' ? setConfirmarDenegado(true) : verificar())}
              >
                {guardando ? 'Verificando…' : 'Verificar'}
              </Button>
              {p.estado_verificacion === 'pendiente' && (
                <Button variant="secondary" icon={X} disabled={guardando} onClick={() => setRechazo(true)}>
                  Rechazar
                </Button>
              )}
            </div>
          </div>
        )
      )}

      <ConfirmDialog
        open={confirmarDenegado}
        title="¿Verificar con el retroactivo denegado?"
        body="La fecha no coincide y cuenta como mentira. Se anulan los puntos y las monedas de antes de hoy con filas nuevas en el ledger. No se puede deshacer."
        confirmLabel="Verificar y anular"
        onCancel={() => setConfirmarDenegado(false)}
        onConfirm={verificar}
      />

      <Dialog
        open={rechazo}
        onClose={() => setRechazo(false)}
        busy={guardando}
        title="Rechazar póliza"
        description="Rechazada cuenta igual que sin póliza. No toca sus puntos ni sus monedas."
        footer={
          <>
            <Button variant="secondary" onClick={() => setRechazo(false)} disabled={guardando}>
              Cancelar
            </Button>
            <button
              type="button"
              disabled={!motivo || guardando}
              onClick={rechazar}
              className="h-10 rounded-full bg-danger px-5 text-sm font-semibold text-white hover:brightness-90 disabled:cursor-not-allowed disabled:bg-border disabled:text-text-muted"
            >
              {guardando ? 'Rechazando…' : 'Rechazar'}
            </button>
          </>
        }
      >
        <SelectField label="Motivo" value={motivo} onChange={(e) => setMotivo(e.target.value)} error={error?.campos?.motivo}>
          <option value="" disabled>
            Elige un motivo
          </option>
          {Object.entries(MOTIVOS_RECHAZO).map(([k, l]) => (
            <option key={k} value={k}>
              {l}
            </option>
          ))}
        </SelectField>
        {error && !error.campos && <Alert tone="danger">{error.message}</Alert>}
      </Dialog>
    </Card>
  );
}

/* ----------------------------------------------------------------- página */

export function Polizas() {
  const [params, setParams] = useSearchParams();
  const filtro = (params.get('estado') as Filtro | null) ?? 'pendiente';
  const sel = params.get('u') ?? undefined;
  const [q, setQ] = useState('');
  const [vuelta, setVuelta] = useState(0);
  const [aviso, setAviso] = useState<{ texto: string; tono: 'success' | 'warning' }>();

  // Si llega con ?u= de una cuenta, busca en todas para encontrarla.
  const estado = sel && !params.get('estado') ? 'todas' : filtro;
  const polizas = useConsulta(() => listarPolizas({ estado, q }), [estado, q, vuelta]);
  const seleccionada = polizas.datos?.find((f) => f.usuario_id === sel);

  const set = (cambios: Record<string, string | undefined>) => {
    const p = new URLSearchParams(params);
    for (const [k, v] of Object.entries(cambios)) {
      if (v === undefined) p.delete(k);
      else p.set(k, v);
    }
    setParams(p, { replace: true });
  };

  return (
    <>
      <PageTitle title="Verificación de" accent="pólizas" description="Las pendientes más viejas van primero. Verificar exige la fecha de nacimiento que confirmó la aseguradora." />

      {aviso && (
        <Alert tone={aviso.tono} className="mb-5">
          {aviso.texto}
        </Alert>
      )}

      <div className="grid items-start gap-5 lg:grid-cols-[1fr_400px]">
        <Card>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {FILTROS.map((f) => (
                <FilterChip key={f} selected={estado === f} onClick={() => set({ estado: f, u: undefined })}>
                  {f === 'todas' ? 'Todas' : NOMBRE_ESTADO[f]}
                </FilterChip>
              ))}
            </div>
            <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Póliza, correo o usuario_id" className="w-full sm:w-64" aria-label="Buscar póliza" />
          </div>
          {polizas.estado === 'error' ? (
            <ErrorState description={polizas.error} onRetry={polizas.recargar} />
          ) : !polizas.datos ? (
            <div className="flex flex-col gap-2" aria-busy>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-inner bg-surface-muted" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={COLUMNAS}
              rows={polizas.datos}
              rowKey={(f) => f.usuario_id}
              selectedKey={sel}
              onRowClick={(f) => {
                setAviso(undefined);
                set({ u: f.usuario_id });
              }}
              caption="Pólizas"
              empty={
                q ? (
                  <EmptyState icon={SearchX} title="No hay pólizas con esa búsqueda" />
                ) : estado === 'pendiente' ? (
                  <EmptyState icon={Inbox} title="No hay pólizas pendientes" description="Cuando alguien vincule una póliza, aparece aquí." />
                ) : (
                  <EmptyState icon={Inbox} title="No hay pólizas en este estado" />
                )
              }
            />
          )}
        </Card>

        {seleccionada ? (
          <PanelPoliza
            f={seleccionada}
            onCambio={(texto, tono) => {
              setAviso({ texto, tono });
              setVuelta((v) => v + 1);
            }}
          />
        ) : (
          <Card>
            <EmptyState icon={FileSearch} title="Elige una póliza" description="Haz clic en una fila para verificarla o rechazarla." />
          </Card>
        )}
      </div>
    </>
  );
}
