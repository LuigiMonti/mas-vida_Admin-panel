import { useMemo, useState } from 'react';
import { Link } from 'react-router';
import { History, Lock, SearchX } from 'lucide-react';
import { Card } from '@/components/ui/Card';
import { Chip, FilterChip, type ChipTone } from '@/components/ui/Chip';
import { SearchInput } from '@/components/ui/Field';
import { PageTitle } from '@/components/ui/PageTitle';
import { Avatar } from '@/components/ui/Progress';
import { EmptyState, ErrorState } from '@/components/ui/States';
import { DataTable, type Column } from '@/components/ui/Table';
import { listarBitacora, type EntradaBitacora, type TipoAccion } from '@/datos/bitacora';
import { puede } from '@/datos/sesion';
import { useConsulta } from '@/datos/useConsulta';
import { fechaHora } from '@/lib/formato';

const ACCION: Record<TipoAccion, { label: string; tone: ChipTone }> = {
  verificar_poliza: { label: 'Verificó póliza', tone: 'success' },
  rechazar_poliza: { label: 'Rechazó póliza', tone: 'danger' },
  ajuste_puntos: { label: 'Ajuste de puntos', tone: 'warning' },
  ajuste_monedas: { label: 'Ajuste de monedas', tone: 'coin' },
  editar_objetivo: { label: 'Objetivo semanal', tone: 'primary' },
  correr_cierre: { label: 'Corrió un cierre', tone: 'primary' },
  editar_reglas: { label: 'Reglas de puntaje', tone: 'primary' },
};

type Grupo = 'todas' | 'polizas' | 'ajustes' | 'config';
const GRUPOS: Record<Grupo, { label: string; acciones?: TipoAccion[] }> = {
  todas: { label: 'Todas' },
  polizas: { label: 'Pólizas', acciones: ['verificar_poliza', 'rechazar_poliza'] },
  ajustes: { label: 'Ajustes', acciones: ['ajuste_puntos', 'ajuste_monedas'] },
  config: { label: 'Configuración y cierres', acciones: ['editar_objetivo', 'editar_reglas', 'correr_cierre'] },
};

const COLUMNAS: Column<EntradaBitacora>[] = [
  { key: 'cuando', header: 'Cuándo', render: (e) => <span className="whitespace-nowrap">{fechaHora(e.creado_en)}</span> },
  {
    key: 'autor',
    header: 'Quién',
    render: (e) => (
      <div className="flex items-center gap-2">
        <Avatar name={e.autor.split('@')[0]!} seed={e.autor} size="sm" />
        <span className="truncate">{e.autor}</span>
      </div>
    ),
  },
  { key: 'accion', header: 'Acción', render: (e) => <Chip tone={ACCION[e.accion].tone}>{ACCION[e.accion].label}</Chip> },
  {
    key: 'objetivo',
    header: 'Sobre',
    render: (e) =>
      /^u_[0-9a-f]+$/.test(e.objetivo) ? (
        <Link to={`/usuarios/${e.objetivo}`} className="font-mono text-[12.5px] font-semibold text-primary hover:underline" onClick={(ev) => ev.stopPropagation()}>
          {e.objetivo}
        </Link>
      ) : (
        <span className="whitespace-nowrap">{e.objetivo}</span>
      ),
  },
  { key: 'detalle', header: 'Detalle', render: (e) => <span className="block max-w-[460px] text-text-muted">{e.detalle}</span> },
];

export function Bitacora() {
  const entradas = useConsulta(() => listarBitacora());
  const [grupo, setGrupo] = useState<Grupo>('todas');
  const [q, setQ] = useState('');

  const filas = useMemo(() => {
    const acciones = GRUPOS[grupo].acciones;
    const t = q.trim().toLowerCase();
    return (entradas.datos ?? [])
      .filter((e) => !acciones || acciones.includes(e.accion))
      .filter((e) => !t || [e.autor, e.objetivo, e.detalle].some((v) => v.toLowerCase().includes(t)));
  }, [entradas.datos, grupo, q]);

  if (!puede('ver_bitacora')) {
    return (
      <>
        <PageTitle title="Bitácora" />
        <Card>
          <EmptyState icon={Lock} title="Solo admin puede ver la bitácora" />
        </Card>
      </>
    );
  }

  return (
    <>
      <PageTitle title="Bitácora de" accent="acciones" description="Quién hizo qué y cuándo. Se escribe sola en cada acción del panel; no se edita ni se borra." />
      <Card>
        <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(GRUPOS) as Grupo[]).map((g) => (
              <FilterChip
                key={g}
                selected={grupo === g}
                onClick={() => setGrupo(g)}
                count={entradas.datos ? entradas.datos.filter((e) => !GRUPOS[g].acciones || GRUPOS[g].acciones!.includes(e.accion)).length : undefined}
              >
                {GRUPOS[g].label}
              </FilterChip>
            ))}
          </div>
          <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Correo, usuario_id o detalle" className="w-full sm:w-72" aria-label="Buscar en la bitácora" />
        </div>
        {entradas.estado === 'error' ? (
          <ErrorState description={entradas.error} onRetry={entradas.recargar} />
        ) : !entradas.datos ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-12 animate-pulse rounded-inner bg-surface-muted" />
            ))}
          </div>
        ) : (
          <DataTable
            columns={COLUMNAS}
            rows={filas}
            rowKey={(e) => String(e.id)}
            caption="Bitácora de acciones"
            empty={q ? <EmptyState icon={SearchX} title="Nada coincide con esa búsqueda" /> : <EmptyState icon={History} title="Todavía no hay acciones registradas" />}
          />
        )}
      </Card>
    </>
  );
}
