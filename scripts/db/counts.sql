-- Exact row counts of every table a restore must bring back, one per line:
-- "schema.table<TAB>count". The drill compares these before and after.
select format('select %L, count(*) from %I.%I', n.nspname || '.' || c.relname, n.nspname, c.relname)
  from pg_class c join pg_namespace n on n.oid = c.relnamespace
 where c.relkind in ('r', 'p')
   and (n.nspname in ('public', 'private')
        or (n.nspname, c.relname) in (('auth', 'users'), ('auth', 'identities'),
                                      ('auth', 'mfa_factors'), ('storage', 'objects'),
                                      ('storage', 'buckets')))
 order by 1
\gexec
