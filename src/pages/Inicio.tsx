import { useNavigate } from 'react-router';
import { CalendarCheck, CalendarClock, Coins, FileCheck2, Gift, ScanLine, Search, ShieldCheck, Target, Trophy, Users } from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, MetricCard } from '@/components/ui/Card';
import { PageTitle } from '@/components/ui/PageTitle';
import { Alert, ErrorState } from '@/components/ui/States';
import { obtenerResumen, type ResumenPanel } from '@/datos/resumen';
import { useConsulta } from '@/datos/useConsulta';
import { fechaHora, numero, porcentaje } from '@/lib/formato';

function MetricaCargando() {
  return <div className="h-[132px] animate-pulse rounded-card bg-surface shadow-card" aria-hidden />;
}

function Metricas({ r }: { r: ResumenPanel }) {
  return (
    <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
      <MetricCard
        variant="feature"
        label="Usuarios activos"
        value={numero(r.usuarios_activos)}
        icon={Users}
        detail={`de ${numero(r.usuarios_total)} · sincronizaron en los últimos 7 días`}
      />
      <MetricCard
        label="Con póliza verificada"
        value={porcentaje(r.polizas_verificadas, r.usuarios_total)}
        icon={ShieldCheck}
        detail={`${numero(r.polizas_verificadas)} cuentas · ${r.polizas_pendientes} pendientes`}
      />
      <MetricCard
        label="Cumplieron el objetivo"
        value={numero(r.objetivo.cumplieron)}
        icon={Target}
        detail={`de ${numero(r.objetivo.evaluados)} · Semana ${r.objetivo.semana}`}
      />
      <MetricCard
        label="Monedas emitidas"
        value={numero(r.monedas.emitidas)}
        icon={Coins}
        detail={`${numero(r.monedas.vencidas)} vencidas al cerrar la season anterior`}
      />
    </div>
  );
}

function Atencion({ r }: { r: ResumenPanel }) {
  const c = r.cierre;
  return (
    <div className="flex flex-col gap-2.5">
      {r.version_regla_activa === null ? (
        <Alert tone="danger">No hay una VersionRegla activa: el sync está respondiendo 500.</Alert>
      ) : null}
      {c.ultima_corrida === null ? (
        <Alert tone="danger">El programador todavía no ha corrido nunca.</Alert>
      ) : !c.ultima_corrida_ok ? (
        <Alert tone="danger">La última corrida del programador falló ({fechaHora(c.ultima_corrida)}).</Alert>
      ) : (
        <Alert tone="success">El programador corrió bien el {fechaHora(c.ultima_corrida)}.</Alert>
      )}
      {c.semanas_pendientes > 0 ? (
        <Alert tone="warning">
          {c.semanas_pendientes === 1 ? 'Hay 1 semana sin cerrar.' : `Hay ${c.semanas_pendientes} semanas sin cerrar.`}
        </Alert>
      ) : (
        <Alert tone="info">Todas las semanas están cerradas. Próximo cierre: {c.proximo}.</Alert>
      )}
      {r.polizas_pendientes > 0 && r.pendiente_mas_vieja_dias !== null && (
        <Alert tone="warning">
          {r.polizas_pendientes} pólizas esperan verificación. La más vieja lleva {r.pendiente_mas_vieja_dias} días.
        </Alert>
      )}
    </div>
  );
}

export function Inicio() {
  const resumen = useConsulta(obtenerResumen);
  const ir = useNavigate();

  return (
    <>
      <PageTitle title="Hola," accent="equipo" description="Lo que pide atención hoy en +vida." />

      {resumen.estado === 'error' ? (
        <Card>
          <ErrorState description={resumen.error} onRetry={resumen.recargar} />
        </Card>
      ) : !resumen.datos ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
          <MetricaCargando />
          <MetricaCargando />
          <MetricaCargando />
          <MetricaCargando />
        </div>
      ) : (
        <>
          <Metricas r={resumen.datos} />
          <div className="mt-5 grid gap-5 lg:grid-cols-[1.4fr_1fr]">
            <Card>
              <CardHeader title="Pide atención" icon={CalendarClock} />
              <Atencion r={resumen.datos} />
            </Card>
            <Card>
              <CardHeader title="Accesos rápidos" />
              <div className="flex flex-wrap gap-2">
                <Button variant="secondary" size="sm" icon={FileCheck2} onClick={() => ir('/polizas')}>
                  Verificar pólizas
                </Button>
                <Button variant="secondary" size="sm" icon={Search} onClick={() => ir('/usuarios')}>
                  Buscar usuario
                </Button>
                <Button variant="secondary" size="sm" icon={CalendarClock} onClick={() => ir('/cierres')}>
                  Estado del cierre
                </Button>
                <Button variant="secondary" size="sm" icon={CalendarCheck} onClick={() => ir('/objetivos')}>
                  Semanas y metas
                </Button>
                <Button variant="secondary" size="sm" icon={ScanLine} onClick={() => ir('/cupones')}>
                  Validar cupón
                </Button>
                <Button variant="secondary" size="sm" icon={Gift} onClick={() => ir('/premios/nuevo')}>
                  Nuevo premio
                </Button>
                <Button variant="secondary" size="sm" icon={Trophy} onClick={() => ir('/liga')}>
                  La Liga del mes
                </Button>
              </div>
            </Card>
          </div>
        </>
      )}
    </>
  );
}
