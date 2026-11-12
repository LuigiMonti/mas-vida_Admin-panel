import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { hoyGT, type ErrorPanel } from './red';
import { crearVersion, diferencias, listarVersiones, MAX_VERSIONES_POR_DIA, type TablaPuntaje } from './reglas';
import { borrarSesion, guardarSesion } from './token';

const error = (p: Promise<unknown>) => p.then(() => null, (e: ErrorPanel) => e);

async function tablaVigente(): Promise<TablaPuntaje> {
  const l = await listarVersiones();
  return l.versiones.find((v) => v.version === l.vigente)!.tabla;
}

function manana(): string {
  const d = new Date(`${hoyGT()}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + 1);
  return d.toISOString().slice(0, 10);
}

describe('versiones de reglas', () => {
  beforeEach(() => guardarSesion({ token: 't', expiry: null, correo: 'admin@masvidaapp.com', nombre: 'Admin', rol: 'admin' }));
  afterEach(() => borrarSesion());

  it('no empieza en el pasado', async () => {
    const e = await error(crearVersion('2020-01-01', await tablaVigente()));
    expect(e?.campos?.vigente_desde).toMatch(/pasado/);
  });

  it(`máximo ${MAX_VERSIONES_POR_DIA} por día, y gana la de número más alto`, async () => {
    const t = await tablaVigente();
    const dia = manana();
    const creadas = [];
    for (let i = 0; i < MAX_VERSIONES_POR_DIA; i++) creadas.push(await crearVersion(dia, { ...t, tope_diario: 190 + i }));
    const e = await error(crearVersion(dia, t));
    expect(e?.campos?.vigente_desde).toMatch(/máximo/);
    const l = await listarVersiones();
    // Mañana son programadas; ninguna es la vigente todavía.
    expect(l.versiones.filter((v) => v.vigente_desde === dia).every((v) => v.estado === 'programada')).toBe(true);
    expect(creadas.map((v) => v.version)).toEqual([...creadas.map((v) => v.version)].sort((a, b) => a - b));
  });

  it('los tramos de pasos tienen que subir', async () => {
    const t = await tablaVigente();
    const mal = { ...t, pasos: [t.pasos[0]!, { desde: 7000, puntos: 25 }, { desde: 6000, puntos: 50 }, t.pasos[3]!] };
    const e = await error(crearVersion(manana(), mal));
    expect(e?.campos?.pasos_2_desde).toMatch(/subir/);
  });

  it('soporte no puede crear versiones', async () => {
    guardarSesion({ token: 't', expiry: null, correo: 'soporte@masvidaapp.com', nombre: 'Soporte', rol: 'soporte' });
    const e = await error(crearVersion(manana(), await tablaVigente()));
    expect(e?.message).toMatch(/rol/);
  });
});

describe('diferencias', () => {
  it('lista solo lo que cambió', async () => {
    const t = await tablaVigente();
    const otra = { ...t, tope_diario: 250, niveles: t.niveles.map((n) => (n.nivel === 3 ? { ...n, cashback_pct: 12 } : n)) };
    const d = diferencias(t, otra);
    expect(d).toHaveLength(2);
    expect(d.join(' | ')).toMatch(/Techo diario: 200→250/);
    expect(d.join(' | ')).toMatch(/Nivel 3/);
    expect(diferencias(t, t)).toEqual([]);
  });
});
