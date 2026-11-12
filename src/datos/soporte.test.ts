import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { desbloquear, estaBloqueado, listarBloqueos, listarDatosCompartidos, listarDiasAtipicos, listarParaRevisar } from './antifraude';
import { listarBitacora } from './bitacora';
import { estadoDelContrato, guardarComercio, listarComercios, validarComercio, type DatosComercio } from './comercios';
import {
  cambiarEstadoCuenta,
  cerrarSesiones,
  corregirNacimiento,
  darDeBaja,
  HOY,
  liberarPoliza,
  listarLedgerMonedas,
  listarLedgerPuntos,
  listarPolizas,
  listarRetroactivoDenegado,
  listarUsuarios,
  obtenerFicha,
  obtenerSync,
  restituirRetroactivo,
  revertirDia,
  verificarPoliza,
} from './cuentas';
import type { ErrorPanel } from './red';
import { confirmarDobleFactor, obtenerDobleFactor, quitarDobleFactor } from './seguridad';
import { CODIGO_DE_MUESTRA, iniciarSesion, puede, REQUIERE_2FA } from './sesion';
import { sumarDias } from './temporadas';
import { borrarSesion, guardarSesion } from './token';
import { borrarGrupo, listarGrupos, listarMiembros, renombrarGrupo } from './tusLigas';

const error = (p: Promise<unknown>) => p.then(() => null, (e: ErrorPanel) => e);
const comoAdmin = () => guardarSesion({ token: 't', expiry: null, correo: 'admin@masvidaapp.com', nombre: 'Admin', rol: 'admin' });
const comoSoporte = () => guardarSesion({ token: 't', expiry: null, correo: 'soporte@masvidaapp.com', nombre: 'Soporte', rol: 'soporte' });
const MOTIVO = 'Lo pidió la persona por correo';

beforeEach(comoAdmin);
afterEach(() => borrarSesion());

describe('nombre de miembro', () => {
  it('se busca con o sin la arroba, y sale en la lista', async () => {
    const [con, sin] = await Promise.all([listarUsuarios({ q: '@andrea.castillo' }), listarUsuarios({ q: 'andrea.castillo' })]);
    expect(con.map((u) => u.usuario_id)).toEqual(['u_8f21']);
    expect(sin).toEqual(con);
    expect(con[0]).toMatchObject({ nombre: 'Andrea Castillo', nombre_de_miembro: 'andrea.castillo' });
  });

  it('una cuenta de antes del 7 nov todavía no lo tiene', async () => {
    expect((await obtenerFicha('u_7f3a')).usuario.nombre_de_miembro).toBeNull();
  });
});

describe('roles: qué atiende soporte y qué solo hace un admin', () => {
  it('soporte cierra sesiones y desbloquea, pero no desactiva, ni da de baja, ni libera', async () => {
    comoSoporte();
    expect(puede('atender_cuenta')).toBe(true);
    expect(puede('administrar_cuenta')).toBe(false);
    expect((await cerrarSesiones('u_b2f8')).cerradas).toBe(3);
    expect((await obtenerFicha('u_b2f8')).sesiones_activas).toBe(0);
    expect((await error(cambiarEstadoCuenta('u_b2f8', false, MOTIVO)))?.message).toMatch(/rol/);
    expect((await error(darDeBaja('u_b2f8', MOTIVO)))?.message).toMatch(/rol/);
    expect((await error(liberarPoliza('u_b2f8', MOTIVO)))?.message).toMatch(/rol/);
    expect((await error(restituirRetroactivo('u_d118', MOTIVO)))?.message).toMatch(/rol/);
  });
});

describe('desactivar y reactivar', () => {
  it('pide motivo, cierra las sesiones y se puede deshacer', async () => {
    expect((await error(cambiarEstadoCuenta('u_3a90', false, ' ')))?.campos?.motivo).toBeTruthy();
    await cambiarEstadoCuenta('u_3a90', false, 'Cuenta en revisión por fraude');
    expect(await obtenerFicha('u_3a90')).toMatchObject({ sesiones_activas: 0, usuario: { is_active: false } });
    expect((await error(cambiarEstadoCuenta('u_3a90', false, MOTIVO)))?.message).toMatch(/ya está desactivada/);
    await cambiarEstadoCuenta('u_3a90', true, 'Terminó la revisión');
    expect((await obtenerFicha('u_3a90')).usuario.is_active).toBe(true);
  });
});

describe('baja de cuenta: borra lo personal y conserva lo anónimo', () => {
  it('como la baja desde la app, y después ya no se puede cambiar', async () => {
    const [puntos, monedas] = await Promise.all([listarLedgerPuntos('u_c7d4'), listarLedgerMonedas('u_c7d4')]);
    await darDeBaja('u_c7d4', MOTIVO);
    const f = await obtenerFicha('u_c7d4');
    expect(f.usuario).toMatchObject({
      correo: 'baja-u_c7d4',
      nombre: null,
      apellido: null,
      nombre_de_miembro: null,
      tiene_foto: false,
      is_active: false,
      poliza: null,
      birth_date: '1995-01-01', // solo queda el año
    });
    expect(f.usuario.dado_de_baja_en).toBeTruthy();
    expect(f.sesiones_activas).toBe(0);
    expect(f.consentimiento.aceptado).toBe(false);
    expect((await obtenerSync('u_c7d4')).dispositivos.every((d) => d.nombre === 'Sin nombre')).toBe(true);
    // Los ledgers no se tocan.
    expect(await listarLedgerPuntos('u_c7d4')).toEqual(puntos);
    expect(await listarLedgerMonedas('u_c7d4')).toEqual(monedas);
    // Ya no se puede cambiar.
    expect((await error(cambiarEstadoCuenta('u_c7d4', true, MOTIVO)))?.message).toMatch(/dio de baja/);
    expect((await error(darDeBaja('u_c7d4', MOTIVO)))?.message).toMatch(/dio de baja/);
    // La bitácora no guarda nada personal.
    const entrada = (await listarBitacora({ objetivo: 'u_c7d4' })).find((e) => e.accion === 'baja_cuenta')!;
    expect(entrada.detalle).not.toMatch(/mariela|@/i);
  });
});

describe('pólizas: liberar y corregir la fecha', () => {
  it('liberar una verificada deja a la otra cuenta verificarla', async () => {
    const marco = (await listarPolizas({ estado: 'todas' })).find((p) => p.usuario_id === 'u_6c40')!;
    expect(marco.en_otra_cuenta).toBe('u_8f21');
    expect((await error(verificarPoliza('u_6c40', '1993-10-03')))?.message).toMatch(/otra cuenta/);
    expect((await error(liberarPoliza('u_3a90', MOTIVO)))?.message).toMatch(/Solo se libera una póliza verificada/);

    const puntos = await listarLedgerPuntos('u_8f21');
    await liberarPoliza('u_8f21', 'El titular abrió una cuenta nueva');
    expect((await obtenerFicha('u_8f21')).usuario.poliza).toMatchObject({ estado_verificacion: 'rechazada', motivo_rechazo: 'liberada' });
    expect(await listarLedgerPuntos('u_8f21')).toEqual(puntos);
    expect((await verificarPoliza('u_6c40', '1993-10-03')).veredicto.resultado).toBe('aplicado');
  });

  it('corregir la fecha vale hacia adelante y no cambia el veredicto', async () => {
    expect((await error(corregirNacimiento('u_51be', '1966-01-09', MOTIVO)))?.campos?.fecha_nueva).toMatch(/misma fecha/);
    expect((await error(corregirNacimiento('u_51be', '2999-01-01', MOTIVO)))?.campos?.fecha_nueva).toMatch(/futura/);
    const puntos = await listarLedgerPuntos('u_51be');
    const c = await corregirNacimiento('u_51be', '1966-01-19', 'La aseguradora corrigió su registro');
    expect(c).toMatchObject({ fecha_anterior: '1966-01-09', fecha_nueva: '1966-01-19', desde: HOY, autor: 'admin@masvidaapp.com' });
    const p = (await obtenerFicha('u_51be')).usuario.poliza!;
    expect(p).toMatchObject({ birth_date_confirmada: '1966-01-19', retroactivo: 'aplicado' });
    expect(p.correcciones).toHaveLength(1);
    // Nunca le quita puntos.
    expect(await listarLedgerPuntos('u_51be')).toEqual(puntos);
  });
});

describe('retroactivo: restituir cuando fue un error', () => {
  it('devuelve lo anulado con filas nuevas, una sola vez', async () => {
    const caso = (await listarRetroactivoDenegado()).find((c) => c.usuario_id === 'u_d118')!;
    expect(caso.restituido_en).toBeNull();
    expect(caso.puntos_anulados).toBeGreaterThan(0);
    const antes = await listarLedgerPuntos('u_d118');

    const r = await restituirRetroactivo('u_d118', 'Error de la aseguradora en la fecha');
    expect(r).toEqual({ dias: caso.dias.length, puntos: caso.puntos_anulados, monedas: caso.monedas_anuladas });

    const despues = await listarLedgerPuntos('u_d118');
    // Solo se agregan filas: lo anulado sigue en el ledger.
    for (const f of antes) expect(despues).toContainEqual(f);
    const nuevas = despues.filter((f) => !antes.some((a) => a.id === f.id));
    expect(nuevas).toHaveLength(caso.dias.length);
    expect(nuevas.every((f) => f.tipo === 'ajuste_manual' && f.puntos > 0 && f.autor === 'admin@masvidaapp.com')).toBe(true);

    expect((await listarRetroactivoDenegado()).find((c) => c.usuario_id === 'u_d118')!.restituido_en).toBeTruthy();
    expect((await error(restituirRetroactivo('u_d118', MOTIVO)))?.message).toMatch(/ya se restituyó/);
  });
});

describe('revertir un día', () => {
  it('deja el día en 0 con una fila de signo contrario, solo dentro de los 14 días', async () => {
    const filas = await listarLedgerPuntos('u_4b6c');
    const limite = sumarDias(HOY, -14);
    const delDia = (fecha: string, lista = filas) => lista.filter((f) => f.fecha === fecha).reduce((s, f) => s + f.puntos, 0);
    const dia = filas.find((f) => f.fecha >= limite && delDia(f.fecha) > 0)!.fecha;
    const viejo = filas.find((f) => f.fecha < limite)!.fecha;

    expect((await error(revertirDia('u_4b6c', viejo, 'Día atípico: pasos imposibles')))?.campos?.fecha).toMatch(/últimos 14/);
    expect((await error(revertirDia('u_4b6c', dia, 'x')))?.campos?.motivo).toBeTruthy();

    const puntos = delDia(dia);
    expect(await revertirDia('u_4b6c', dia, 'Datos de otra persona')).toEqual({ puntos });
    const despues = await listarLedgerPuntos('u_4b6c');
    expect(despues).toHaveLength(filas.length + 1);
    expect(delDia(dia, despues)).toBe(0);
    expect((await error(revertirDia('u_4b6c', dia, 'Datos de otra persona')))?.campos?.fecha).toMatch(/no tiene puntos/);
  });
});

describe('sync: pasos de Apple Salud', () => {
  it('la app nueva manda pasos_por_hora y sus días quedan cubiertos; la vieja no', async () => {
    const nueva = await obtenerSync('u_8f21');
    expect(nueva.manda_pasos_por_hora).toBe(true);
    expect(nueva.ventana.filter((d) => d.con_datos).every((d) => d.cubierto)).toBe(true);
    const vieja = await obtenerSync('u_7f3a');
    expect(vieja.manda_pasos_por_hora).toBe(false);
    expect(vieja.ventana.some((d) => d.cubierto)).toBe(false);
    expect((await obtenerSync('u_0a71')).manda_pasos_por_hora).toBeNull();
  });
});

describe('antifraude', () => {
  it('los días atípicos pasan de 60.000 pasos', async () => {
    const dias = await listarDiasAtipicos();
    expect(dias.map((d) => d.usuario_id).sort()).toEqual(['u_6c40', 'u_e5d9']);
    expect(dias.every((d) => d.pasos > 60000 && d.en_ventana)).toBe(true);
  });

  it('el mismo teléfono en dos cuentas sale una vez, con las dos', async () => {
    const casos = await listarDatosCompartidos();
    expect(casos).toHaveLength(1);
    expect(casos[0]!.cuentas.map((c) => c.usuario_id).sort()).toEqual(['u_6c40', 'u_8f21']);
  });

  it('para revisar: una fila por cuenta, las de más motivos primero', async () => {
    const lista = await listarParaRevisar();
    expect(new Set(lista.map((c) => c.usuario_id)).size).toBe(lista.length);
    for (let i = 1; i < lista.length; i++) expect(lista[i - 1]!.motivos.length).toBeGreaterThanOrEqual(lista[i]!.motivos.length);
    // Marco: un día atípico y los datos del teléfono de otra cuenta.
    expect(lista.find((c) => c.usuario_id === 'u_6c40')!.motivos.map((m) => m.tipo).sort()).toEqual(['datos_compartidos', 'dia_atipico']);
  });

  it('soporte puede desbloquear una póliza bloqueada por intentos', async () => {
    comoSoporte();
    const [b] = await listarBloqueos({ policy_number: 'gt-114-70412' });
    expect(b).toMatchObject({ tipo: 'vincular_poliza', intentos: 5, maximo: 5 });
    expect(estaBloqueado(b!)).toBe(true);
    await desbloquear(b!.id);
    expect(await listarBloqueos({ policy_number: 'GT-114-70412' })).toEqual([]);
    expect((await error(desbloquear(b!.id)))?.estado).toBe(404);
  });
});

describe('Tus Ligas: moderar', () => {
  it('soporte solo ve', async () => {
    comoSoporte();
    expect((await error(renombrarGrupo(4, 'Grupo del gym', MOTIVO)))?.message).toMatch(/rol/);
  });

  it('cambiar un nombre pide uno distinto, de hasta 60 caracteres, y motivo', async () => {
    expect((await error(renombrarGrupo(4, ' ', MOTIVO)))?.campos?.nombre).toMatch(/necesita un nombre/);
    expect((await error(renombrarGrupo(4, 'x'.repeat(61), MOTIVO)))?.campos?.nombre).toMatch(/Máximo 60/);
    expect((await error(renombrarGrupo(4, 'Grupo del gym', '')))?.campos?.motivo).toBeTruthy();
    expect((await renombrarGrupo(4, '  Grupo del gym ', 'Nombre ofensivo')).nombre).toBe('Grupo del gym');
  });

  it('borrar un grupo lo saca de la lista; sus miembros no pierden nada', async () => {
    expect((await listarMiembros(1)).length).toBe(6);
    await borrarGrupo(6, 'Grupo vacío');
    expect((await listarGrupos()).some((g) => g.id === 6)).toBe(false);
    expect((await error(listarMiembros(6)))?.estado).toBe(404);
  });
});

describe('comercios: la ficha', () => {
  const FICHA: DatosComercio = { contacto_nombre: 'Ana', contacto_telefono: '5555 0199', contacto_correo: 'ana@comercio.example', contrato_desde: '2026-11-01', contrato_hasta: '2027-10-31', cuota_mensual_gtq: '1200', notas: '' };

  it('valida correo, teléfono, fechas y cuota', () => {
    expect(validarComercio(FICHA)).toEqual({});
    const e = validarComercio({ ...FICHA, contacto_correo: 'no-es-correo', contacto_telefono: 'abc', contrato_hasta: '2026-01-01', cuota_mensual_gtq: '-5' });
    expect(Object.keys(e).sort()).toEqual(['contacto_correo', 'contacto_telefono', 'contrato_hasta', 'cuota_mensual_gtq']);
    expect(validarComercio({ ...FICHA, contrato_desde: null }).contrato_desde).toBeTruthy();
  });

  it('el estado del contrato sale de sus fechas', () => {
    const hoy = '2026-11-11';
    expect(estadoDelContrato({ contrato_desde: null, contrato_hasta: null }, hoy)).toBe('sin_contrato');
    expect(estadoDelContrato({ contrato_desde: '2026-12-01', contrato_hasta: null }, hoy)).toBe('por_empezar');
    expect(estadoDelContrato({ contrato_desde: '2026-01-01', contrato_hasta: null }, hoy)).toBe('vigente');
    expect(estadoDelContrato({ contrato_desde: '2026-01-01', contrato_hasta: '2026-11-30' }, hoy)).toBe('por_vencer');
    expect(estadoDelContrato({ contrato_desde: '2026-01-01', contrato_hasta: '2026-10-31' }, hoy)).toBe('vencido');
  });

  it('guardar deja la cuota con dos decimales; soporte no puede', async () => {
    const c = (await listarComercios({ q: 'Yum Greens' }))[0]!;
    expect(c.estado_contrato).toBe('sin_contrato');
    const guardado = await guardarComercio(c.id, FICHA);
    expect(guardado).toMatchObject({ nombre: 'Yum Greens', cuota_mensual_gtq: '1200.00', estado_contrato: 'vigente' });
    comoSoporte();
    expect((await error(guardarComercio(c.id, FICHA)))?.message).toMatch(/rol/);
  });
});

describe('doble factor', () => {
  afterEach(() => borrarSesion());

  it('una cuenta con doble factor pide el código después de la contraseña', async () => {
    borrarSesion();
    const sin = await error(iniciarSesion('2fa.luis@masvidaapp.com', 'x'));
    expect(sin?.codigo).toBe(REQUIERE_2FA);
    expect((await error(iniciarSesion('2fa.luis@masvidaapp.com', 'x', '000000')))?.campos?.codigo).toMatch(/no es correcto/);
    expect((await error(iniciarSesion('2fa.luis@masvidaapp.com', 'x', '12')))?.campos?.codigo).toMatch(/6 dígitos/);
    expect((await iniciarSesion('2fa.luis@masvidaapp.com', 'x', CODIGO_DE_MUESTRA)).rol).toBe('admin');
  });

  it('activarlo en Mi cuenta hace que el próximo login lo pida; quitarlo, que no', async () => {
    await iniciarSesion('diego@masvidaapp.com', 'x');
    expect((await obtenerDobleFactor()).activo).toBe(false);
    expect((await error(confirmarDobleFactor('111111')))?.campos?.codigo).toBeTruthy();
    expect((await confirmarDobleFactor(CODIGO_DE_MUESTRA)).activo).toBe(true);
    borrarSesion();
    expect((await error(iniciarSesion('diego@masvidaapp.com', 'x')))?.codigo).toBe(REQUIERE_2FA);
    await iniciarSesion('diego@masvidaapp.com', 'x', CODIGO_DE_MUESTRA);
    expect((await quitarDobleFactor('x')).activo).toBe(false);
    borrarSesion();
    expect((await iniciarSesion('diego@masvidaapp.com', 'x')).correo).toBe('diego@masvidaapp.com');
  });
});
