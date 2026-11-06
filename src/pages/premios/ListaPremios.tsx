import { useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router';
import { Archive, ArchiveRestore, FileUp, Gift, Plus, SearchX, Sparkles } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card } from '@/components/ui/Card';
import { Chip, FilterChip } from '@/components/ui/Chip';
import { Dialog } from '@/components/ui/Dialog';
import { SearchInput, SelectField, TextAreaField } from '@/components/ui/Field';
import { LogoComercio } from '@/components/ui/Logo';
import { PageTitle } from '@/components/ui/PageTitle';
import { ProgressBar } from '@/components/ui/Progress';
import { Alert, EmptyState, ErrorState } from '@/components/ui/States';
import { DataTable, type Column } from '@/components/ui/Table';
import '@/datos/cupones';
import '@/datos/patrocinios';
import { cambiarActivo, CATEGORIAS, importarCatalogo, listarPremios, type EstadoPremio, type FilaPremio, type ResultadoImportacion } from '@/datos/premios';
import { ErrorPanel, hoyGT } from '@/datos/red';
import { puede } from '@/datos/sesion';
import { useConsulta } from '@/datos/useConsulta';
import { fecha, numero } from '@/lib/formato';

const ESTADOS: Array<{ k: EstadoPremio; label: string }> = [
  { k: 'activos', label: 'Activos' },
  { k: 'vencidos', label: 'Vencidos' },
  { k: 'apagados', label: 'Archivados' },
  { k: 'todos', label: 'Todos' },
];

function ImportarCatalogo({ open, onClose, onListo }: { open: boolean; onClose: () => void; onListo: (m: string) => void }) {
  const [texto, setTexto] = useState('');
  const [vista, setVista] = useState<ResultadoImportacion>();
  const [error, setError] = useState<string>();
  const [trabajando, setTrabajando] = useState(false);

  const correr = async (aplicar: boolean) => {
    setTrabajando(true);
    setError(undefined);
    try {
      const r = await importarCatalogo(texto, aplicar);
      if (aplicar && !r.errores.length) {
        onListo(`Catálogo importado: ${r.crear.length} creados, ${r.actualizar.length} actualizados.`);
        setTexto('');
        setVista(undefined);
        onClose();
      } else setVista(r);
    } catch (e) {
      setError(e instanceof ErrorPanel ? e.message : 'No se pudo leer el archivo.');
    } finally {
      setTrabajando(false);
    }
  };

  return (
    <Dialog
      open={open}
      onClose={onClose}
      busy={trabajando}
      width={640}
      title="Importar catálogo"
      description="El mismo JSON que usa importar_premios (assets/mock/premios.json). Un premio con el mismo nombre se actualiza; si uno viene mal, no se guarda nada."
      footer={
        <>
          <Button variant="secondary" onClick={onClose} disabled={trabajando}>
            Cancelar
          </Button>
          <Button variant="secondary" onClick={() => correr(false)} disabled={trabajando || !texto.trim()}>
            Revisar
          </Button>
          <Button icon={FileUp} onClick={() => correr(true)} disabled={trabajando || !vista || vista.errores.length > 0}>
            Importar
          </Button>
        </>
      }
    >
      <div className="flex flex-col gap-3">
        <label className="inline-flex w-fit cursor-pointer items-center gap-2 rounded-full border border-primary-soft px-3.5 py-1.5 text-[13px] font-semibold text-primary hover:bg-primary-tint">
          <FileUp size={15} aria-hidden /> Elegir archivo .json
          <input
            type="file"
            accept="application/json,.json"
            className="sr-only"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (f) {
                setTexto(await f.text());
                setVista(undefined);
              }
            }}
          />
        </label>
        <TextAreaField
          label="O pega el JSON"
          value={texto}
          onChange={(e) => {
            setTexto(e.target.value);
            setVista(undefined);
          }}
          className="min-h-36 font-mono text-[12px]"
          placeholder='{ "premios": [ { "nombre": "…", "costo_monedas": 40, … } ] }'
        />
        {error && <Alert tone="danger">{error}</Alert>}
        {vista && vista.errores.length > 0 && (
          <Alert tone="danger">
            <strong>No se puede importar:</strong>
            <ul className="mt-1 list-disc pl-5">
              {vista.errores.slice(0, 6).map((e) => (
                <li key={e}>{e}</li>
              ))}
            </ul>
          </Alert>
        )}
        {vista && vista.errores.length === 0 && (
          <Alert tone="info">
            Se van a crear <strong>{vista.crear.length}</strong> y actualizar <strong>{vista.actualizar.length}</strong> premios.
            {vista.crear.length > 0 && <div className="mt-1 text-[12.5px]">Nuevos: {vista.crear.join(', ')}</div>}
          </Alert>
        )}
      </div>
    </Dialog>
  );
}

export function ListaPremios() {
  const [params, setParams] = useSearchParams();
  const estado = (params.get('estado') as EstadoPremio | null) ?? 'activos';
  const categoria = params.get('categoria') ?? '';
  const [q, setQ] = useState('');
  const [vuelta, setVuelta] = useState(0);
  const [importar, setImportar] = useState(false);
  const [aviso, setAviso] = useState<{ tono: 'success' | 'danger'; texto: string }>();
  const ir = useNavigate();
  const admin = puede('editar_premios');
  const premios = useConsulta(() => listarPremios({ q, categoria: categoria || undefined, estado }), [q, categoria, estado, vuelta]);
  const hoy = hoyGT();

  const set = (k: string, v: string) => {
    const p = new URLSearchParams(params);
    if (v) p.set(k, v);
    else p.delete(k);
    setParams(p, { replace: true });
  };

  const alternar = async (f: FilaPremio) => {
    try {
      await cambiarActivo(f.id, !f.activo);
      setAviso({ tono: 'success', texto: f.activo ? `${f.nombre} archivado: ya no sale en la Tienda.` : `${f.nombre} está otra vez en la Tienda.` });
      setVuelta((v) => v + 1);
    } catch (e) {
      setAviso({ tono: 'danger', texto: e instanceof ErrorPanel ? e.message : 'No se pudo cambiar.' });
    }
  };

  const columnas: Column<FilaPremio>[] = [
    {
      key: 'premio',
      header: 'Premio',
      render: (p) => (
        <div className="flex items-center gap-3">
          <LogoComercio foto={p.foto} fondo={p.fondo} nombre={p.nombre} />
          <div className="min-w-0">
            <div className="flex items-center gap-1.5 font-semibold">
              {p.nombre}
              {p.destacado && <Sparkles size={14} className="text-accent" aria-label="Destacado" />}
            </div>
            <div className="truncate text-[12px] text-text-muted">{p.descripcion}</div>
          </div>
        </div>
      ),
    },
    { key: 'categoria', header: 'Categoría', render: (p) => <span className="text-[13px] font-semibold text-secondary">{p.categoria || '—'}</span> },
    { key: 'costo', header: 'Costo', numeric: true, render: (p) => <span className="font-display font-bold text-coin">{p.costo_monedas}</span> },
    {
      key: 'canjeados',
      header: 'Canjeados',
      render: (p) =>
        p.cupo ? (
          <div className="w-28">
            <div className="mb-1 flex justify-between text-[12px] tabular-nums">
              <span className="font-semibold">{p.canjeados}</span>
              <span className="text-text-muted">de {p.cupo}</span>
            </div>
            <ProgressBar value={p.canjeados} max={p.cupo} size="sm" label={`Cupo de ${p.nombre}`} />
          </div>
        ) : (
          <span className="tabular-nums">
            <strong>{numero(p.canjeados)}</strong> <span className="text-[12px] text-text-muted">· {p.usados} usados</span>
          </span>
        ),
    },
    {
      key: 'estado',
      header: 'Estado',
      render: (p) =>
        !p.activo ? (
          <Chip tone="neutral" dot>
            Archivado
          </Chip>
        ) : p.vigente_hasta && p.vigente_hasta < hoy ? (
          <Chip tone="warning" dot>
            Venció el {fecha(p.vigente_hasta)}
          </Chip>
        ) : (
          <Chip tone="success" dot>
            {p.vigente_hasta ? `Hasta el ${fecha(p.vigente_hasta)}` : 'Sin fecha'}
          </Chip>
        ),
    },
    {
      key: 'accion',
      header: '',
      align: 'right',
      render: (p) =>
        admin ? (
          <Button
            size="sm"
            variant="ghost"
            icon={p.activo ? Archive : ArchiveRestore}
            onClick={(e) => {
              e.stopPropagation();
              void alternar(p);
            }}
          >
            {p.activo ? 'Archivar' : 'Prender'}
          </Button>
        ) : null,
    },
  ];

  return (
    <>
      <PageTitle
        title="Premios de la"
        accent="Tienda"
        description="El catálogo que ve la app. Un premio no se borra: se archiva, y los cupones que ya se dieron siguen valiendo."
        actions={
          admin ? (
            <>
              <Button variant="secondary" icon={FileUp} onClick={() => setImportar(true)}>
                Importar catálogo
              </Button>
              <Button icon={Plus} onClick={() => ir('/premios/nuevo')}>
                Nuevo premio
              </Button>
            </>
          ) : undefined
        }
      />
      {aviso && (
        <Alert tone={aviso.tono} className="mb-5">
          {aviso.texto}
        </Alert>
      )}
      <Card>
        <div className="mb-5 flex flex-wrap items-end justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {ESTADOS.map((e) => (
              <FilterChip key={e.k} selected={estado === e.k} onClick={() => set('estado', e.k === 'activos' ? '' : e.k)}>
                {e.label}
              </FilterChip>
            ))}
          </div>
          <div className="flex w-full flex-wrap gap-3 sm:w-auto">
            <div className="w-full sm:w-48">
              <SelectField label="Categoría" value={categoria} onChange={(e) => set('categoria', e.target.value)}>
                <option value="">Todas</option>
                {CATEGORIAS.map((c) => (
                  <option key={c}>{c}</option>
                ))}
              </SelectField>
            </div>
            <SearchInput value={q} onChange={(e) => setQ(e.target.value)} placeholder="Buscar premio o comercio" className="w-full self-end sm:w-64" aria-label="Buscar premio" />
          </div>
        </div>
        {premios.estado === 'error' ? (
          <ErrorState description={premios.error} onRetry={premios.recargar} />
        ) : !premios.datos ? (
          <div className="flex flex-col gap-2">
            {[0, 1, 2, 3, 4].map((i) => (
              <div key={i} className="h-14 animate-pulse rounded-inner bg-surface-muted" />
            ))}
          </div>
        ) : (
          <DataTable
            columns={columnas}
            rows={premios.datos}
            rowKey={(p) => String(p.id)}
            onRowClick={(p) => ir(`/premios/${p.id}`)}
            caption="Premios"
            empty={q ? <EmptyState icon={SearchX} title="No hay premios con esa búsqueda" /> : <EmptyState icon={Gift} title="No hay premios en este estado" />}
          />
        )}
      </Card>
      <ImportarCatalogo
        open={importar}
        onClose={() => setImportar(false)}
        onListo={(m) => {
          setAviso({ tono: 'success', texto: m });
          setVuelta((v) => v + 1);
        }}
      />
    </>
  );
}
