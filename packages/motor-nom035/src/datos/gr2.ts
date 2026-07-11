import type { CategoriaDef, DefinicionGuia, DominioDef } from '../tipos';
import { PUNTAJES_LIKERT } from './puntajes';
import { gruposDesdeA, serie } from './util';

// GR-II — Cuestionario de 46 ítems para centros de trabajo de 16 a 50 trabajadores.
// Fuente: NOM-035-STPS-2018, DOF 23-oct-2018 (Guía de Referencia II).

const DOMINIOS: readonly DominioDef[] = [
  {
    nombre: 'Condiciones en el ambiente de trabajo',
    items: serie(1, 3),
    rango: { nuloMax: 3, bajoMax: 5, medioMax: 7, altoMax: 9 },
  },
  {
    nombre: 'Carga de trabajo',
    items: [...serie(4, 13), ...serie(41, 43)],
    rango: { nuloMax: 12, bajoMax: 16, medioMax: 20, altoMax: 24 },
  },
  {
    nombre: 'Falta de control sobre el trabajo',
    items: [...serie(18, 22), 26, 27],
    rango: { nuloMax: 5, bajoMax: 8, medioMax: 11, altoMax: 14 },
  },
  {
    nombre: 'Jornada de trabajo',
    items: [14, 15],
    rango: { nuloMax: 1, bajoMax: 2, medioMax: 4, altoMax: 6 },
  },
  {
    nombre: 'Interferencia en la relación trabajo-familia',
    items: [16, 17],
    rango: { nuloMax: 1, bajoMax: 2, medioMax: 4, altoMax: 6 },
  },
  {
    nombre: 'Liderazgo',
    items: [...serie(23, 25), 28, 29],
    rango: { nuloMax: 3, bajoMax: 5, medioMax: 8, altoMax: 11 },
  },
  {
    nombre: 'Relaciones en el trabajo',
    items: [...serie(30, 32), ...serie(44, 46)],
    rango: { nuloMax: 5, bajoMax: 8, medioMax: 11, altoMax: 14 },
  },
  {
    nombre: 'Violencia',
    items: serie(33, 40),
    rango: { nuloMax: 7, bajoMax: 10, medioMax: 13, altoMax: 16 },
  },
];

// A diferencia de la GR-III, en la GR-II las categorías listan sus ítems de forma explícita:
// la categoría "Factores propios de la actividad" NO puntúa los ítems 18 y 19, aunque
// pertenecen a su dominio "Falta de control sobre el trabajo" (así lo define el DOF).
const CATEGORIAS: readonly CategoriaDef[] = [
  {
    nombre: 'Ambiente de trabajo',
    dominios: ['Condiciones en el ambiente de trabajo'],
    items: serie(1, 3),
    rango: { nuloMax: 3, bajoMax: 5, medioMax: 7, altoMax: 9 },
  },
  {
    nombre: 'Factores propios de la actividad',
    dominios: ['Carga de trabajo', 'Falta de control sobre el trabajo'],
    items: [...serie(4, 13), ...serie(20, 22), 26, 27, ...serie(41, 43)],
    rango: { nuloMax: 10, bajoMax: 20, medioMax: 30, altoMax: 40 },
  },
  {
    nombre: 'Organización del tiempo de trabajo',
    dominios: ['Jornada de trabajo', 'Interferencia en la relación trabajo-familia'],
    items: serie(14, 17),
    rango: { nuloMax: 4, bajoMax: 6, medioMax: 9, altoMax: 12 },
  },
  {
    nombre: 'Liderazgo y relaciones en el trabajo',
    dominios: ['Liderazgo', 'Relaciones en el trabajo', 'Violencia'],
    items: [...serie(23, 25), ...serie(28, 40), ...serie(44, 46)],
    rango: { nuloMax: 10, bajoMax: 18, medioMax: 28, altoMax: 38 },
  },
];

export const GR2: DefinicionGuia = {
  guia: 'GR-II',
  totalItems: 46,
  puntajes: PUNTAJES_LIKERT,
  grupoDeItem: gruposDesdeA(46, serie(18, 33)),
  itemsCondicionales: {
    atiendeClientes: serie(41, 43),
    supervisaPersonal: serie(44, 46),
  },
  dominios: DOMINIOS,
  categorias: CATEGORIAS,
  rangoCfinal: { nuloMax: 20, bajoMax: 45, medioMax: 70, altoMax: 90 },
};
