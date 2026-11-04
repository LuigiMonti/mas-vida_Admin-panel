import { useState } from 'react';
import { LogIn } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { TextField } from '@/components/ui/Field';
import { Alert } from '@/components/ui/States';

/**
 * Pantalla de login. Solo diseño por ahora: todavía no habla con la API
 * (la autenticación del panel se arma con los endpoints /api/v1/admin/).
 */
export function Login() {
  const [error, setError] = useState<string>();
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
          onSubmit={(e) => {
            e.preventDefault();
            setError('El login todavía no está conectado a la API.');
          }}
        >
          <TextField label="Correo" type="email" autoComplete="username" placeholder="nombre@masvidaapp.com" required />
          <TextField label="Contraseña" type="password" autoComplete="current-password" required />
          {error && <Alert tone="warning">{error}</Alert>}
          <Button type="submit" icon={LogIn} className="mt-1 w-full">
            Entrar
          </Button>
        </form>
      </div>
    </div>
  );
}
