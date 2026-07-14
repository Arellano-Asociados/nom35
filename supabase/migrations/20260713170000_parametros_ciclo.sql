-- ─────────────────────────────────────────────────────────────────────────────
-- Fase 3: parámetros de ciclo — recordatorios automáticos cada N días.
-- NULL = sin recordatorios automáticos (default sensato: el admin decide).
-- El envío lo dispara un cron idempotente (route handler con CRON_SECRET) que
-- respeta el limitador de la mini-fase 3 y consulta la bitácora para saber cuándo
-- fue el último envío (manual o automático).
-- ─────────────────────────────────────────────────────────────────────────────

alter table compliance_cycles
  add column reminder_interval_days integer
  check (reminder_interval_days is null or reminder_interval_days between 1 and 60);

comment on column compliance_cycles.reminder_interval_days is
  'Recordatorios automáticos a pendientes cada N días (NULL = desactivado). Fase 3.';
