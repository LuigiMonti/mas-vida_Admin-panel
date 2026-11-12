import { useState, type ReactNode } from 'react';
import { CircleUserRound, LogOut, Power, ShieldCheck, UserX } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { ConfirmDialog } from '@/components/ui/ConfirmDialog';
import { MotivoDialog } from '@/components/ui/MotivoDialog';
import { LevelBadge } from '@/components/ui/Niveles';
import { Alert } from '@/components/ui/States';
import { cambiarEstadoCuenta, cerrarSesiones, darDeBaja, type EstadoConsentimiento, type FichaUsuario } from '@/datos/cuentas';
import { ErrorPanel } from '@/datos/red';
import { puede } from '@/datos/sesion';
import { fechaHora } from '@/lib/formato';

export function Dato({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div>
      <dt className="text-[12px] font-semibold text-text-muted">{label}</dt>
      <dd className="mt-0.5 font-medium">{children}</dd>
    </div>
  );
}

const sinDato = <span className="text-text-muted">—</span>;

/* ----------------------------------------------------------------- la cuenta y sus acciones */

/**
 * Los datos de la cuenta y lo que el equipo puede hacer con ella:
 * cerrar sus sesiones (soporte y admin), y desactivarla o darla de baja (admin).
 */
export function CuentaCard({ f, onCambio }: { f: FichaUsuario; onCambio: (aviso: string) => void }) {
  const u = f.usuario;
  const baja = u.dado_de_baja_en !== null;
  const [dialogo, setDialogo] = useState<'estado' | 'baja' | 'sesiones' | null>(null);
  const [error, setError] = useState<string>();
  const atender = puede('atender_cuenta');
  const administrar = puede('administrar_cuenta');

  return (
    <Card>
      <CardHeader title="Cuenta" icon={CircleUserRound} />
      <dl className="grid gap-4 sm:grid-cols-2">
        <Dato label="usuario_id">
          <span className="font-mono">{u.usuario_id}</span>
        </Dato>
        <Dato label="Estado">
          {baja ? (
            <Chip tone="danger" dot>
              Dada de baja
            </Chip>
          ) : u.is_active ? (
            <Chip tone="success" dot>
              Activa
            </Chip>
          ) : (
            <Chip tone="neutral" dot>
              Desactivada
            </Chip>
          )}
        </Dato>
        <Dato label="Correo">
          <span className="break-all">{u.correo}</span>
          {!baja && (
            <div className="mt-1">
              <Chip tone={u.correo_verificado ? 'success' : 'neutral'}>{u.correo_verificado ? 'Verificado con código' : 'Sin verificar'}</Chip>
            </div>
          )}
        </Dato>
        <Dato label="Nombre de miembro">
          {u.nombre_de_miembro ? <span className="font-mono">{u.nombre_de_miembro}</span> : <span className="text-text-muted">{baja ? '—' : 'Todavía no lo elige'}</span>}
        </Dato>
        <Dato label="Nombre al registrarse">{u.nombre ? `${u.nombre} ${u.apellido ?? ''}`.trim() : sinDato}</Dato>
        <Dato label="Foto de perfil">{u.tiene_foto ? 'Sí' : 'No'}</Dato>
        <Dato label="Creada">{fechaHora(u.creado_en)}</Dato>
        <Dato label="Sesiones abiertas">{f.sesiones_activas === 0 ? 'Ninguna' : f.sesiones_activas === 1 ? '1 teléfono' : `${f.sesiones_activas} teléfonos`}</Dato>
        <Dato label="Nivel">
          <LevelBadge nivel={f.nivel} withCashback />
        </Dato>
      </dl>

      {!baja && !u.nombre_de_miembro && (
        <Alert tone="info" className="mt-4">
          Cuenta de antes del 7 nov: la app le pide su nombre de miembro al abrirla. En las ligas sale con su nombre y la inicial del apellido.
        </Alert>
      )}
      {error && (
        <Alert tone="danger" className="mt-4">
          {error}
        </Alert>
      )}

      {!baja && (atender || administrar) && (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
          {atender && (
            <Button size="sm" variant="secondary" icon={LogOut} disabled={f.sesiones_activas === 0} onClick={() => setDialogo('sesiones')}>
              Cerrar sus sesiones
            </Button>
          )}
          {administrar && (
            <Button size="sm" variant="secondary" icon={Power} onClick={() => setDialogo('estado')}>
              {u.is_active ? 'Desactivar' : 'Reactivar'}
            </Button>
          )}
          {administrar && (
            <button type="button" onClick={() => setDialogo('baja')} className="inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-danger transition-colors hover:bg-danger-tint">
              <UserX size={15} aria-hidden /> Dar de baja
            </button>
          )}
        </div>
      )}

      <ConfirmDialog
        open={dialogo === 'sesiones'}
        title="¿Cerrar todas sus sesiones?"
        body="Tiene que volver a entrar en todos sus teléfonos. No pierde nada: los días que no se mandaron salen solos cuando entre."
        confirmLabel="Cerrar sesiones"
        onCancel={() => setDialogo(null)}
        onConfirm={async () => {
          setError(undefined);
          try {
            const r = await cerrarSesiones(u.usuario_id);
            onCambio(r.cerradas === 1 ? 'Se cerró 1 sesión.' : `Se cerraron ${r.cerradas} sesiones.`);
          } catch (e) {
            setError(e instanceof ErrorPanel ? e.message : 'No se pudieron cerrar las sesiones.');
          } finally {
            setDialogo(null);
          }
        }}
      />

      <MotivoDialog
        open={dialogo === 'estado'}
        title={u.is_active ? 'Desactivar la cuenta' : 'Reactivar la cuenta'}
        description={
          u.is_active
            ? 'No puede entrar ni sumar puntos, y se le cierran las sesiones. No se borra nada: se puede reactivar.'
            : 'Vuelve a poder entrar. Lo que tenía sigue igual.'
        }
        confirmLabel={u.is_active ? 'Desactivar' : 'Reactivar'}
        sugerencias={u.is_active ? ['Lo pidió la persona', 'Cuenta en revisión por fraude', 'Cuenta duplicada'] : ['Terminó la revisión', 'Se desactivó por error']}
        onClose={() => setDialogo(null)}
        onConfirm={async (motivo) => {
          await cambiarEstadoCuenta(u.usuario_id, !u.is_active, motivo);
          onCambio(u.is_active ? 'Cuenta desactivada.' : 'Cuenta reactivada.');
        }}
      />

      <MotivoDialog
        open={dialogo === 'baja'}
        title="Dar de baja la cuenta"
        description="Lo mismo que hace la persona desde la app. No se puede deshacer: para volver, se registra de nuevo y arranca de cero."
        confirmLabel="Dar de baja"
        peligro
        escribir={u.usuario_id}
        sugerencias={['Lo pidió la persona por correo', 'Lo pidió la persona por teléfono']}
        onClose={() => setDialogo(null)}
        onConfirm={async (motivo) => {
          await darDeBaja(u.usuario_id, motivo);
          onCambio('Cuenta dada de baja. Lo personal se borró y lo anónimo se conserva.');
        }}
      >
        <div className="grid gap-3 text-[13px] sm:grid-cols-2">
          <div className="rounded-inner bg-danger-tint p-3">
            <div className="mb-1 font-semibold text-danger">Se borra</div>
            Correo, nombre, nombre de miembro, foto, póliza (queda libre), nombres de dispositivo y la fecha exacta de nacimiento. Se revoca el consentimiento, se cierran las sesiones y sale de Tus Ligas.
          </div>
          <div className="rounded-inner bg-surface-muted p-3">
            <div className="mb-1 font-semibold">Se conserva</div>
            Puntos y monedas (los ledgers no se tocan), resúmenes diarios, muestras, cupones y las tablas de ligas ya cerradas. Nada de eso dice quién es.
          </div>
        </div>
      </MotivoDialog>
    </Card>
  );
}

/* ----------------------------------------------------------------- consentimiento */

/** Compartir los datos del día con la aseguradora: cuándo aceptó, qué versión y si revocó. Solo lectura. */
export function ConsentimientoCard({ c }: { c: EstadoConsentimiento }) {
  const nunca = c.historial.length === 0;
  const viejo = !c.aceptado && !nunca && !c.revocado_en;
  return (
    <Card>
      <CardHeader title="Consentimiento con la aseguradora" icon={ShieldCheck} description="Lo acepta o lo revoca la persona desde la app. El panel solo lo muestra." />
      <div className="mb-4 flex flex-wrap items-center gap-2">
        {c.aceptado ? (
          <Chip tone="success" dot>
            Aceptado · versión {c.version_aceptada}
          </Chip>
        ) : nunca ? (
          <Chip tone="neutral" dot>
            Nunca lo aceptó
          </Chip>
        ) : viejo ? (
          <Chip tone="warning" dot>
            Aceptó una versión anterior
          </Chip>
        ) : (
          <Chip tone="danger" dot>
            Revocado
          </Chip>
        )}
        <span className="text-[12.5px] text-text-muted">
          Texto vigente: versión {c.version_vigente} · {c.obligatorio ? 'obligatorio para sincronizar' : 'todavía no bloquea el sync'}
        </span>
      </div>
      {!c.aceptado && <Alert tone="info">Sin el consentimiento vigente, sus datos no entran a lo que se comparte con la aseguradora.</Alert>}
      {c.historial.length > 0 && (
        <ol className="mt-4 flex flex-col gap-2">
          {c.historial.map((h, i) => (
            <li key={i} className="flex flex-wrap items-center justify-between gap-2 rounded-inner bg-surface-muted px-3 py-2.5 text-[13px]">
              <span>
                <strong>Versión {h.version}</strong> · aceptó el {fechaHora(h.aceptado_en)}
              </span>
              {h.revocado_en ? <span className="font-semibold text-danger">Revocó el {fechaHora(h.revocado_en)}</span> : <span className="text-text-muted">Sin revocar</span>}
            </li>
          ))}
        </ol>
      )}
    </Card>
  );
}
