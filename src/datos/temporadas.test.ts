import { describe, expect, it } from 'vitest';
import { cicloDeLiga, ciclosDeLiga, nombreCiclo, periodoCiclo, rangoTemporada, temporadaDe } from './temporadas';

/*
 * Las mismas fechas que da el contrato técnico ("Seasons" y la nota del
 * 8 nov 2026 sobre La Liga por temporada). Si el backend cambia la regla,
 * estos tests lo avisan.
 */
describe('temporadas de 13 semanas ISO', () => {
  it('2026 tiene 53 semanas: la temporada 4 va del 28 sep al 3 ene 2027 (14 semanas)', () => {
    expect(rangoTemporada(2026, 4)).toMatchObject({ fecha_inicio: '2026-09-28', fecha_fin: '2027-01-03' });
  });

  it('la temporada 1 de 2027 empieza el lunes 4 de enero', () => {
    expect(rangoTemporada(2027, 1)).toMatchObject({ fecha_inicio: '2027-01-04', fecha_fin: '2027-04-04' });
  });

  it('el año de la temporada es el año ISO', () => {
    expect(temporadaDe('2027-01-03')).toMatchObject({ numero: 4, anio: 2026 });
    expect(temporadaDe('2025-12-29')).toMatchObject({ numero: 1, anio: 2026 });
    expect(temporadaDe('2026-11-11')).toMatchObject({ numero: 4, anio: 2026 });
  });
});

describe('ciclos de La Liga', () => {
  it('octubre de 2026 fue el último mes: cierra el 2 nov y paga el 9 nov', () => {
    expect(cicloDeLiga('2026-10-15')).toEqual({ inicio: '2026-10-01', fin: '2026-10-31', ciclo: 'mes', cierre: '2026-11-02', pago: '2026-11-09' });
  });

  it('la primera temporada cuenta del 1 nov 2026 al 3 ene 2027', () => {
    const c = cicloDeLiga('2026-11-11')!;
    expect(c).toMatchObject({ inicio: '2026-11-01', fin: '2027-01-03', ciclo: 'temporada' });
    // Se cierra el martes de la temporada nueva y se paga el martes siguiente.
    expect(c.cierre).toBe('2027-01-05');
    expect(c.pago).toBe('2027-01-12');
  });

  it('desde el 4 ene 2027, temporadas enteras', () => {
    expect(cicloDeLiga('2027-02-10')).toMatchObject({ inicio: '2027-01-04', fin: '2027-04-04', ciclo: 'temporada' });
  });

  it('antes de octubre de 2026 no hubo La Liga', () => {
    expect(cicloDeLiga('2026-09-30')).toBeNull();
  });

  it('los ciclos van uno detrás del otro, sin huecos', () => {
    expect(ciclosDeLiga('2026-01-01', 3).map((c) => c.inicio)).toEqual(['2026-10-01', '2026-11-01', '2027-01-04']);
  });

  it('se nombran por mes o por temporada', () => {
    expect(nombreCiclo({ inicio: '2026-10-01', ciclo: 'mes' })).toBe('Octubre 2026');
    expect(nombreCiclo({ inicio: '2026-11-01', ciclo: 'temporada' })).toBe('Temporada 4 · 2026');
    expect(periodoCiclo({ inicio: '2027-01-04', ciclo: 'temporada' })).toBe('temporada 1');
  });
});
