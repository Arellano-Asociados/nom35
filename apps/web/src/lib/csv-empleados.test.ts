import { describe, expect, it } from 'vitest';
import { parsearCsvEmpleados } from './csv-empleados';

// Importación CSV de empleados: nombre,email,area,atiende_clientes,supervisa_personal
// Valida y reporta errores por línea sin abortar la importación completa.

const CABECERA = 'nombre,email,area,atiende_clientes,supervisa_personal';

describe('parsearCsvEmpleados', () => {
  it('parsea filas válidas con banderas si/no', () => {
    const csv = [
      CABECERA,
      'Ana López,ana@empresa.mx,Ventas,si,no',
      'Luis Ruiz,luis@empresa.mx,Producción,no,si',
    ].join('\n');
    const r = parsearCsvEmpleados(csv);
    expect(r.errores).toEqual([]);
    expect(r.validos).toEqual([
      {
        nombre: 'Ana López',
        email: 'ana@empresa.mx',
        area: 'Ventas',
        atiendeClientes: true,
        supervisaPersonal: false,
      },
      {
        nombre: 'Luis Ruiz',
        email: 'luis@empresa.mx',
        area: 'Producción',
        atiendeClientes: false,
        supervisaPersonal: true,
      },
    ]);
  });

  it('reporta errores por línea: email inválido, nombre vacío, bandera desconocida', () => {
    const csv = [
      CABECERA,
      'Sin Email,no-es-email,Ventas,si,no',
      ',vacio@empresa.mx,Ventas,si,no',
      'Flag Mala,flag@empresa.mx,Ventas,quizas,no',
    ].join('\n');
    const r = parsearCsvEmpleados(csv);
    expect(r.validos).toEqual([]);
    expect(r.errores).toHaveLength(3);
    expect(r.errores[0]).toMatchObject({ linea: 2 });
    expect(r.errores[0]?.error).toMatch(/email/i);
    expect(r.errores[1]).toMatchObject({ linea: 3 });
    expect(r.errores[1]?.error).toMatch(/nombre/i);
    expect(r.errores[2]).toMatchObject({ linea: 4 });
    expect(r.errores[2]?.error).toMatch(/atiende_clientes/i);
  });

  it('detecta emails duplicados dentro del archivo', () => {
    const csv = [
      CABECERA,
      'Ana López,ana@empresa.mx,Ventas,si,no',
      'Ana Duplicada,ANA@empresa.mx,Ventas,no,no',
    ].join('\n');
    const r = parsearCsvEmpleados(csv);
    expect(r.validos).toHaveLength(1);
    expect(r.errores[0]?.error).toMatch(/duplicado/i);
  });

  it('rechaza cabecera incorrecta', () => {
    const r = parsearCsvEmpleados('a,b,c\nx,y,z');
    expect(r.errores[0]?.error).toMatch(/cabecera/i);
  });

  it('ignora líneas vacías y tolera area vacía', () => {
    const csv = `${CABECERA}\n\nAna López,ana@empresa.mx,,si,no\n`;
    const r = parsearCsvEmpleados(csv);
    expect(r.errores).toEqual([]);
    expect(r.validos[0]?.area).toBeNull();
  });
});
