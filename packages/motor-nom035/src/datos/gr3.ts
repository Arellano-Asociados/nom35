import type { CategoriaDef, DefinicionGuia, DominioDef } from '../tipos';
import { PUNTAJES_LIKERT } from './puntajes';
import { gruposDesdeA, serie } from './util';

// GR-III — Cuestionario de 72 ítems para centros de trabajo con MÁS de 50 trabajadores.
// Fuente: NOM-035-STPS-2018, DOF 23-oct-2018 (Guía de Referencia III).
// Estos datos son el contenido seed de las tablas scoring_rules / item_structure /
// risk_level_ranges; el motor solo los consume.

const ITEMS_GRUPO_A = [
  1, 4, 23, 24, 25, 26, 27, 28, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 40, 41, 42, 43, 44, 45, 46,
  47, 48, 49, 50, 51, 52, 53, 55, 56, 57,
] as const;

const DOMINIOS: readonly DominioDef[] = [
  {
    nombre: 'Condiciones en el ambiente de trabajo',
    items: serie(1, 5),
    rango: { nuloMax: 5, bajoMax: 9, medioMax: 11, altoMax: 14 },
  },
  {
    nombre: 'Carga de trabajo',
    items: [...serie(6, 16), ...serie(65, 68)],
    rango: { nuloMax: 15, bajoMax: 21, medioMax: 27, altoMax: 37 },
  },
  {
    nombre: 'Falta de control sobre el trabajo',
    items: [...serie(23, 30), 35, 36],
    rango: { nuloMax: 11, bajoMax: 16, medioMax: 21, altoMax: 25 },
  },
  {
    nombre: 'Jornada de trabajo',
    items: [17, 18],
    rango: { nuloMax: 1, bajoMax: 2, medioMax: 4, altoMax: 6 },
  },
  {
    nombre: 'Interferencia en la relación trabajo-familia',
    items: serie(19, 22),
    rango: { nuloMax: 4, bajoMax: 6, medioMax: 8, altoMax: 10 },
  },
  {
    nombre: 'Liderazgo',
    items: [...serie(31, 34), ...serie(37, 41)],
    rango: { nuloMax: 9, bajoMax: 12, medioMax: 16, altoMax: 20 },
  },
  {
    nombre: 'Relaciones en el trabajo',
    items: [...serie(42, 46), ...serie(69, 72)],
    rango: { nuloMax: 10, bajoMax: 13, medioMax: 17, altoMax: 21 },
  },
  {
    nombre: 'Violencia',
    items: serie(57, 64),
    rango: { nuloMax: 7, bajoMax: 10, medioMax: 13, altoMax: 16 },
  },
  {
    nombre: 'Reconocimiento del desempeño',
    items: serie(47, 52),
    rango: { nuloMax: 6, bajoMax: 10, medioMax: 14, altoMax: 18 },
  },
  {
    nombre: 'Insuficiente sentido de pertenencia e inestabilidad',
    items: serie(53, 56),
    rango: { nuloMax: 4, bajoMax: 6, medioMax: 8, altoMax: 10 },
  },
];

// Los tests de integridad de datos (src/datos.test.ts) verifican que los ítems resultantes
// de cada categoría coinciden con el DOF, así que un nombre de dominio mal escrito no pasa CI.
const itemsDe = (nombresDominios: readonly string[]): number[] =>
  DOMINIOS.filter((dominio) => nombresDominios.includes(dominio.nombre)).flatMap((dominio) => [
    ...dominio.items,
  ]);

// En la GR-III cada categoría puntúa exactamente los ítems de sus dominios.
const categoria = (
  nombre: string,
  dominios: readonly string[],
  rango: CategoriaDef['rango'],
): CategoriaDef => ({ nombre, dominios, items: itemsDe(dominios), rango });

const CATEGORIAS: readonly CategoriaDef[] = [
  categoria('Ambiente de trabajo', ['Condiciones en el ambiente de trabajo'], {
    nuloMax: 5,
    bajoMax: 9,
    medioMax: 11,
    altoMax: 14,
  }),
  categoria(
    'Factores propios de la actividad',
    ['Carga de trabajo', 'Falta de control sobre el trabajo'],
    { nuloMax: 15, bajoMax: 30, medioMax: 45, altoMax: 60 },
  ),
  categoria(
    'Organización del tiempo de trabajo',
    ['Jornada de trabajo', 'Interferencia en la relación trabajo-familia'],
    { nuloMax: 5, bajoMax: 7, medioMax: 10, altoMax: 13 },
  ),
  categoria(
    'Liderazgo y relaciones en el trabajo',
    ['Liderazgo', 'Relaciones en el trabajo', 'Violencia'],
    { nuloMax: 14, bajoMax: 29, medioMax: 42, altoMax: 58 },
  ),
  categoria(
    'Entorno organizacional',
    ['Reconocimiento del desempeño', 'Insuficiente sentido de pertenencia e inestabilidad'],
    { nuloMax: 10, bajoMax: 14, medioMax: 18, altoMax: 23 },
  ),
];

export const GR3: DefinicionGuia = {
  guia: 'GR-III',
  totalItems: 72,
  puntajes: PUNTAJES_LIKERT,
  grupoDeItem: gruposDesdeA(72, ITEMS_GRUPO_A),
  itemsCondicionales: {
    atiendeClientes: serie(65, 68),
    supervisaPersonal: serie(69, 72),
  },
  dominios: DOMINIOS,
  categorias: CATEGORIAS,
  rangoCfinal: { nuloMax: 50, bajoMax: 75, medioMax: 99, altoMax: 140 },
};
