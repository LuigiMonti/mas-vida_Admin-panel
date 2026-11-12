import { useEffect, useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Crown, Pencil, SearchX, Trash2, UsersRound } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip, FilterChip } from '@/components/ui/Chip';
import { SearchInput, TextField } from '@/components/ui/Field';
import { MotivoDialog } from '@/components/ui/MotivoDialog';
import { PageTitle } from '@/components/ui/PageTitle';
import { Avatar } from '@/components/ui/Progress';
import { Alert, EmptyState, ErrorState } from '@/components/ui/States';
import { DataTable, type Column } from '@/components/ui/Table';
import type { ErrorPanel } from '@/datos/red';
import { puede } from '@/datos/sesion';
import { borrarGrupo, LARGO_MAXIMO_GRUPO, listarGrupos, listarMiembros, renombrarGrupo, validarNombreDeGrupo, type GrupoLiga } from '@/datos/tusLigas';
import { useConsulta } from '@/datos/useConsulta';
import { fecha, numero } from '@/lib/formato';

type Filtro = 'todos' | 'vacios' | 'uno';
const FILTROS: Record<Filtro, { label: string; pasa: (g: GrupoLiga) => boolean }> = {
  todos: { label: 'Todos', pasa: () => true },
  vacios: { label: 'Sin miembros', pasa: (g) => g.miembros === 0 },
  uno: { label: 'Un solo miembro', pasa: (g) => g.miembros === 1 },
};

const COLUMNAS: Column<GrupoLiga>[] = [
  {
    key: 'nombre',
    header: 'Grupo',
    render: (g) => (
      <div className="min-w-0 max-w-[340px]">
        <div className="truncate font-semibold" title={g.nombre}>
          {g.nombre}
        </div>
        <div className="font-mono text-[11.5px] text-text-muted">{g.codigo}</div>
      </div>
    ),
  },
  { key: 'creador', header: 'Lo creó', render: (g) => (g.creado_por ? <span className="whitespace-nowrap">{g.creado_por.nombre}</span> : <span className="text-text-muted">Cuenta dada de baja</span>) },
  { key: 'creado', header: 'Creado', render: (g) => <span className="whitespace-nowrap text-text-muted">{fecha(g.creado_en)}</span> },
  {
    key: 'miembros',
    header: 'Miembros',
    numeric: true,
    render: (g) => (g.miembros === 0 ? <Chip tone="warning">Vacío</Chip> : <span className="font-display font-bold tabular-nums">{g.miembros}</span>),
  },
];

/* ----------------------------------------------------------------- el grupo elegido */

function PanelGrupo({ g, onCambio }: { g: GrupoLiga; onCambio: (aviso: string, borrado: boolean) => void }) {
  const miembros = useConsulta(() => listarMiembros(g.id), [g.id]);
  const [dialogo, setDialogo] = useState<'renombrar' | 'borrar' | null>(null);
  const [nombre, setNombre] = useState(g.nombre);
  const [error, setError] = useState<ErrorPanel>();
  const moderar = puede('moderar_ligas');
  const vivo = validarNombreDeGrupo(nombre);

  useEffect(() => {
    setNombre(g.nombre);
    setError(undefined);
  }, [g.id, g.nombre]);

  return (
    <Card className="lg:sticky lg:top-24">
      <CardHeader title={g.nombre} icon={UsersRound} description={`Código ${g.codigo} · creado el ${fecha(g.creado_en)}`} />
      {g.miembros === 0 && (
        <Alert tone="warning" className="mb-4">
          Este grupo quedó sin miembros. Un grupo se borra solo cuando sale el último: este se puede borrar desde aquí.
        </Alert>
      )}
      <div className="mb-2 text-[12px] font-bold tracking-[0.08em] text-text-muted uppercase">Miembros, por puntos del mes</div>
      {miembros.estado === 'error' ? (
        <ErrorState description={miembros.error} onRetry={miembros.recargar} />
      ) : !miembros.datos ? (
        <div className="h-28 animate-pulse rounded-inner bg-surface-muted" aria-busy />
      ) : miembros.datos.length === 0 ? (
        <p className="text-[13px] text-text-muted">Nadie.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {miembros.datos.map((m, i) => (
            <li key={m.usuario_id}>
              <Link to={`/usuarios/${m.usuario_id}`} className="group flex items-center gap-2.5 rounded-inner bg-surface-muted px-3 py-2">
                <span className="w-5 text-center font-display text-[12.5px] font-bold text-text-muted tabular-nums">{i + 1}</span>
                <Avatar name={m.nombre} seed={m.usuario_id} size="sm" />
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-1.5">
                    <span className="truncate font-semibold group-hover:text-primary group-hover:underline">{m.nombre}</span>
                    {m.es_creador && <Crown size={13} className="shrink-0 text-accent" aria-label="Creó el grupo" />}
                  </div>
                  <div className="font-mono text-[11.5px] text-text-muted">{m.nombre_de_miembro ?? 'sin nombre de miembro'}</div>
                </div>
                <span className="font-display text-[13px] font-bold tabular-nums">{numero(m.puntos_mes)}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {moderar ? (
        <div className="mt-5 flex flex-wrap gap-2 border-t border-border pt-4">
          <Button size="sm" variant="secondary" icon={Pencil} onClick={() => setDialogo('renombrar')}>
            Cambiar el nombre
          </Button>
          <button type="button" onClick={() => setDialogo('borrar')} className="inline-flex h-8 items-center gap-1.5 rounded-full px-3.5 text-[13px] font-semibold text-danger transition-colors hover:bg-danger-tint">
            <Trash2 size={15} aria-hidden /> Borrar el grupo
          </button>
        </div>
      ) : (
        <Alert tone="info" className="mt-5">
          Tu rol solo puede ver Tus Ligas.
        </Alert>
      )}

      <MotivoDialog
        open={dialogo === 'renombrar'}
        title="Cambiar el nombre del grupo"
        description="Para un nombre que no puede quedarse. Sus miembros ven el nuevo en la app; el código y el ranking no cambian."
        confirmLabel="Cambiar el nombre"
        sugerencias={['Nombre ofensivo', 'Usa el nombre de una marca']}
        bloqueado={!!vivo || nombre.trim() === g.nombre}
        onClose={() => setDialogo(null)}
        onError={setError}
        onConfirm={async (motivo) => {
          const nuevo = await renombrarGrupo(g.id, nombre, motivo);
          onCambio(`El grupo ${g.codigo} ahora se llama «${nuevo.nombre}».`, false);
        }}
      >
        <TextField
          label="Nombre nuevo"
          value={nombre}
          maxLength={LARGO_MAXIMO_GRUPO + 10}
          onChange={(e) => setNombre(e.target.value)}
          error={error?.campos?.nombre ?? vivo ?? undefined}
          hint={`${nombre.trim().length} de ${LARGO_MAXIMO_GRUPO}`}
        />
      </MotivoDialog>

      <MotivoDialog
        open={dialogo === 'borrar'}
        title="Borrar el grupo"
        description={`Saca a ${g.miembros === 1 ? 'su único miembro' : `sus ${g.miembros} miembros`} y el código ${g.codigo} deja de valer. Nadie pierde puntos. No se puede deshacer.`}
        confirmLabel="Borrar el grupo"
        peligro
        escribir={g.miembros > 0 ? g.codigo : undefined}
        sugerencias={['Grupo vacío', 'Nombre ofensivo y lo volvieron a poner', 'Lo pidió quien lo creó']}
        onClose={() => setDialogo(null)}
        onConfirm={async (motivo) => {
          await borrarGrupo(g.id, motivo);
          onCambio(`Grupo «${g.nombre}» borrado.`, true);
        }}
      />
    </Card>
  );
}

/* ----------------------------------------------------------------- página */

export function TusLigas() {
  const [params, setParams] = useSearchParams();
  const sel = params.get('g');
  const [q, setQ] = useState('');
  const [filtro, setFiltro] = useState<Filtro>('todos');
  const [vuelta, setVuelta] = useState(0);
  const [aviso, setAviso] = useState<string>();
  const grupos = useConsulta(() => listarGrupos({ q }), [q, vuelta]);
  const todos = grupos.datos ?? [];
  const filas = todos.filter(FILTROS[filtro].pasa);
  const elegido = todos.find((g) => String(g.id) === sel);

  return (
    <>
      <PageTitle title="Tus" accent="Ligas" description="Los grupos que arma cada persona: con o sin póliza y sin premios. Aquí se modera: cambiar un nombre que no puede quedarse o borrar un grupo." />
      {aviso && (
        <Alert tone="success" className="mb-5">
          {aviso}
        </Alert>
      )}
      <div className="grid items-start gap-5 lg:grid-cols-[1fr_400px]">
        <Card>
          <div className="mb-5 flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap gap-2">
              {(Object.keys(FILTROS) as Filtro[]).map((f) => (
                <FilterChip key={f} selected={filtro === f} onClick={() => setFiltro(f)} count={grupos.datos ? todos.filter(FILTROS[f].pasa).length : undefined}>
                  {FILTROS[f].label}
                </FilterChip>
              ))}
            </div>
            <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Nombre, código o usuario_id de un miembro" className="w-full sm:w-80" aria-label="Buscar grupo" />
          </div>
          {grupos.estado === 'error' ? (
            <ErrorState description={grupos.error} onRetry={grupos.recargar} />
          ) : !grupos.datos ? (
            <div className="flex flex-col gap-2" aria-busy>
              {[0, 1, 2, 3].map((i) => (
                <div key={i} className="h-12 animate-pulse rounded-inner bg-surface-muted" />
              ))}
            </div>
          ) : (
            <DataTable
              columns={COLUMNAS}
              rows={filas}
              rowKey={(g) => String(g.id)}
              selectedKey={sel ?? undefined}
              onRowClick={(g) => {
                setAviso(undefined);
                setParams({ g: String(g.id) }, { replace: true });
              }}
              caption="Grupos de Tus Ligas"
              empty={q ? <EmptyState icon={SearchX} title="No hay grupos con esa búsqueda" /> : <EmptyState icon={UsersRound} title="No hay grupos en este filtro" />}
            />
          )}
        </Card>

        {elegido ? (
          <PanelGrupo
            g={elegido}
            onCambio={(texto, borrado) => {
              setAviso(texto);
              if (borrado) setParams({}, { replace: true });
              setVuelta((v) => v + 1);
            }}
          />
        ) : (
          <Card>
            <EmptyState icon={UsersRound} title="Elige un grupo" description="Haz clic en una fila para ver sus miembros y moderarlo." />
          </Card>
        )}
      </div>
    </>
  );
}
