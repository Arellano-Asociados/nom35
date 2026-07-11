# Casos de referencia del motor NOM-035

Este directorio recibe los **3–5 cuestionarios resueltos y validados por un consultor
certificado NOM-035** (dependencia externa abierta, ver CLAUDE.md). El test
`src/reference-cases.test.ts` carga automáticamente todo `*.json` de ESTE directorio (no de
subdirectorios) y exige **coincidencia 100%** con el motor.

- Sin casos cargados, el test queda marcado `todo`.
- En modo release (`NOM035_RELEASE=1` en el entorno), la ausencia de casos **falla la suite**:
  es el gate de validación de lanzamiento.

## Formato JSON

Un archivo por caso. Campos:

```jsonc
{
  "descripcion": "Quién lo validó, cuándo y con qué herramienta",
  "guia": "GR-III", // "GR-I" | "GR-II" | "GR-III"

  // Para GR-II / GR-III:
  "atiendeClientes": true,
  "supervisaPersonal": false,
  // número de ítem → opción. Ítems condicionales que NO aplican se omiten.
  "respuestas": { "1": "siempre", "2": "casi_nunca", "...": "..." },
  "esperado": {
    "cfinal": 144,
    "nivelFinal": "muy_alto", // "nulo" | "bajo" | "medio" | "alto" | "muy_alto"
    // Opcionales; si se incluyen, también se comparan:
    "categorias": { "Ambiente de trabajo": { "puntaje": 4, "nivel": "nulo" } },
    "dominios": { "Carga de trabajo": { "puntaje": 31, "nivel": "alto" } },
  },
}
```

Opciones válidas: `siempre`, `casi_siempre`, `algunas_veces`, `casi_nunca`, `nunca`.

Para **GR-I** (`"guia": "GR-I"`), en lugar de `respuestas` usar:

```jsonc
{
  "secciones": { "I": [false, true], "II": [true, false], "III": [], "IV": [] }, // true = Sí
  "esperado": { "requiereValoracionClinica": true },
}
```

Los nombres de categorías y dominios deben coincidir con `src/datos/gr2.ts` / `src/datos/gr3.ts`.

## Verificación cruzada manual contra Evalúa035 (CONTPAQi)

Condición de cierre "para desarrollo" del Milestone 1: 2 casos mixtos verificados contra la
herramienta Evalúa035. Los casos están en [`verificacion-cruzada/`](./verificacion-cruzada/)
(entrada completa + resultado del motor):

### Caso mixto GR-III (`caso-mixto-gr3.json`)

Atiende clientes: Sí · Supervisa personal: Sí · 72 ítems respondidos (patrón mixto determinista).

Resultado del motor: **Cfinal = 144 → MUY ALTO**

| Categoría                            | Puntaje | Nivel |
| ------------------------------------ | ------- | ----- |
| Ambiente de trabajo                  | 4       | Nulo  |
| Factores propios de la actividad     | 54      | Alto  |
| Organización del tiempo de trabajo   | 12      | Alto  |
| Liderazgo y relaciones en el trabajo | 52      | Alto  |
| Entorno organizacional               | 22      | Alto  |

| Dominio                                             | Puntaje | Nivel    |
| --------------------------------------------------- | ------- | -------- |
| Condiciones en el ambiente de trabajo               | 4       | Nulo     |
| Carga de trabajo                                    | 31      | Alto     |
| Falta de control sobre el trabajo                   | 23      | Alto     |
| Jornada de trabajo                                  | 2       | Medio    |
| Interferencia en la relación trabajo-familia        | 10      | Muy alto |
| Liderazgo                                           | 17      | Alto     |
| Relaciones en el trabajo                            | 20      | Alto     |
| Violencia                                           | 15      | Alto     |
| Reconocimiento del desempeño                        | 12      | Medio    |
| Insuficiente sentido de pertenencia e inestabilidad | 10      | Muy alto |

### Caso mixto GR-II (`caso-mixto-gr2.json`)

Atiende clientes: Sí · Supervisa personal: No (ítems 44–46 no aplican) · 43 ítems respondidos.

Resultado del motor: **Cfinal = 87 → ALTO**

| Categoría                            | Puntaje | Nivel |
| ------------------------------------ | ------- | ----- |
| Ambiente de trabajo                  | 7       | Alto  |
| Factores propios de la actividad     | 34      | Alto  |
| Organización del tiempo de trabajo   | 8       | Medio |
| Liderazgo y relaciones en el trabajo | 32      | Alto  |

| Dominio                                      | Puntaje | Nivel    |
| -------------------------------------------- | ------- | -------- |
| Condiciones en el ambiente de trabajo        | 7       | Alto     |
| Carga de trabajo                             | 27      | Muy alto |
| Falta de control sobre el trabajo            | 13      | Alto     |
| Jornada de trabajo                           | 3       | Medio    |
| Interferencia en la relación trabajo-familia | 5       | Alto     |
| Liderazgo                                    | 13      | Muy alto |
| Relaciones en el trabajo                     | 4       | Nulo     |
| Violencia                                    | 15      | Alto     |

### Resultado de la verificación

> **PENDIENTE DE CAPTURA MANUAL.** Evalúa035 es una herramienta de terceros (CONTPAQi) que
> requiere cuenta y captura manual; no se pudo ejecutar de forma automatizada. Pasos: capturar
> las respuestas de cada `caso-mixto-*.json` en Evalúa035 con las mismas preguntas filtro,
> y comparar Cfinal, niveles por categoría y por dominio contra las tablas de arriba.
> Documentar aquí el resultado (fecha, versión de la herramienta, coincidencia sí/no por campo).
