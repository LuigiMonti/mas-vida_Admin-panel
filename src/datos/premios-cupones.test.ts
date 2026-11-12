import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { buscarCupon, listarCupones, marcarUsado, normalizarCodigo, obtenerEstadisticas } from './cupones';
import { listarCiclos, obtenerTabla, renombrarCiclo, validarNombre } from './liga';
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

  it('un patrocinio de La Liga va de punta a punta de su ciclo', () => {
    const liga = { ...base, tipo: 'liga' as const };
    // Temporada 1 de 2027: del lunes 4 ene al domingo 4 abr.
    expect(validarPatrocinio({ ...liga, desde: '2027-01-04', hasta: '2027-04-04' }, ninguno)).toEqual({});
    // La transición: la primera temporada cuenta desde el 1 nov 2026.
    expect(validarPatrocinio({ ...liga, desde: '2026-11-01', hasta: '2027-01-03' }, ninguno)).toEqual({});
    // Octubre de 2026 fue el último ciclo por mes.
    expect(validarPatrocinio({ ...liga, desde: '2026-10-01', hasta: '2026-10-31' }, ninguno)).toEqual({});
    // Ya no se vende un mes suelto.
    expect(validarPatrocinio({ ...liga, desde: '2027-02-01', hasta: '2027-02-28' }, ninguno).desde).toMatch(/punta a punta/);
    expect(validarPatrocinio({ ...liga, desde: '2027-01-04', hasta: '2027-03-31' }, ninguno).desde).toMatch(/punta a punta/);
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

describe('La Liga: por temporada, con nombre por ciclo', () => {
  beforeEach(comoAdmin);

  it('el nombre tiene que caber en el banner', () => {
    expect(validarNombre('Liga Nike')).toBeNull();
    expect(validarNombre('x'.repeat(41))).toMatch(/Máximo/);
  });

  it('un ciclo cerrado no se renombra; uno abierto sí', async () => {
    const ciclos = await listarCiclos();
    const cerrado = ciclos.find((m) => m.cerrada_en)!;
    expect((await error(renombrarCiclo(cerrado.inicio, 'Liga X')))?.message).toMatch(/ya se cerró/);
    const abierto = ciclos.find((m) => !m.cerrada_en)!;
    expect((await renombrarCiclo(abierto.inicio, '  Liga Nike ')).nombre).toBe('Liga Nike');
  });

  it('octubre de 2026 es el único ciclo por mes; después, temporadas', async () => {
    const ciclos = await listarCiclos();
    expect(ciclos.filter((c) => c.ciclo === 'mes').map((c) => c.inicio)).toEqual(['2026-10-01']);
    expect(ciclos.find((c) => c.inicio === '2026-11-01')).toMatchObject({ fin: '2027-01-03', ciclo: 'temporada', cierre: '2027-01-05', pago: '2027-01-12' });
  });

  it('la tabla va por puntos y desempata por pasos y después por workouts', async () => {
    const tabla = await obtenerTabla('2026-10-01');
    for (let i = 1; i < tabla.length; i++) {
      const [a, b] = [tabla[i - 1]!, tabla[i]!];
      expect(a.puntos > b.puntos || (a.puntos === b.puntos && (a.pasos > b.pasos || (a.pasos === b.pasos && a.workouts >= b.workouts)))).toBe(true);
    }
    expect(tabla.slice(0, 3).map((f) => f.monedas)).toEqual([30, 20, 10]);
  });
});
