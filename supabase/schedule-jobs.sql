-- Programa las dos tareas diarias. Ejecútalo una vez en el SQL Editor, después de desplegar las funciones.
--   check-recurring: correo de pagos fijos, 8:00 de Venezuela (12:00 UTC).
--   refresh-rates:   tasas BCV y Binance, 9:00 y 17:00 de Venezuela (13:00 y 21:00 UTC).
-- Reemplaza los tres valores REEMPLAZA_... aquí, en el editor. No los guardes en el repositorio.
-- CRON_SECRET tiene que ser el mismo que cargaste en Edge Function Secrets (32 caracteres o más).

create extension if not exists pg_cron;
create extension if not exists pg_net;

select vault.create_secret('https://REEMPLAZA_CON_TU_REF.supabase.co', 'project_url');
select vault.create_secret('REEMPLAZA_CON_LA_ANON_KEY', 'anon_key');
select vault.create_secret('REEMPLAZA_CON_EL_CRON_SECRET', 'cron_secret');

-- En un esquema propio, fuera de la API: nadie lo puede llamar desde la app.
create schema if not exists private;
revoke all on schema private from public, anon, authenticated;

create or replace function private.call_function(name text)
returns bigint
language sql
security definer
set search_path = ''
as $$
  select net.http_post(
    url := (select decrypted_secret from vault.decrypted_secrets where name = 'project_url') || '/functions/v1/' || name,
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'apikey', (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'Authorization', 'Bearer ' || (select decrypted_secret from vault.decrypted_secrets where name = 'anon_key'),
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'cron_secret')
    ),
    body := '{}'::jsonb
  );
$$;

revoke execute on function private.call_function(text) from public, anon, authenticated;

select cron.schedule('anderwallet-recurring-email', '0 12 * * *', $$ select private.call_function('check-recurring'); $$);
select cron.schedule('anderwallet-rates-morning', '0 13 * * *', $$ select private.call_function('refresh-rates'); $$);
select cron.schedule('anderwallet-rates-evening', '0 21 * * *', $$ select private.call_function('refresh-rates'); $$);
