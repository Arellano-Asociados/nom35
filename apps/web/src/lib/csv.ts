// Construcción de CSV compartida entre el expediente de inspección y los registros
// del 5.8 del Responsable Designado. Extraído de informes/expediente.ts (Fase 4.5): la
// neutralización de formula injection y el entrecomillado RFC 4180 son requisitos de
// seguridad, no un detalle del expediente — cualquier CSV que salga del producto los
// necesita, y una segunda copia del helper terminaría divergiendo.

const BOM = '\uFEFF';

// Caracteres que Excel/Sheets interpretan como inicio de fórmula al abrir un CSV
// (conjunto canónico de OWASP para neutralización de CSV injection: =, +, -, @, tab
// y retorno de carro).
const INICIO_FORMULA = /^[=+\-@\t\r]/;

/**
 * Escapa un campo CSV: primero neutraliza formula injection (si el valor inicia con
 * =, +, -, @, tab o retorno de carro, antepone un apóstrofo — convención estándar de
 * Excel para forzar texto, p. ej. un nombre de empleado capturado como
 * `=HYPERLINK("http://evil","x")` no debe ejecutarse como fórmula al abrir el archivo),
 * y LUEGO aplica el entrecomillado RFC 4180 (comillas dobles alrededor si trae coma,
 * comilla o salto de línea) sobre el resultado ya neutralizado.
 *
 * Tradeoff aceptado: un valor numérico legítimamente negativo recibiría un apóstrofo
 * espurio (dejaría de leerse como número en Excel, pero se sigue mostrando correctamente
 * como texto). Ninguna columna que usa este helper produce hoy valores negativos.
 */
export function escaparCampoCsv(valor: string): string {
  const neutralizado = INICIO_FORMULA.test(valor) ? `'${valor}` : valor;
  if (/[",\r\n]/.test(neutralizado)) {
    return `"${neutralizado.replace(/"/g, '""')}"`;
  }
  return neutralizado;
}

function filaCsv(campos: readonly string[]): string {
  return campos.map(escaparCampoCsv).join(',');
}

/** UTF-8 con BOM (Excel es-MX respeta acentos) y CRLF, con escapado correcto por campo. */
export function construirCsv(
  cabecera: readonly string[],
  filas: readonly (readonly string[])[],
): Buffer {
  const lineas = [cabecera, ...filas].map(filaCsv).join('\r\n');
  return Buffer.from(BOM + lineas + '\r\n', 'utf-8');
}
