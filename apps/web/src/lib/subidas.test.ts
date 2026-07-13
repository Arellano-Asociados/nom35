import { describe, expect, it } from 'vitest';
import { TAMANO_MAXIMO_BYTES, rutaDeObjeto, validarPdf } from './subidas';

function archivoDe(contenido: BlobPart, nombre: string, tipo: string): File {
  return new File([contenido], nombre, { type: tipo });
}

const CABECERA_PDF = '%PDF-1.7\n%contenido mínimo';

describe('validarPdf', () => {
  it('rechaza un archivo vacío', async () => {
    const resultado = await validarPdf(archivoDe('', 'politica.pdf', 'application/pdf'));
    expect(resultado.ok).toBe(false);
  });

  it('rechaza un archivo que excede el tamaño máximo', async () => {
    const enorme = new Uint8Array(TAMANO_MAXIMO_BYTES + 1);
    enorme.set([0x25, 0x50, 0x44, 0x46]); // aun siendo PDF de verdad, el tamaño manda
    const resultado = await validarPdf(archivoDe(enorme, 'politica.pdf', 'application/pdf'));
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain('10 MB');
  });

  it('rechaza bytes que no son PDF aunque el nombre y el Content-Type del cliente mientan', async () => {
    const resultado = await validarPdf(
      archivoDe('<html><script>alert(1)</script></html>', 'politica.pdf', 'application/pdf'),
    );
    expect(resultado.ok).toBe(false);
    if (!resultado.ok) expect(resultado.error).toContain('PDF');
  });

  it('acepta un PDF por magic bytes y fuerza el contentType del servidor', async () => {
    // El cliente declara text/html: la decisión debe salir de los BYTES, no de él.
    const resultado = await validarPdf(archivoDe(CABECERA_PDF, 'politica.html', 'text/html'));
    expect(resultado.ok).toBe(true);
    if (resultado.ok) {
      expect(resultado.archivo.contentType).toBe('application/pdf');
      expect(resultado.archivo.extension).toBe('.pdf');
      expect(resultado.archivo.bytes.subarray(0, 4).toString()).toBe('%PDF');
    }
  });
});

describe('rutaDeObjeto', () => {
  it('genera la clave bajo el prefijo de la empresa con nombre aleatorio del servidor', () => {
    const ruta = rutaDeObjeto('empresa-123', '.pdf');
    expect(ruta).toMatch(/^empresa-123\/[0-9a-f-]{36}\.pdf$/);
  });

  it('dos llamadas nunca colisionan (el nombre no depende del archivo del cliente)', () => {
    expect(rutaDeObjeto('e', '.pdf')).not.toBe(rutaDeObjeto('e', '.pdf'));
  });
});
