import { useCallback, useEffect, useRef, useState } from 'react';

export type Consulta<T> =
  | { estado: 'cargando'; datos?: T; recargar: () => void }
  | { estado: 'listo'; datos: T; recargar: () => void }
  | { estado: 'error'; error: string; datos?: T; recargar: () => void };

/**
 * Carga datos y expone cargando / listo / error. `deps` cambia → se vuelve a pedir.
 * Mientras recarga se conservan los datos anteriores, para que la tabla no parpadee.
 */
export function useConsulta<T>(pedir: () => Promise<T>, deps: unknown[] = []): Consulta<T> {
  const [estado, setEstado] = useState<{ estado: 'cargando' | 'listo' | 'error'; datos?: T; error?: string }>({
    estado: 'cargando',
  });
  const [vuelta, setVuelta] = useState(0);
  const pedirRef = useRef(pedir);
  pedirRef.current = pedir;

  useEffect(() => {
    let vigente = true;
    setEstado((e) => ({ ...e, estado: 'cargando' }));
    pedirRef.current().then(
      (datos) => vigente && setEstado({ estado: 'listo', datos }),
      (err: unknown) =>
        vigente &&
        setEstado((e) => ({ estado: 'error', datos: e.datos, error: err instanceof Error ? err.message : 'Algo falló.' })),
    );
    return () => {
      vigente = false;
    };
  }, [vuelta, ...deps]);

  const recargar = useCallback(() => setVuelta((v) => v + 1), []);

  if (estado.estado === 'listo') return { estado: 'listo', datos: estado.datos as T, recargar };
  if (estado.estado === 'error') return { estado: 'error', error: estado.error ?? 'Algo falló.', datos: estado.datos, recargar };
  return { estado: 'cargando', datos: estado.datos, recargar };
}
