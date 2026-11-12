import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { agregarAjuste, HOY, listarLedgerMonedas, veredictoPrevio } from './cuentas';
import { ErrorPanel } from './red';
import { borrarSesion, guardarSesion } from './token';

/*
 * El panel copia la regla del retroactivo de services/polizas.py para mostrar
 * el veredicto antes de verificar. Estos casos son los mismos de
 * Apps/policies/test_mentira_edad.py: si el backend cambia la regla, hay que
 * cambiarla aquí y estos tests lo avisan.
 *   mentira (backend) = 'denegado' (panel)
 */
const REAL = '1990-05-17';
const DIA = '2026-10-05'; // a esa fecha la persona real tiene 36 años
const mentira = (declarada: string, real = REAL, fecha = DIA) => veredictoPrevio(declarada, real, fecha).resultado === 'denegado';

describe('veredictoPrevio = es_mentira del backend', () => {
  it('la misma fecha se aplica', () => {
    expect(veredictoPrevio(REAL, REAL, DIA).resultado).toBe('aplicado');
  });

  it('uno o dos años más joven es un error', () => {
    expect(mentira('1991-05-17')).toBe(false);
    expect(mentira('1992-05-17')).toBe(false); // justo 2 años
    expect(veredictoPrevio('1991-05-17', REAL, DIA).resultado).toBe('tolerado');
  });

  it('dos años y un día más joven ya es mentira', () => {
    expect(mentira('1992-05-18')).toBe(true);
  });

  it('el mes y el día equivocados hacia abajo se toleran', () => {
    expect(mentira('1990-12-30')).toBe(false);
    expect(mentira('1990-05-18')).toBe(false);
  });

  it('un año más vieja es mentira (le baja la FCmáx)', () => {
    expect(mentira('1989-05-17')).toBe(true);
  });

  it('dos años más vieja es mentira', () => {
    expect(mentira('1988-05-17')).toBe(true);
  });

  it('el mes y el día más viejos cuentan solo si cambian los años cumplidos', () => {
    expect(mentira('1990-01-02', REAL, '2026-10-05')).toBe(false); // las dos ya cumplieron 36
    expect(mentira('1990-01-02', REAL, '2026-03-10')).toBe(true); // una tiene 36 y la otra 35
  });

  it('cruzar los 60 es ventaja', () => {
    const real = '1967-06-01'; // 59 años el 5 oct 2026
    expect(mentira('1966-01-01', real)).toBe(true);
    expect(mentira('1968-06-01', real)).toBe(false);
  });

  it('un error de un día que cambia la edad cumplida es ventaja', () => {
    expect(mentira('1996-10-05', '1996-10-06')).toBe(true);
  });

  it('el 29 de febrero', () => {
    const real = '1992-02-29';
    expect(mentira('1994-02-28', real)).toBe(false); // 2 años más joven (el 29 cae en 28)
    expect(mentira('1994-03-01', real)).toBe(true);
  });

  it('una fecha futura respecto a la verificación no rompe la regla', () => {
    expect(mentira('2026-12-01', '2026-11-01', DIA)).toBe(false);
  });
});

describe('agregarAjuste: siempre una fila nueva, con sus límites', () => {
  beforeEach(() => guardarSesion({ token: 't', expiry: null, correo: 'admin@masvidaapp.com', nombre: 'Admin', rol: 'admin' }));
  afterEach(() => borrarSesion());

  const error = (p: Promise<unknown>) => p.then(() => null, (e: ErrorPanel) => e);

  it('soporte no puede ajustar', async () => {
    guardarSesion({ token: 't', expiry: null, correo: 'soporte@masvidaapp.com', nombre: 'Soporte', rol: 'soporte' });
    const e = await error(agregarAjuste('u_8f21', { ledger: 'puntos', cantidad: 10, fecha: HOY, motivo: 'Chequeo médico' }));
    expect(e?.message).toMatch(/rol/);
  });

  it('valida cantidad, fecha y motivo', async () => {
    const e = await error(agregarAjuste('u_8f21', { ledger: 'puntos', cantidad: 0, fecha: '2999-01-01', motivo: 'x' }));
    expect(Object.keys(e?.campos ?? {}).sort()).toEqual(['cantidad', 'fecha', 'motivo']);
  });

  it('las monedas no quedan en negativo', async () => {
    const saldo = (await listarLedgerMonedas('u_0a71')).reduce((s, m) => s + m.cantidad, 0);
    const e = await error(agregarAjuste('u_0a71', { ledger: 'monedas', cantidad: -(saldo + 1), fecha: HOY, motivo: 'Corrección de un error' }));
    expect(e?.campos?.cantidad).toMatch(/negativo/);
  });

  it('un ajuste válido agrega una fila con motivo y autor, sin tocar las demás', async () => {
    const antes = await listarLedgerMonedas('u_8f21');
    await agregarAjuste('u_8f21', { ledger: 'monedas', cantidad: 5, fecha: HOY, motivo: 'Compensación por un cupón que falló' });
    const despues = await listarLedgerMonedas('u_8f21');
    expect(despues).toHaveLength(antes.length + 1);
    const nueva = despues.find((f) => !antes.some((a) => a.id === f.id))!;
    expect(nueva).toMatchObject({ tipo: 'ajuste_manual', cantidad: 5, motivo: 'Compensación por un cupón que falló', autor: 'admin@masvidaapp.com' });
    for (const a of antes) expect(despues).toContainEqual(a);
  });
});
