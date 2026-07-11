// Importación de empleados por CSV. Formato (con cabecera obligatoria):
// nombre,email,area,atiende_clientes,supervisa_personal
// Las banderas aceptan si/no (insensible a mayúsculas y acentos en "sí").

export interface EmpleadoCsv {
  nombre: string;
  email: string;
  area: string | null;
  atiendeClientes: boolean;
  supervisaPersonal: boolean;
}

export interface ErrorCsv {
  linea: number;
  error: string;
}

export interface ResultadoCsv {
  validos: EmpleadoCsv[];
  errores: ErrorCsv[];
}

const CABECERA = ['nombre', 'email', 'area', 'atiende_clientes', 'supervisa_personal'];
const EMAIL_VALIDO = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

function parsearBandera(valor: string): boolean | null {
  const limpio = valor.trim().toLowerCase().replace('í', 'i');
  if (limpio === 'si') return true;
  if (limpio === 'no') return false;
  return null;
}

export function parsearCsvEmpleados(contenido: string): ResultadoCsv {
  const lineas = contenido.split(/\r?\n/);
  const errores: ErrorCsv[] = [];
  const validos: EmpleadoCsv[] = [];

  const cabecera = (lineas[0] ?? '').split(',').map((c) => c.trim().toLowerCase());
  if (cabecera.join(',') !== CABECERA.join(',')) {
    return {
      validos: [],
      errores: [{ linea: 1, error: `Cabecera inválida; se esperaba: ${CABECERA.join(',')}` }],
    };
  }

  const emailsVistos = new Set<string>();

  for (let i = 1; i < lineas.length; i++) {
    const linea = lineas[i] ?? '';
    if (linea.trim() === '') continue;
    const numeroLinea = i + 1;
    const campos = linea.split(',').map((c) => c.trim());
    if (campos.length !== CABECERA.length) {
      errores.push({
        linea: numeroLinea,
        error: `Se esperaban ${CABECERA.length} columnas y hay ${campos.length}`,
      });
      continue;
    }
    const [nombre = '', email = '', area = '', atiende = '', supervisa = ''] = campos;

    if (!EMAIL_VALIDO.test(email)) {
      errores.push({ linea: numeroLinea, error: `Email inválido: "${email}"` });
      continue;
    }
    if (nombre === '') {
      errores.push({ linea: numeroLinea, error: 'El nombre no puede estar vacío' });
      continue;
    }
    const atiendeClientes = parsearBandera(atiende);
    if (atiendeClientes === null) {
      errores.push({
        linea: numeroLinea,
        error: `Valor inválido en atiende_clientes: "${atiende}" (usa si/no)`,
      });
      continue;
    }
    const supervisaPersonal = parsearBandera(supervisa);
    if (supervisaPersonal === null) {
      errores.push({
        linea: numeroLinea,
        error: `Valor inválido en supervisa_personal: "${supervisa}" (usa si/no)`,
      });
      continue;
    }
    const emailNormalizado = email.toLowerCase();
    if (emailsVistos.has(emailNormalizado)) {
      errores.push({ linea: numeroLinea, error: `Email duplicado en el archivo: ${email}` });
      continue;
    }
    emailsVistos.add(emailNormalizado);

    validos.push({
      nombre,
      email: emailNormalizado,
      area: area === '' ? null : area,
      atiendeClientes,
      supervisaPersonal,
    });
  }

  return { validos, errores };
}
