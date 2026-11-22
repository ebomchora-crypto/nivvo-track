-- Rode no SQL Editor depois de preencher <PROJECT_REF>, <SERVICE_ROLE_KEY>, <APP_URL>, <CRON_SECRET>.
-- (Os valores ficam só no banco; não os commite.)
create extension if not exists pg_cron;
create extension if not exists pg_net;

-- Sync de gasto da Meta: toda hora, minuto 0.
select cron.schedule('nivvo-sync-meta', '0 * * * *', $$
  select net.http_post(
    url := 'https://<PROJECT_REF>.functions.supabase.co/sync-meta-spend',
    headers := jsonb_build_object('Authorization', 'Bearer <SERVICE_ROLE_KEY>', 'Content-Type', 'application/json'),
    body := '{}'::jsonb);
$$);

-- Avaliação de sinais e alertas: toda hora, minuto 10 (depois do sync).
select cron.schedule('nivvo-alerts', '10 * * * *', $$
  select net.http_post(
    url := '<APP_URL>/api/cron/alerts',
    headers := jsonb_build_object('Authorization', 'Bearer <CRON_SECRET>'),
    body := '{}'::jsonb);
$$);
