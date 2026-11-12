import { useState } from 'react';
import { Link, useSearchParams } from 'react-router';
import { Footprints, ShieldCheck, Smartphone } from 'lucide-react';
import { Card, CardHeader } from '@/components/ui/Card';
import { Chip, type ChipTone } from '@/components/ui/Chip';
import { PageTitle } from '@/components/ui/PageTitle';
import { Avatar } from '@/components/ui/Progress';
import { Alert, EmptyState, ErrorState } from '@/components/ui/States';
import { DataTable, type Column } from '@/components/ui/Table';
import { Tabs } from '@/components/ui/Tabs';
import {
  listarDatosCompartidos,
  listarDiasAtipicos,
  listarParaRevisar,
  NOMBRE_MOTIVO,
  type CuentaParaRevisar,
  type DiaAtipico,
  type MotivoRevision,
} from '@/datos/antifraude';
import { PASOS_DIA_ATIPICO, VENTANA_REZAGADOS_DIAS } from '@/datos/cuentas';
import { puede } from '@/datos/sesion';
import { useConsulta } from '@/datos/useConsulta';
import { fecha, fechaCorta, numero } from '@/lib/formato';
import { EstadoPolizaChip } from '../usuarios/comun';
import { TablaBloqueos } from './Bloqueos';

type Pestana = 'revisar' | 'atipicos' | 'compartidos' | 'bloqueos';

const TONO_MOTIVO: Record<MotivoRevision, ChipTone> = { dia_atipico: 'warning', retroactivo_denegado: 'danger', intentos: 'danger', datos_compartidos: 'warning' };

function Cargando() {
  return <div className="h-40 animate-pulse rounded-inner bg-surface-muted" aria-busy />;
}

/* ----------------------------------------------------------------- para revisar */

function ParaRevisar() {
  const cuentas = useConsulta(listarParaRevisar);
  if (cuentas.estado === 'error') return <ErrorState description={cuentas.error} onRetry={cuentas.recargar} />;
  if (!cuentas.datos) return <Cargando />;
  if (cuentas.datos.length === 0) return <EmptyState icon={ShieldCheck} title="No hay cuentas para revisar" description="Aparecen aquí por un día atípico, un retroactivo denegado, muchos intentos o datos repetidos en otra cuenta." />;
  return (
    <ul className="flex flex-col gap-2">
      {cuentas.datos.map((c: CuentaParaRevisar) => (
        <li key={c.usuario_id} className="grid gap-3 rounded-inner bg-surface-muted px-4 py-3.5 md:grid-cols-[260px_1fr] md:items-start">
          <Link to={`/usuarios/${c.usuario_id}`} className="group flex items-center gap-2.5">
            <Avatar name={c.nombre} seed={c.usuario_id} size="sm" />
            <div className="min-w-0">
              <div className="truncate font-semibold group-hover:text-primary group-hover:underline">{c.nombre}</div>
              <div className="flex items-center gap-2">
                <span className="font-mono text-[11.5px] text-text-muted">{c.usuario_id}</span>
                <EstadoPolizaChip estado={c.estado_poliza} />
              </div>
            </div>
          </Link>
          <ul className="flex flex-col gap-1.5">
            {c.motivos.map((m, i) => (
              <li key={i} className="flex flex-wrap items-center gap-2 text-[13px]">
                <Chip tone={TONO_MOTIVO[m.tipo]}>{NOMBRE_MOTIVO[m.tipo]}</Chip>
                <span className="text-text-muted">{m.detalle}</span>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------------------------------------------- días atípicos */

function DiasAtipicos() {
  const dias = useConsulta(listarDiasAtipicos);
  const admin = puede('ajustar_ledger');
  const columnas: Column<DiaAtipico>[] = [
    {
      key: 'cuenta',
      header: 'Cuenta',
      render: (d) => (
        <Link to={`/usuarios/${d.usuario_id}?tab=sync`} className="group flex items-center gap-2.5">
          <Avatar name={d.nombre} seed={d.usuario_id} size="sm" />
          <div>
            <div className="font-semibold group-hover:text-primary group-hover:underline">{d.nombre}</div>
            <div className="font-mono text-[11.5px] text-text-muted">{d.usuario_id}</div>
          </div>
        </Link>
      ),
    },
    { key: 'fecha', header: 'Día', render: (d) => <span className="whitespace-nowrap">{fechaCorta(d.fecha)}</span> },
    { key: 'pasos', header: 'Pasos', numeric: true, render: (d) => <span className="font-display font-bold text-warning">{numero(d.pasos)}</span> },
    { key: 'puntos', header: 'Puntos acreditados', numeric: true, render: (d) => (d.puntos_dia > 0 ? <span className="font-semibold">{d.puntos_dia}</span> : <Chip tone="neutral">Revertido</Chip>) },
    {
      key: 'accion',
      header: '',
      align: 'right',
      render: (d) =>
        d.puntos_dia <= 0 ? null : !d.en_ventana ? (
          <span className="text-[12.5px] text-text-muted">Ya pasaron {VENTANA_REZAGADOS_DIAS} días</span>
        ) : admin ? (
          <Link to={`/usuarios/${d.usuario_id}?tab=puntos&revertir=${d.fecha}`} className="text-[13px] font-semibold text-primary hover:underline">
            Revertir el día →
          </Link>
        ) : (
          <Link to={`/usuarios/${d.usuario_id}?tab=puntos`} className="text-[13px] font-semibold text-primary hover:underline">
            Ver ledger →
          </Link>
        ),
    },
  ];
  if (dias.estado === 'error') return <ErrorState description={dias.error} onRetry={dias.recargar} />;
  if (!dias.datos) return <Cargando />;
  return (
    <DataTable
      columns={columnas}
      rows={dias.datos}
      rowKey={(d) => `${d.usuario_id}-${d.fecha}`}
      caption="Días atípicos"
      empty={<EmptyState icon={Footprints} title="Ningún día atípico" description={`Un día con más de ${numero(PASOS_DIA_ATIPICO)} pasos aparece aquí.`} />}
    />
  );
}

/* ----------------------------------------------------------------- mismos datos en varias cuentas */

function DatosCompartidos() {
  const casos = useConsulta(listarDatosCompartidos);
  if (casos.estado === 'error') return <ErrorState description={casos.error} onRetry={casos.recargar} />;
  if (!casos.datos) return <Cargando />;
  if (casos.datos.length === 0) return <EmptyState icon={Smartphone} title="Ninguna cuenta comparte datos con otra" description="Si el mismo teléfono manda sus datos de Salud a dos cuentas, aparece aquí." />;
  return (
    <ul className="flex flex-col gap-3">
      {casos.datos.map((c) => (
        <li key={c.id} className="rounded-inner bg-surface-muted p-4">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            <div className="flex items-center gap-2.5">
              <span className="grid size-9 place-items-center rounded-full bg-warning-tint text-warning">
                <Smartphone size={18} aria-hidden />
              </span>
              <div>
                <div className="font-semibold">{c.dispositivo}</div>
                <div className="text-[12.5px] text-text-muted">
                  {numero(c.muestras_en_comun)} muestras iguales · del {fecha(c.desde)} al {fecha(c.hasta)}
                </div>
              </div>
            </div>
            <Chip tone="warning">{c.cuentas.length} cuentas</Chip>
          </div>
          <ul className="grid gap-2 sm:grid-cols-2">
            {c.cuentas.map((u) => (
              <li key={u.usuario_id}>
                <Link to={`/usuarios/${u.usuario_id}?tab=sync`} className="group flex items-center gap-2.5 rounded-inner bg-surface px-3 py-2.5">
                  <Avatar name={u.nombre} seed={u.usuario_id} size="sm" />
                  <div className="min-w-0 flex-1">
                    <div className="truncate font-semibold group-hover:text-primary group-hover:underline">{u.nombre}</div>
                    <div className="font-mono text-[11.5px] text-text-muted">{u.usuario_id}</div>
                  </div>
                  <EstadoPolizaChip estado={u.estado_poliza} />
                </Link>
              </li>
            ))}
          </ul>
        </li>
      ))}
    </ul>
  );
}

/* ----------------------------------------------------------------- página */

const TEXTO: Record<Pestana, { titulo: string; descripcion: string }> = {
  revisar: { titulo: 'Cuentas para revisar', descripcion: 'Una fila por cuenta, con todo lo que la hace sospechosa. Las de más motivos van primero. Nada de aquí penaliza solo: revisar es decisión del equipo.' },
  atipicos: {
    titulo: 'Días atípicos',
    descripcion: `Días con más de ${numero(PASOS_DIA_ATIPICO)} pasos. El techo de 200 puntos al día limita el daño; un día se puede revertir dentro de los ${VENTANA_REZAGADOS_DIAS} días.`,
  },
  compartidos: { titulo: 'Mismos datos en varias cuentas', descripcion: 'Cuentas que recibieron las mismas muestras de Apple Salud: el mismo teléfono con dos cuentas. Los nombres de dispositivo son un dato personal.' },
  bloqueos: { titulo: 'Intentos y bloqueos', descripcion: 'Intentos fallidos que cuentan hoy para algún límite. Un bloqueo se libera solo; desbloquear antes sirve cuando alguien bloqueó a un titular probando su número de póliza.' },
};

export function Antifraude() {
  const [params, setParams] = useSearchParams();
  const pestana = (params.get('tab') as Pestana | null) ?? 'revisar';
  const [aviso, setAviso] = useState<string>();
  const t = TEXTO[pestana] ?? TEXTO.revisar;
  return (
    <>
      <PageTitle title="Anti" accent="fraude" description="Lo que conviene mirar antes de que alguien cobre por actividad que no hizo." />
      <Tabs
        label="Secciones de antifraude"
        active={pestana}
        onChange={(k) => {
          setAviso(undefined);
          setParams(k === 'revisar' ? {} : { tab: k }, { replace: true });
        }}
        tabs={[
          { key: 'revisar', label: 'Para revisar' },
          { key: 'atipicos', label: 'Días atípicos' },
          { key: 'compartidos', label: 'Datos compartidos' },
          { key: 'bloqueos', label: 'Intentos y bloqueos' },
        ]}
      />
      {aviso && (
        <Alert tone="success" className="mb-4">
          {aviso}
        </Alert>
      )}
      <Card>
        <CardHeader title={t.titulo} description={t.descripcion} />
        {pestana === 'atipicos' ? <DiasAtipicos /> : pestana === 'compartidos' ? <DatosCompartidos /> : pestana === 'bloqueos' ? <TablaBloqueos onCambio={setAviso} /> : <ParaRevisar />}
      </Card>
    </>
  );
}
