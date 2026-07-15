-- Mini-fase post-F5: el limitador de tasa NUNCA se aplicó por la vía real.
--
-- Hallazgo (detectado al cierre de F5): la app llama `rpc('golpe_limite')`, que
-- PostgREST resuelve contra los esquemas expuestos (`public`, config.toml) — pero la
-- función solo existía como `app.golpe_limite`. Resultado: TODA llamada devolvía
-- "no existe" y caía en el fail-open de lib/limites.ts. El limitador estuvo apagado
-- desde la Fase 2.5 sin que ningún gate lo detectara (los tests RLS ejercitan
-- app.golpe_limite por SQL directo, no la vía REST).
--
-- Arreglo: wrapper en `public` con el MISMO contrato de privilegios (solo service_role;
-- un cliente no puede ni ejecutar el limitador, mucho menos leer o resetear contadores).
-- El test que faltaba —la vía REST real— vive en apps/web/e2e/limites.spec.ts.

create function public.golpe_limite(p_clave text, p_ventana_segundos integer, p_maximo integer)
returns boolean
language sql security definer set search_path = app, public as $$
  select app.golpe_limite(p_clave, p_ventana_segundos, p_maximo)
$$;

comment on function public.golpe_limite(text, integer, integer) is
  'Wrapper REST de app.golpe_limite (PostgREST solo expone public). Solo service_role.';

revoke execute on function public.golpe_limite(text, integer, integer) from public, anon, authenticated;
grant execute on function public.golpe_limite(text, integer, integer) to service_role;
