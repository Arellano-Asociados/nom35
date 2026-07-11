# nom35 — Plataforma SaaS de Cumplimiento NOM-035-STPS-2018

MVP multi-tenant que digitaliza el ciclo completo de cumplimiento de la NOM-035-STPS-2018:
cuestionarios oficiales (GR-I/II/III), cálculo con matrices de la norma, dashboards agregados,
informe del numeral 7.9 y expediente de inspección.

**Contexto completo, reglas de negocio inviolables y estado del proyecto: ver [CLAUDE.md](./CLAUDE.md).**

## Estructura

```
apps/web/               # Next.js 15 (se scaffoldea en Milestone 3)
packages/motor-nom035/  # Motor de cálculo puro (TDD, sin I/O)
supabase/               # Migraciones SQL, RLS, seeds
```

## Setup local

Requisitos: Node ≥22, pnpm ≥10, Docker Desktop (para Supabase local).

```bash
pnpm install
pnpm lint && pnpm typecheck && pnpm test
pnpm exec supabase start   # levanta Postgres/Auth/Storage locales
```

Variables de entorno: copiar `.env.example` y llenar valores (ver comentarios en el archivo).
