/*
 * Antifraude: intentos y bloqueos, días atípicos, datos de salud repetidos
 * entre cuentas y la lista de cuentas para revisar.
 * Futuro: /api/v1/admin/bloqueos/… y /api/v1/admin/antifraude/…
 *
 * Límite de intentos (contrato, "Límite de intentos"; users.IntentoFallido):
 *   vincular póliza: 5 rechazos al día por número de póliza (sumando todas las
 *                    cuentas) y 5 por hora por cuenta
 *   login:           5 contraseñas malas por minuto por cuenta y 30 por IP
 *   registro:        30 por hora por IP
 * Quien conoce un número de póliza puede bloquear a su titular un día con 5
 * intentos malos: por eso el panel puede desbloquear. Desbloquear borra los
 * intentos que cuentan para ese límite; no cambia nada más.
 *
 * El backend guarda la cuenta y el número de póliza como un hash, nunca en
 * claro: para decir de quién es un bloqueo tiene que comparar ese hash con
 * los de las cuentas y pólizas que conoce. Si no calza con ninguna, llega sin
 * `usuario_id` ni `policy_number` (alguien probando números que no existen).
 */
import { pedir } from './api';
import { registrar } from './bitacora';
import { cuentasDeMuestra, HOY, PASOS_DIA_ATIPICO, VENTANA_REZAGADOS_DIAS, type EstadoPoliza } from './cuentas';
import { conectado } from './modo';
import { copia, ErrorPanel, simularRed } from './red';
import { puede } from './sesion';
import { sumarDias } from './temporadas';
import { fecha as fechaLarga } from '@/lib/formato';

/* ================================================================= bloqueos */

export type TipoLimite = 'vincular_poliza' | 'vincular_cuenta' | 'login_cuenta' | 'login_ip' | 'registro_ip';

export const LIMITES: Record<TipoLimite, { nombre: string; regla: string }> = {
  vincular_poliza: { nombre: 'Vincular · por póliza', regla: '5 rechazos al día por número de póliza' },
  vincular_cuenta: { nombre: 'Vincular · por cuenta', regla: '5 rechazos por hora por cuenta' },
  login_cuenta: { nombre: 'Login · por cuenta', regla: '5 contraseñas malas por minuto' },
  login_ip: { nombre: 'Login · por IP', regla: '30 contraseñas malas por minuto desde una IP' },
  registro_ip: { nombre: 'Registro · por IP', regla: '30 registros por hora desde una IP' },
};

export interface Bloqueo {
  /** Identificador opaco (tipo + clave del límite). Nunca el hash en claro. */
  id: string;
  tipo: TipoLimite;
  /** De quién es, si el backend pudo reconocerlo. */
  usuario_id: string | null;
  policy_number: string | null;
  ip: string | null;
  intentos: number;
  maximo: number;
  primer_intento: string;
  ultimo_intento: string;
  /** Hasta cuándo no pasa ni lo correcto. null = todavía no llega al límite. */
  bloqueado_hasta: string | null;
}

export const estaBloqueado = (b: Pick<Bloqueo, 'bloqueado_hasta'>, ahora = new Date()) => !!b.bloqueado_hasta && new Date(b.bloqueado_hasta) > ahora;

const hace = (min: number) => new Date(Date.now() - min * 60_000).toISOString();
const en = (min: number) => new Date(Date.now() + min * 60_000).toISOString();

let bloqueos: Bloqueo[] = [
  // Alguien probó 5 fechas de nacimiento con la póliza de Lucía: su titular queda bloqueada un día.
  { id: 'vincular_poliza:7c1e', tipo: 'vincular_poliza', usuario_id: 'u_9e02', policy_number: 'GT-114-70412', ip: null, intentos: 5, maximo: 5, primer_intento: hace(190), ultimo_intento: hace(176), bloqueado_hasta: en(21 * 60) },
  { id: 'vincular_cuenta:a93f', tipo: 'vincular_cuenta', usuario_id: 'u_9e02', policy_number: null, ip: null, intentos: 5, maximo: 5, primer_intento: hace(38), ultimo_intento: hace(31), bloqueado_hasta: en(22) },
  { id: 'vincular_poliza:02bd', tipo: 'vincular_poliza', usuario_id: null, policy_number: null, ip: null, intentos: 5, maximo: 5, primer_intento: hace(400), ultimo_intento: hace(395), bloqueado_hasta: en(17 * 60) },
  { id: 'vincular_poliza:5e60', tipo: 'vincular_poliza', usuario_id: 'u_3a90', policy_number: 'GT-114-60877', ip: null, intentos: 2, maximo: 5, primer_intento: hace(95), ultimo_intento: hace(90), bloqueado_hasta: null },
  { id: 'registro_ip:190.56.74.12', tipo: 'registro_ip', usuario_id: null, policy_number: null, ip: '190.56.74.12', intentos: 30, maximo: 30, primer_intento: hace(26), ultimo_intento: hace(4), bloqueado_hasta: en(34) },
  { id: 'login_ip:181.174.107.9', tipo: 'login_ip', usuario_id: null, policy_number: null, ip: '181.174.107.9', intentos: 12, maximo: 30, primer_intento: hace(1), ultimo_intento: hace(0.2), bloqueado_hasta: null },
];

const mismoNumero = (a: string, b: string) => a.trim().toLowerCase() === b.trim().toLowerCase();

/** Intentos fallidos que cuentan hoy para algún límite, los bloqueados primero. */
export function listarBloqueos(filtro: { usuario_id?: string; policy_number?: string } = {}): Promise<Bloqueo[]> {
  if (conectado('antifraude')) return pedir<Bloqueo[]>('/api/v1/admin/bloqueos', { query: filtro });
  return simularRed(
    () =>
      copia(
        bloqueos
          .filter((b) => !filtro.usuario_id || b.usuario_id === filtro.usuario_id)
          .filter((b) => !filtro.policy_number || (!!b.policy_number && mismoNumero(b.policy_number, filtro.policy_number)))
          .sort((a, b) => Number(estaBloqueado(b)) - Number(estaBloqueado(a)) || b.ultimo_intento.localeCompare(a.ultimo_intento)),
      ),
    250,
  );
}

/** Borra los intentos de ese límite: lo correcto vuelve a pasar. */
export function desbloquear(id: string): Promise<void> {
  if (conectado('antifraude')) return pedir<void>(`/api/v1/admin/bloqueos/${encodeURIComponent(id)}/desbloquear`, { metodo: 'POST' });
  return simularRed(() => {
    if (!puede('atender_cuenta')) throw new ErrorPanel('Tu rol no puede desbloquear.');
    const b = bloqueos.find((x) => x.id === id);
    if (!b) throw new ErrorPanel('Ese bloqueo ya no existe: venció o alguien lo quitó.', undefined, { estado: 404 });
    bloqueos = bloqueos.filter((x) => x.id !== id);
    // En la bitácora va de quién es, nunca la clave del límite.
    registrar('desbloquear', b.usuario_id ?? b.ip ?? 'Sin cuenta conocida', `${LIMITES[b.tipo].nombre}${b.policy_number ? ` · ${b.policy_number}` : ''} · ${b.intentos} intentos borrados`);
  }, 500);
}

/** Para el inicio (mock). */
export function contarBloqueadosDeMuestra(): number {
  return bloqueos.filter((b) => estaBloqueado(b)).length;
}

/* ================================================================= días atípicos */

export interface DiaAtipico {
  usuario_id: string;
  nombre: string;
  fecha: string;
  pasos: number;
  /** Lo acreditado ese día (0 si ya se revirtió). */
  puntos_dia: number;
  /** Si todavía se puede revertir (dentro de los 14 días). */
  en_ventana: boolean;
}

/** Días con más de 60.000 pasos. Hoy el backend solo los anota en el log. */
export function listarDiasAtipicos(): Promise<DiaAtipico[]> {
  if (conectado('antifraude')) return pedir<DiaAtipico[]>('/api/v1/admin/antifraude/dias-atipicos');
  return simularRed(() => diasAtipicosDeMuestra());
}

function diasAtipicosDeMuestra(): DiaAtipico[] {
  const limite = sumarDias(HOY, -VENTANA_REZAGADOS_DIAS);
  return cuentasDeMuestra()
    .filter((c) => !c.dado_de_baja)
    .flatMap((c) => c.atipicos.map((a) => ({ usuario_id: c.usuario_id, nombre: c.nombre, fecha: a.fecha, pasos: a.pasos, puntos_dia: a.puntos_dia, en_ventana: a.fecha >= limite })))
    .sort((a, b) => b.fecha.localeCompare(a.fecha));
}

/* ================================================================= mismos datos en varias cuentas */

export interface DatosCompartidos {
  id: string;
  /** El dispositivo que mandó las muestras repetidas (dato personal). */
  dispositivo: string;
  /** Muestras con el mismo `external_id` (el UUID de HealthKit) en más de una cuenta. */
  muestras_en_comun: number;
  desde: string;
  hasta: string;
  cuentas: Array<{ usuario_id: string; nombre: string; estado_poliza: EstadoPoliza }>;
}

/**
 * Cuentas que reciben los mismos datos de salud: el mismo teléfono con dos
 * cuentas. Se detecta por `external_id` repetido entre cuentas (hoy solo es
 * único por cuenta), no por el nombre del dispositivo.
 */
export function listarDatosCompartidos(): Promise<DatosCompartidos[]> {
  if (conectado('antifraude')) return pedir<DatosCompartidos[]>('/api/v1/admin/antifraude/datos-compartidos');
  return simularRed(() => datosCompartidosDeMuestra());
}

function datosCompartidosDeMuestra(): DatosCompartidos[] {
  const porDispositivo = new Map<string, DatosCompartidos['cuentas']>();
  for (const c of cuentasDeMuestra()) {
    if (c.dado_de_baja) continue;
    for (const d of c.dispositivos) {
      if (d.tipo !== 'telefono') continue;
      porDispositivo.set(d.nombre, [...(porDispositivo.get(d.nombre) ?? []), { usuario_id: c.usuario_id, nombre: c.nombre, estado_poliza: c.estado_poliza }]);
    }
  }
  return [...porDispositivo.entries()]
    .filter(([, cuentas]) => cuentas.length > 1)
    .map(([dispositivo, cuentas], i) => ({ id: `dc_${i + 1}`, dispositivo, muestras_en_comun: 1840 + i * 310, desde: sumarDias(HOY, -9), hasta: sumarDias(HOY, -1), cuentas }));
}

/* ================================================================= cuentas para revisar */

export type MotivoRevision = 'dia_atipico' | 'retroactivo_denegado' | 'intentos' | 'datos_compartidos';

export const NOMBRE_MOTIVO: Record<MotivoRevision, string> = {
  dia_atipico: 'Día atípico',
  retroactivo_denegado: 'Retroactivo denegado',
  intentos: 'Muchos intentos',
  datos_compartidos: 'Mismos datos en otra cuenta',
};

export interface CuentaParaRevisar {
  usuario_id: string;
  nombre: string;
  estado_poliza: EstadoPoliza;
  motivos: Array<{ tipo: MotivoRevision; detalle: string }>;
}

/** Una fila por cuenta con todo lo que la hace sospechosa, las de más motivos primero. */
export function listarParaRevisar(): Promise<CuentaParaRevisar[]> {
  if (conectado('antifraude')) return pedir<CuentaParaRevisar[]>('/api/v1/admin/antifraude/para-revisar');
  return simularRed(() => paraRevisarDeMuestra());
}

function paraRevisarDeMuestra(): CuentaParaRevisar[] {
  const cuentas = cuentasDeMuestra().filter((c) => !c.dado_de_baja);
  const motivos = new Map<string, CuentaParaRevisar['motivos']>();
  const sumar = (id: string, tipo: MotivoRevision, detalle: string) => motivos.set(id, [...(motivos.get(id) ?? []), { tipo, detalle }]);
  const miles = (n: number) => new Intl.NumberFormat('es-GT').format(n).replace(/,/g, '.');

  for (const d of diasAtipicosDeMuestra()) if (d.puntos_dia > 0) sumar(d.usuario_id, 'dia_atipico', `${miles(d.pasos)} pasos el ${fechaLarga(d.fecha)} (más de ${miles(PASOS_DIA_ATIPICO)})`);
  for (const c of cuentas) if (c.retroactivo === 'denegado' && !c.retroactivo_restituido) sumar(c.usuario_id, 'retroactivo_denegado', 'Declaró una fecha de nacimiento que le daba ventaja');
  for (const b of bloqueos) if (b.usuario_id && estaBloqueado(b)) sumar(b.usuario_id, 'intentos', `${LIMITES[b.tipo].nombre}: ${b.intentos} de ${b.maximo}`);
  for (const dc of datosCompartidosDeMuestra()) for (const c of dc.cuentas) sumar(c.usuario_id, 'datos_compartidos', `${dc.muestras_en_comun} muestras iguales con ${dc.cuentas.filter((x) => x.usuario_id !== c.usuario_id).map((x) => x.usuario_id).join(', ')}`);

  return cuentas
    .filter((c) => motivos.has(c.usuario_id))
    .map((c) => ({ usuario_id: c.usuario_id, nombre: c.nombre, estado_poliza: c.estado_poliza, motivos: motivos.get(c.usuario_id)! }))
    .sort((a, b) => b.motivos.length - a.motivos.length);
}

/** Para el inicio (mock). */
export function contarParaRevisarDeMuestra(): number {
  return paraRevisarDeMuestra().length;
}
