import { describe, expect, it } from 'vitest';
import { leerConfig } from './modo';

describe('leerConfig: de dónde lee cada sección', () => {
  it('por defecto, todo con datos de muestra', () => {
    expect(leerConfig({})).toEqual({ todo: false, secciones: new Set() });
  });

  it('VITE_DATOS=api conecta todo', () => {
    expect(leerConfig({ VITE_DATOS: ' API ' }).todo).toBe(true);
  });

  it('VITE_DATOS_API conecta solo esas secciones', () => {
    const c = leerConfig({ VITE_DATOS: 'mock', VITE_DATOS_API: 'sesion, Polizas,,' });
    expect(c.todo).toBe(false);
    expect([...c.secciones]).toEqual(['sesion', 'polizas']);
  });
});
