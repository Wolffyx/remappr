-- Local-only seed (`supabase db reset`). Never runs against staging or prod;
-- environment-independent rows live in the migrations.

-- Share links (unlisted items) sign tokens with this Vault secret.
select vault.create_secret(encode(extensions.gen_random_bytes(32), 'hex'), 'share_secret')
 where not exists (select 1 from vault.secrets where name = 'share_secret');
