import { describe, expect, it } from 'vitest';
import { plantillaCorreo } from './correo';
import { PLANTILLAS_DEFAULT, renderPlantilla, TIPOS_PLANTILLA } from './plantillas';

describe('renderPlantilla', () => {
  it('sustituye las variables conocidas en asunto y cuerpo', () => {
    const r = renderPlantilla(
      { asunto: 'Hola {{nombre}} de {{empresa}}', cuerpo: 'Vence: {{fecha_limite}}\n\nSaludos' },
      { nombre: 'Ana', empresa: 'ACME', fecha_limite: '1 de agosto de 2026' },
    );
    expect(r.asunto).toBe('Hola Ana de ACME');
    expect(r.parrafos).toEqual(['Vence: 1 de agosto de 2026', 'Saludos']);
  });

  it('deja intactas las variables desconocidas (visibles para corregir la plantilla)', () => {
    const r = renderPlantilla({ asunto: 'x', cuerpo: 'Hola {{apodo}}' }, { nombre: 'Ana' });
    expect(r.parrafos).toEqual(['Hola {{apodo}}']);
  });

  it('el resultado es texto plano: el HTML del valor Y de la plantilla se escapa al armar el correo', () => {
    const r = renderPlantilla(
      { asunto: 'x', cuerpo: '<b>Hola</b> {{nombre}}' },
      { nombre: '<img src=x onerror=alert(1)>' },
    );
    const html = plantillaCorreo({ saludo: 'Hola:', parrafos: r.parrafos });
    expect(html).not.toContain('<b>Hola</b>');
    expect(html).not.toContain('<img');
    expect(html).toContain('&lt;b&gt;');
    expect(html).toContain('&lt;img');
  });

  it('las plantillas originales existen para los tres tipos y usan las variables documentadas', () => {
    for (const tipo of TIPOS_PLANTILLA) {
      const original = PLANTILLAS_DEFAULT[tipo];
      expect(original.asunto.length).toBeGreaterThan(0);
      expect(original.cuerpo).toContain('{{nombre}}');
    }
    expect(PLANTILLAS_DEFAULT.invitacion.cuerpo).toContain('{{fecha_limite}}');
    expect(PLANTILLAS_DEFAULT.recordatorio.cuerpo).toContain('{{fecha_limite}}');
  });
});
