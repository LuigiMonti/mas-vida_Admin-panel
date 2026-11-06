import { useState } from 'react';
import { Navigate, useNavigate, useSearchParams } from 'react-router';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/States';
import { conectado } from '@/datos/modo';
import { ErrorPanel } from '@/datos/red';
import { iniciarSesion, useSesion } from '@/datos/sesion';
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
  const deMuestra = !conectado('sesion');

  if (sesion && !entrando) return <Navigate to={volver} replace />;

  const entrar = async () => {
    setEntrando(true);
    setError(undefined);
    try {
      await iniciarSesion(correo, contrasena);
      ir(volver, { replace: true });
    } catch (e) {
      setError(e instanceof ErrorPanel ? e : new ErrorPanel('No se pudo entrar.'));
      setEntrando(false);
    }
  };

  return (
    <div className="grid min-h-screen place-items-center px-4 py-10" style={{ backgroundImage: 'var(--gradient-brand)' }}>
      <div className="w-full max-w-[400px] rounded-card bg-surface p-8 shadow-pop">
        <img src="/marca/logo-vida.png" alt="+vida" className="mx-auto h-9 w-auto" />
        <h1 className="mt-6 text-center font-display text-[22px] leading-tight font-bold tracking-tight">
          Panel de <span className="text-primary">administración</span>
        </h1>
        <p className="mt-1 text-center text-text-muted">Entra con tu cuenta del equipo.</p>
        <form
          className="mt-6 flex flex-col gap-4"
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!entrando) void entrar();
          }}
        >
          {vencida && <Alert tone="warning">Tu sesión venció. Vuelve a entrar.</Alert>}
          <TextField
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
              Datos de muestra: entra con cualquier correo y contraseña. Un correo que empieza con <strong>soporte</strong> entra como soporte.
            </p>
          )}
        </form>
      </div>
    </div>
  );
}
