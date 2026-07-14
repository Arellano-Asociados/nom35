# packages/motor-nom035 — Reglas normativas del motor

Resumen operativo de las reglas que implementa el motor. **El detalle canónico vive en las
tablas de datos** (`scoring_rules`, `item_structure`, `risk_level_ranges`) y en los seeds:
nada normativo se hardcodea en el código del motor (regla inviolable 7 del `CLAUDE.md` raíz).
TDD estricto aquí: test primero, luego implementación.

- **GR-III** (72 ítems, centros >50): Grupo A puntúa directo (Siempre=0 … Nunca=4), Grupo B
  inverso (Siempre=4 … Nunca=0). Cfinal: Nulo <50 | Bajo <75 | Medio <99 | Alto <140 |
  Muy alto ≥140. Rangos propios por categoría y por dominio (ver `risk_level_ranges`).
- **GR-II** (46 ítems, centros 16–50): Grupo A = ítems 18–33; Grupo B = 1–17 y 34–46.
  Cfinal: <20/<45/<70/<90/≥90.
- **GR-I** (todas las empresas, Sí/No, sin puntaje): Sección I = exposición a acontecimiento
  traumático severo; si TODAS No → no requiere valoración. Si ALGUNA Sí → secciones II–IV.
  Requiere valoración clínica si: ≥1 Sí en Sección II, o ≥3 Sí en Sección III, o ≥2 Sí en
  Sección IV. Resultado binario + canalización.
- **Ítems condicionales:** GR-III: 65–68 solo si atiende clientes/usuarios; 69–72 solo si
  supervisa personal. GR-II: 41–43 clientes; 44–46 supervisión. Si no aplican, se registran
  como "Nunca" (=0, son Grupo B).
- **Regla de niveles compartida:** puntaje < nulo_max → Nulo; < bajo_max → Bajo;
  < medio_max → Medio; < alto_max → Alto; ≥ alto_max → Muy alto.
- **Categoría normativa** de un centro de trabajo derivada de su headcount con umbrales
  15/16 y 50/51: ≤15 → solo GR-I; 16–50 → GR-I+GR-II; >50 → GR-I+GR-III.
