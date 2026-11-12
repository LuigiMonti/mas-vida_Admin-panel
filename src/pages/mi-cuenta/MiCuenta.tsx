import { useState } from 'react';
import { Check, KeyRound, ShieldCheck, ShieldOff, X } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { TextField } from '@/components/ui/Field';
import { PageTitle } from '@/components/ui/PageTitle';
import { Avatar } from '@/components/ui/Progress';
import { Alert, ErrorState } from '@/components/ui/States';
import { conectado } from '@/datos/modo';
import { ErrorPanel } from '@/datos/red';
import { confirmarDobleFactor, empezarDobleFactor, obtenerDobleFactor, quitarDobleFactor, type AltaDobleFactor } from '@/datos/seguridad';
import { CODIGO_DE_MUESTRA, NOMBRE_ROL, puede, useSesion, type Accion } from '@/datos/sesion';
import { useConsulta } from '@/datos/useConsulta';

/** Lo que cada rol puede hacer, dicho en palabras. El que decide es el servidor. */
const PERMISOS: Array<{ accion: Accion; texto: string }> = [
  { accion: 'ver', texto: 'Ver todo el panel' },
  { accion: 'verificar_poliza', texto: 'Verificar y rechazar pólizas' },
  { accion: 'marcar_cupon', texto: 'Marcar cupones como usados' },
  { accion: 'atender_cuenta', texto: 'Cerrar las sesiones de una cuenta y quitar bloqueos por intentos' },
  { accion: 'administrar_cuenta', texto: 'Desactivar o dar de baja cuentas, liberar pólizas, corregir fechas de nacimiento y restituir retroactivos' },
  { accion: 'ajustar_ledger', texto: 'Ajustar puntos y monedas, y revertir un día' },
  { accion: 'editar_objetivo', texto: 'Cambiar el objetivo semanal y las metas por edad' },
  { accion: 'correr_cierre', texto: 'Correr cierres a mano' },
  { accion: 'editar_reglas', texto: 'Crear versiones de las reglas de puntaje' },
  { accion: 'editar_premios', texto: 'Crear y editar premios' },
  { accion: 'editar_comercios', texto: 'Editar la ficha de los comercios' },
  { accion: 'editar_liga', texto: 'Cambiar el nombre y el podio de La Liga' },
  { accion: 'moderar_ligas', texto: 'Moderar Tus Ligas' },
  { accion: 'editar_patrocinios', texto: 'Vender y apagar patrocinios' },
  { accion: 'ver_bitacora', texto: 'Ver la bitácora' },
];

/* ----------------------------------------------------------------- doble factor */

function DobleFactor() {
  const [vuelta, setVuelta] = useState(0);
  const estado = useConsulta(obtenerDobleFactor, [vuelta]);
  const [alta, setAlta] = useState<AltaDobleFactor | null>(null);
  const [quitar, setQuitar] = useState(false);
  const [codigo, setCodigo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<ErrorPanel>();
  const [ocupado, setOcupado] = useState(false);
  const [aviso, setAviso] = useState<string>();
  const deMuestra = !conectado('sesion');

  const correr = async (accion: () => Promise<void>) => {
    setOcupado(true);
    setError(undefined);
    try {
      await accion();
    } catch (e) {
      setError(e instanceof ErrorPanel ? e : new ErrorPanel('No se pudo completar.'));
    } finally {
      setOcupado(false);
    }
  };

  const empezar = () =>
    correr(async () => {
      setAviso(undefined);
      setCodigo('');
      setAlta(await empezarDobleFactor());
    });

  const confirmar = () =>
    correr(async () => {
      await confirmarDobleFactor(codigo);
      setAlta(null);
      setAviso('Doble factor activado. La próxima vez que entres, el panel te pide el código.');
      setVuelta((v) => v + 1);
    });

  const desactivar = () =>
    correr(async () => {
      await quitarDobleFactor(contrasena);
      setQuitar(false);
      setAviso('Doble factor desactivado.');
      setVuelta((v) => v + 1);
    });

  return (
    <Card>
      <CardHeader
        title="Doble factor"
        icon={KeyRound}
        description="Además de la contraseña, un código de 6 dígitos de tu app de autenticación (Google Authenticator, 1Password, Authy). El panel muestra datos de salud: conviene tenerlo."
      />
      {estado.estado === 'error' ? (
        <ErrorState description={estado.error} onRetry={estado.recargar} />
      ) : !estado.datos ? (
        <div className="h-16 animate-pulse rounded-inner bg-surface-muted" aria-busy />
      ) : (
        <div className="flex flex-col gap-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            {estado.datos.activo ? (
              <Chip tone="success" icon={ShieldCheck}>
                Activo
              </Chip>
            ) : (
              <Chip tone="warning" icon={ShieldOff}>
                Sin activar
              </Chip>
            )}
            {estado.datos.activo ? (
              <Button
                size="sm"
                variant="secondary"
                onClick={() => {
                  setContrasena('');
                  setError(undefined);
                  setAviso(undefined);
                  setQuitar(true);
                }}
              >
                Desactivar
              </Button>
            ) : (
              <Button size="sm" icon={KeyRound} onClick={empezar} disabled={ocupado}>
                Activar doble factor
              </Button>
            )}
          </div>
          {aviso && <Alert tone="success">{aviso}</Alert>}
          {error && !alta && !quitar && <Alert tone="danger">{error.message}</Alert>}
        </div>
      )}

      <Dialog
        open={alta !== null}
        onClose={() => setAlta(null)}
        busy={ocupado}
        title="Activar doble factor"
        description="Agrega esta clave en tu app de autenticación y escribe el código que te da."
        footer={
          <>
            <Button variant="secondary" onClick={() => setAlta(null)} disabled={ocupado}>
              Cancelar
            </Button>
            <Button onClick={confirmar} disabled={ocupado || codigo.trim().length !== 6}>
              {ocupado ? 'Comprobando…' : 'Confirmar'}
            </Button>
          </>
        }
      >
        {alta && (
          <div className="flex flex-col gap-4">
            <div className="rounded-inner bg-surface-muted p-4">
              <div className="text-[12px] font-semibold text-text-muted">Clave para escribir a mano</div>
              <div className="mt-1 font-mono text-lg font-bold tracking-wider select-all">{alta.secreto}</div>
              <a href={alta.uri} className="mt-2 inline-block text-[12.5px] font-semibold text-primary hover:underline">
                Abrir en mi app de autenticación
              </a>
            </div>
            <Alert tone="warning">Esta clave se muestra una sola vez. Si cambias de teléfono sin pasarla, otro admin tiene que quitarte el doble factor.</Alert>
            <TextField
              label="Código de 6 dígitos"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={6}
              value={codigo}
              onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
              error={error?.campos?.codigo}
              hint={deMuestra ? `Datos de muestra: el código es ${CODIGO_DE_MUESTRA}.` : undefined}
              className="font-mono tracking-[0.3em]"
            />
            {error && !error.campos && <Alert tone="danger">{error.message}</Alert>}
          </div>
        )}
      </Dialog>

      <Dialog
        open={quitar}
        onClose={() => setQuitar(false)}
        busy={ocupado}
        title="Desactivar doble factor"
        description="Tu cuenta vuelve a entrar solo con la contraseña."
        footer={
          <>
            <Button variant="secondary" onClick={() => setQuitar(false)} disabled={ocupado}>
              Cancelar
            </Button>
            <Button onClick={desactivar} disabled={ocupado || !contrasena}>
              {ocupado ? 'Un momento…' : 'Desactivar'}
            </Button>
          </>
        }
      >
        <TextField label="Tu contraseña" type="password" autoComplete="current-password" value={contrasena} onChange={(e) => setContrasena(e.target.value)} error={error?.campos?.password} />
        {error && !error.campos && <Alert tone="danger">{error.message}</Alert>}
      </Dialog>
    </Card>
  );
}

/* ----------------------------------------------------------------- página */

export function MiCuenta() {
  const sesion = useSesion();
  if (!sesion) return null;
  return (
    <>
      <PageTitle title="Mi" accent="cuenta" description="Con qué cuenta del equipo entraste, qué puedes hacer y cómo proteges tu acceso." />
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_1.1fr]">
        <div className="flex flex-col gap-5">
          <Card>
            <div className="flex items-center gap-4">
              <Avatar name={sesion.nombre} seed={sesion.correo} size="lg" />
              <div className="min-w-0">
                <div className="truncate font-display text-lg font-semibold">{sesion.nombre}</div>
                <div className="truncate text-text-muted">{sesion.correo}</div>
                <div className="mt-1.5">
                  <Chip tone="primary">{NOMBRE_ROL[sesion.rol]}</Chip>
                </div>
              </div>
            </div>
          </Card>
          <DobleFactor />
        </div>
        <Card>
          <CardHeader title="Lo que puede tu rol" description="El panel oculta lo que no te toca, pero quien decide es el servidor." />
          <ul className="flex flex-col gap-1.5">
            {PERMISOS.map((p) => {
              const si = puede(p.accion, sesion);
              return (
                <li key={p.accion} className="flex items-start gap-2.5 text-[13.5px]">
                  <span className={si ? 'mt-0.5 text-success' : 'mt-0.5 text-text-muted'}>{si ? <Check size={16} aria-label="Sí" /> : <X size={16} aria-label="No" />}</span>
                  <span className={si ? undefined : 'text-text-muted'}>{p.texto}</span>
                </li>
              );
            })}
          </ul>
        </Card>
      </div>
    </>
  );
}
