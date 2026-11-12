import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { ArrowLeft, LogIn, ShieldCheck } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/States';
import { conectado } from '@/datos/modo';
import { ErrorPanel } from '@/datos/red';
import { CODIGO_DE_MUESTRA, iniciarSesion, REQUIERE_2FA, useSesion } from '@/datos/sesion';
import { huboSesionVencida } from '@/datos/token';

/** Solo rutas internas: un ?volver=https://… no saca a nadie del panel. */
function destinoSeguro(v: string | null): string {
  return v && v.startsWith('/') && !v.startsWith('//') ? v : '/';
}

export function Login() {
  const sesion = useSesion();
  const [params] = useSearchParams();
  const ir = useNavigate();
  const volver = destinoSeguro(params.get('volver'));
  const vencida = huboSesionVencida();
  const [correo, setCorreo] = useState('');
  const [contrasena, setContrasena] = useState('');
  const [error, setError] = useState<ErrorPanel>();
  const [entrando, setEntrando] = useState(false);
  // Segundo paso: la cuenta tiene doble factor y el servidor pidió el código.
  const [pideCodigo, setPideCodigo] = useState(false);
  const [codigo, setCodigo] = useState('');
  const deMuestra = !conectado('sesion');

  if (sesion && !entrando) return <Navigate to={volver} replace />;

  const entrar = async () => {
    setEntrando(true);
    setError(undefined);
    try {
      await iniciarSesion(correo, contrasena, pideCodigo ? codigo : undefined);
      ir(volver, { replace: true });
    } catch (e) {
      const err = e instanceof ErrorPanel ? e : new ErrorPanel('No se pudo entrar.');
      if (err.codigo === REQUIERE_2FA && !pideCodigo) {
        // La contraseña estaba bien: falta el código. No es un error que mostrar.
        setPideCodigo(true);
        setCodigo('');
      } else {
        // Si el correo o la contraseña ya no valen, se vuelve al primer paso.
        if (pideCodigo && (err.campos?.username || err.campos?.password)) setPideCodigo(false);
        setError(err);
      }
      setEntrando(false);
    }
  };

  const volverAlPrimerPaso = () => {
    setPideCodigo(false);
    setCodigo('');
    setError(undefined);
  };

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10" style={{ backgroundImage: 'var(--gradient-brand)' }}>
      <div className="w-full max-w-[400px] rounded-card bg-surface p-8 shadow-pop">
        <img src="/marca/logo-vida.png" alt="+vida" className="mx-auto h-9 w-auto" />
        <h1 className="mt-6 text-center font-display text-[22px] leading-tight font-bold tracking-tight">
          Panel de <span className="text-primary">administración</span>
        </h1>
        <p className="mt-1 text-center text-text-muted">{pideCodigo ? 'Un paso más: tu cuenta tiene doble factor.' : 'Entra con tu cuenta del equipo.'}</p>
        <form
          className="mt-6 flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!entrando) void entrar();
          }}
        >
          {vencida && !pideCodigo && <Alert tone="warning">Tu sesión venció. Vuelve a entrar.</Alert>}
          {pideCodigo ? (
            <>
              <TextField
                key="codigo"
                label="Código de tu app de autenticación"
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={6}
                placeholder="6 dígitos"
                value={codigo}
                onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ''))}
                error={error?.campos?.codigo}
                hint={deMuestra ? `Datos de muestra: el código es ${CODIGO_DE_MUESTRA}.` : `Entrando como ${correo.trim()}.`}
                className="text-center font-mono text-lg tracking-[0.4em]"
                autoFocus
              />
              {error && !error.campos?.codigo && <Alert tone="danger">{error.message}</Alert>}
              <Button type="submit" icon={ShieldCheck} className="mt-1 w-full" disabled={entrando || codigo.length !== 6}>
                {entrando ? 'Comprobando…' : 'Confirmar y entrar'}
              </Button>
              <button type="button" onClick={volverAlPrimerPaso} disabled={entrando} className="inline-flex items-center justify-center gap-1.5 text-[13px] font-semibold text-text-muted hover:text-primary">
                <ArrowLeft size={14} aria-hidden /> Usar otra cuenta
              </button>
            </>
          ) : (
            <>
              <TextField
                key="correo"
                label="Correo"
                type="email"
                autoComplete="username"
                placeholder="nombre@masvidaapp.com"
                value={correo}
                onChange={(e) => setCorreo(e.target.value)}
                error={error?.campos?.username}
                autoFocus
              />
              <TextField
                label="Contraseña"
                type="password"
                autoComplete="current-password"
                value={contrasena}
                onChange={(e) => setContrasena(e.target.value)}
                error={error?.campos?.password}
              />
              {error && !error.campos?.username && !error.campos?.password && <Alert tone="danger">{error.message}</Alert>}
              <Button type="submit" icon={LogIn} className="mt-1 w-full" disabled={entrando}>
                {entrando ? 'Entrando…' : 'Entrar'}
              </Button>
              {deMuestra && (
                <p className="text-center text-[12.5px] text-text-muted">
                  Datos de muestra: entra con cualquier correo y contraseña. Un correo que empieza con <strong>soporte</strong> entra como soporte, y uno que empieza con <strong>2fa</strong> pide el código.
                </p>
              )}
            </>
          )}
        </form>
      </div>
    </div>
  );
}
