-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 2.5: limitador de tasa respaldado en BD (auditoría v0, dimensión 6 [Alto]
-- "fuerza bruta viable: no existe ningún límite en la aplicación").
--
-- Contador de ventana fija por clave. Vive en BD porque la app corre serverless
-- (un contador en memoria muere con cada instancia). Lo consume SOLO la app con
-- service_role: sin GRANT para authenticated/anon, ni de la tabla ni de la
-- función, para que un cliente no pueda leer ni resetear contadores ajenos.
-- Nota: el login/registro conservan además los límites nativos de GoTrue.
-- ─────────────────────────────────────────────────────────────────────────────

create table rate_limits (
  clave text primary key,
  ventana_inicio timestamptz not null default now(),
  contador integer not null default 0
);

alter table rate_limits enable row level security; -- sin políticas: nadie salvo service_role/owner

-- Incrementa el contador de la clave dentro de la ventana; devuelve true si la
-- operación está permitida (contador ≤ máximo). Atómico vía upsert.
create or replace function app.golpe_limite(p_clave text, p_ventana_segundos integer, p_maximo integer)
returns boolean
language plpgsql security definer set search_path = public as $$
declare
  v_contador integer;
begin
  insert into rate_limits (clave, ventana_inicio, contador)
  values (p_clave, now(), 1)
  on conflict (clave) do update set
    contador = case
      when rate_limits.ventana_inicio < now() - make_interval(secs => p_ventana_segundos) then 1
      else rate_limits.contador + 1
    end,
    ventana_inicio = case
      when rate_limits.ventana_inicio < now() - make_interval(secs => p_ventana_segundos) then now()
      else rate_limits.ventana_inicio
    end
  returning contador into v_contador;
  return v_contador <= p_maximo;
end;
$$;

-- Solo la app: el resto de roles no puede ni ejecutarla (el GRANT EXECUTE global a
-- schema app de M2 aplica a funciones EXISTENTES; para esta nueva se revoca explícito).
revoke execute on function app.golpe_limite(text, integer, integer) from public, anon, authenticated;
grant execute on function app.golpe_limite(text, integer, integer) to service_role;
grant all on rate_limits to service_role;
