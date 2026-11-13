begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email) values
  ('00000000-0000-0000-0000-0000000010a1', 'acct-a@test.local'),
  ('00000000-0000-0000-0000-0000000010b2', 'acct-b@test.local');

insert into public.library_items (id, owner_id, type, name) values
  ('00000000-0000-0000-0000-00000010aa01', '00000000-0000-0000-0000-0000000010a1', 'config', 'mine'),
  ('00000000-0000-0000-0000-00000010bb01', '00000000-0000-0000-0000-0000000010b2', 'config', 'theirs');
insert into public.library_item_versions (item_id, version, document, size_bytes) values
  ('00000000-0000-0000-0000-00000010aa01', 1, '{"a": 1}', 8);
-- The comment trigger rate-limits by auth.uid(); seed this row without it.
set local session_replication_role = replica;
insert into public.item_comments (id, item_id, author_id, body) values
  ('00000000-0000-0000-0000-00000010cc01', '00000000-0000-0000-0000-00000010bb01',
   '00000000-0000-0000-0000-0000000010a1', 'hello');
set local session_replication_role = origin;
insert into private.rate_limits (user_id, action, window_start)
values ('00000000-0000-0000-0000-0000000010a1', 'comment', now());

-- Only the service role may call either function.
set local role authenticated;
select throws_ok($$ select public.account_export('00000000-0000-0000-0000-0000000010a1') $$,
                 '42501', null, 'a signed-in user cannot call account_export');
select throws_ok($$ select public.account_prepare_delete('00000000-0000-0000-0000-0000000010a1') $$,
                 '42501', null, 'a signed-in user cannot call account_prepare_delete');
reset role;

set local role service_role;
select is(public.account_export('00000000-0000-0000-0000-0000000010a1') #>> '{account,email}',
          'acct-a@test.local', 'the export holds the account email');
select is(jsonb_array_length(public.account_export('00000000-0000-0000-0000-0000000010a1') -> 'library'),
          1, 'the export holds only the user''s own items');
select is(public.account_export('00000000-0000-0000-0000-0000000010a1') #>> '{library,0,versions,0,document,a}',
          '1', 'items carry their versions');
select is(jsonb_array_length(public.account_export('00000000-0000-0000-0000-0000000010a1') -> 'comments'),
          1, 'the export holds the user''s comments');
reset role;

insert into public.purchases (user_id, plan_key, type, status, stripe_subscription_id)
select '00000000-0000-0000-0000-0000000010a1', key, 'subscription', 'active', 'sub_test_10'
  from public.plans where billing = 'subscription' limit 1;
set local role service_role;
select throws_ok($$ select public.account_prepare_delete('00000000-0000-0000-0000-0000000010a1') $$,
                 'P0001', 'active_subscription', 'a billing subscription blocks deletion');
reset role;
update public.purchases set status = 'ended' where stripe_subscription_id = 'sub_test_10';

set local role service_role;
select is(public.account_prepare_delete('00000000-0000-0000-0000-0000000010a1'), '{}'::text[],
          'no storage objects to remove');
reset role;
select is((select body from public.item_comments where id = '00000000-0000-0000-0000-00000010cc01'),
          '', 'the comment text is cleared');
select is((select count(*)::int from private.rate_limits
            where user_id = '00000000-0000-0000-0000-0000000010a1'), 0, 'rate-limit rows are gone');

delete from auth.users where id = '00000000-0000-0000-0000-0000000010a1';
select is((select count(*)::int from public.library_items
            where owner_id = '00000000-0000-0000-0000-0000000010a1'), 0, 'items cascade with the user');
select is((select author_id from public.item_comments where id = '00000000-0000-0000-0000-00000010cc01'),
          null, 'the comment stays as [deleted]');
select is((select user_id from public.purchases where stripe_subscription_id = 'sub_test_10'),
          null, 'purchases stay for tax records, unlinked');

select * from finish();
rollback;
