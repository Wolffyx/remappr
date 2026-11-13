-- Housekeeping jobs: purge sync tombstones after 30 days, prune rate-limit
-- windows and the audit log. The Stripe reconcile job (pg_net) lands with P6.

create extension if not exists pg_cron;   -- if the migration role lacks rights: enable in Dashboard → Integrations → Cron

select cron.schedule('purge-deleted-items', '17 3 * * *',
  $$delete from public.library_items where deleted_at < now() - interval '30 days'$$);
select cron.schedule('prune-rate-limits', '*/30 * * * *',
  $$delete from private.rate_limits where window_start < now() - interval '35 days'$$);
select cron.schedule('prune-audit-log', '29 3 * * 0',
  $$delete from private.audit_log
     where at < now() - case when kind = 'package_download' then interval '2 years' else interval '1 year' end$$);
