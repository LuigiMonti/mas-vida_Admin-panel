import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buscarCupon, listarCupones, marcarUsado, normalizarCodigo, obtenerEstadisticas } from './cupones';
import { listarMeses, renombrarMes, validarNombre } from './liga';
import { validarPatrocinio, type DatosPatrocinio, type Patrocinio } from './patrocinios';
import { guardarPremio, importarCatalogo, validarPremio, type DatosPremio } from './premios';
import type { ErrorPanel } from './red';
import { borrarSesion, guardarSesion } from './token';

const error = (p: Promise<unknown>) => p.then(() => null, (e: ErrorPanel) => e);
const comoAdmin = () => guardarSesion({ token: 't', expiry: null, correo: 'admin@masvidaapp.com', nombre: 'Admin', rol: 'admin' });
const comoSoporte = () => guardarSesion({ token: 't', expiry: null, correo: 'soporte@masvidaapp.com', nombre: 'Soporte', rol: 'soporte' });
afterEach(() => borrarSesion());

const PREMIO: DatosPremio = {
  nombre: 'Café gratis',
  comercio_aliado: 'Le Café',
  descripcion: 'Un americano',
  costo_monedas: 20,
  zona: 'Guatemala',
  categoria: 'Cafecitos',
  detalle: '',
  condiciones: '',
  foto: '',
  fondo: '',
  activo: true,
  vigente_hasta: null,
  cupo: null,
};

describe('premios', () => {
  it('valida nombre, costo, fondo y cupo', () => {
    expect(validarPremio(PREMIO)).toEqual({});
    const e = validarPremio({ ...PREMIO, nombre: ' ', costo_monedas: -1, fondo: 'rojo', cupo: 0 });
    expect(Object.keys(e).sort()).toEqual(['costo_monedas', 'cupo', 'fondo', 'nombre']);
  });

  it('soporte no edita premios', async () => {
    comoSoporte();
    expect((await error(guardarPremio(null, PREMIO)))?.message).toMatch(/rol/);
  });

  it('importar: revisa sin guardar, y si uno viene mal no guarda nada', async () => {
    comoAdmin();
    const r = await importarCatalogo(JSON.stringify({ premios: [{ nombre: 'Ookii', descripcion: 'x', costo_monedas: 40 }, { nombre: 'Nuevo', descripcion: 'y', costo_monedas: 10 }] }), false);
    expect(r).toEqual({ crear: ['Nuevo'], actualizar: ['Ookii'], errores: [] });
    const mal = await importarCatalogo(JSON.stringify({ premios: [{ nombre: 'Malo', descripcion: 'z', costo_monedas: -5 }] }), true);
    expect(mal.errores[0]).toMatch(/Malo/);
    expect((await importarCatalogo('no es json', false)).errores).toEqual(['No es un JSON válido.']);
  });
});

describe('cupones', () => {
  it('normaliza el código como lo escriben en la caja', () => {
    expect(normalizarCodigo(' mv ok41 7xq2 ')).toBe('MV-OK41-7XQ2');
    expect(normalizarCodigo('mvok417xq2')).toBe('MV-OK41-7XQ2');
  });

  it('soporte puede marcar un cupón activo; después ya no se puede usar otra vez', async () => {
    comoSoporte();
    const c = await buscarCupon('mv-ok41-7xq2');
    expect(c.estado).toBe('activo');
    const usado = await marcarUsado(c.codigo);
    expect(usado).toMatchObject({ estado: 'usado', usado_por: 'soporte@masvidaapp.com' });
    expect((await error(marcarUsado(c.codigo)))?.codigo).toBe('cupon_usado');
  });

  it('un cupón vencido no se puede usar', async () => {
    comoAdmin();
    const vencido = (await listarCupones({ estado: 'expirado' }))[0]!;
    expect((await error(marcarUsado(vencido.codigo)))?.codigo).toBe('cupon_vencido');
  });

  it('un código que no existe da 404', async () => {
    expect((await error(buscarCupon('MV-ZZZZ-ZZZZ')))?.estado).toBe(404);
  });

  it('las estadísticas cuadran: por premio suman el total', async () => {
    const e = await obtenerEstadisticas('todo');
    const suma = (k: 'canjeados' | 'usados' | 'vencidos' | 'activos') => e.premios.reduce((s, p) => s + p[k], 0);
    expect(suma('canjeados')).toBe(e.totales.canjeados);
    expect(suma('usados') + suma('vencidos') + suma('activos')).toBe(e.totales.canjeados);
    expect(e.por_origen.tienda + e.por_origen.semana + e.por_origen.liga).toBe(e.totales.canjeados);
    expect(e.por_dia.reduce((s, d) => s + d.canjeados, 0)).toBe(e.totales.canjeados);
  });
});

describe('patrocinios = Patrocinio.clean() del backend', () => {
  const base: DatosPatrocinio = { tipo: 'semana', premio_id: 1, desde: '2027-02-01', hasta: '2027-02-07', cupon: '2x1', acento: '' };
  const ninguno: Patrocinio[] = [];

  it('una semana va de lunes a domingo', () => {
    expect(validarPatrocinio(base, ninguno)).toEqual({});
    expect(validarPatrocinio({ ...base, desde: '2027-02-02', hasta: '2027-02-08' }, ninguno).desde).toMatch(/lunes a domingo/);
  });

  it('un mes de La Liga va del día 1 al último', () => {
    expect(validarPatrocinio({ ...base, tipo: 'liga', desde: '2027-02-01', hasta: '2027-02-28' }, ninguno)).toEqual({});
    expect(validarPatrocinio({ ...base, tipo: 'liga', desde: '2027-02-01', hasta: '2027-02-27' }, ninguno).desde).toMatch(/día 1 al último/);
  });

  it('semana y liga necesitan el texto del cupón; destacado no', () => {
    expect(validarPatrocinio({ ...base, cupon: ' ' }, ninguno).cupon).toBeTruthy();
    expect(validarPatrocinio({ ...base, tipo: 'destacado', cupon: '', desde: '2027-01-03', hasta: '2027-01-20' }, ninguno)).toEqual({});
  });

  it('hasta no puede ir antes de desde', () => {
    expect(validarPatrocinio({ ...base, tipo: 'destacado', desde: '2027-01-20', hasta: '2027-01-03' }, ninguno).hasta).toBeTruthy();
  });

  it('una semana ya vendida no se vende dos veces', () => {
    const vendida = { ...base, id: 1, comercio: 'x', logo: 'x', fondo: '', activo: true } as Patrocinio;
    expect(validarPatrocinio(base, [vendida]).desde).toMatch(/vendida/);
    expect(validarPatrocinio(base, [{ ...vendida, activo: false }])).toEqual({});
  });
});

describe('La Liga: nombre por mes', () => {
  beforeEach(comoAdmin);

  it('el nombre tiene que caber en el banner', () => {
    expect(validarNombre('Liga Nike')).toBeNull();
    expect(validarNombre('x'.repeat(41))).toMatch(/Máximo/);
  });

  it('un mes cerrado no se renombra; uno abierto sí', async () => {
    const meses = await listarMeses();
    const cerrado = meses.find((m) => m.cerrada_en)!;
    expect((await error(renombrarMes(cerrado.mes, 'Liga X')))?.message).toMatch(/ya se cerró/);
    const abierto = meses.find((m) => !m.cerrada_en)!;
    expect((await renombrarMes(abierto.mes, '  Liga Nike ')).nombre).toBe('Liga Nike');
  });
});
