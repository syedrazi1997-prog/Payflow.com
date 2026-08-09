-- PayFlow API key generation
-- Run this migration once in the Supabase SQL Editor for project:
-- https://lxbvechmapkaedahbwlv.supabase.co

create extension if not exists pgcrypto;

create table if not exists public.api_keys (
  id uuid primary key default gen_random_uuid(),
  merchant_id uuid not null references public.merchants(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null,
  key_prefix text not null,
  key_hash text not null unique,
  environment text not null check (environment in ('test', 'live')),
  status text not null default 'active' check (status in ('active', 'revoked')),
  last_used_at timestamptz,
  expires_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists api_keys_merchant_id_idx
  on public.api_keys (merchant_id);

create index if not exists api_keys_key_prefix_idx
  on public.api_keys (key_prefix);

alter table public.api_keys enable row level security;

drop policy if exists "api_keys_select_own" on public.api_keys;
create policy "api_keys_select_own"
on public.api_keys
for select
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.merchants m
    where m.id = api_keys.merchant_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "api_keys_update_own" on public.api_keys;
create policy "api_keys_update_own"
on public.api_keys
for update
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.merchants m
    where m.id = api_keys.merchant_id
      and m.user_id = auth.uid()
  )
)
with check (
  user_id = auth.uid()
  and exists (
    select 1 from public.merchants m
    where m.id = api_keys.merchant_id
      and m.user_id = auth.uid()
  )
);

drop policy if exists "api_keys_delete_own" on public.api_keys;
create policy "api_keys_delete_own"
on public.api_keys
for delete
to authenticated
using (
  user_id = auth.uid()
  and exists (
    select 1 from public.merchants m
    where m.id = api_keys.merchant_id
      and m.user_id = auth.uid()
  )
);

create or replace function public.create_api_key(
  p_merchant_id uuid,
  p_name text,
  p_environment text
)
returns jsonb
language plpgsql
security definer
set search_path = public, extensions
as $$
declare
  v_user_id uuid := auth.uid();
  v_secret text;
  v_prefix text;
  v_hash text;
  v_id uuid;
  v_name text := btrim(coalesce(p_name, ''));
  v_env text := lower(btrim(coalesce(p_environment, '')));
begin
  if v_user_id is null then
    raise exception 'You must be signed in to create an API key.';
  end if;

  if v_name = '' then
    raise exception 'API key name is required.';
  end if;

  if length(v_name) > 100 then
    raise exception 'API key name must be 100 characters or fewer.';
  end if;

  if v_env not in ('test', 'live') then
    raise exception 'Environment must be test or live.';
  end if;

  if not exists (
    select 1
    from public.merchants m
    where m.id = p_merchant_id
      and m.user_id = v_user_id
  ) then
    raise exception 'You do not have access to this merchant.';
  end if;

  -- Generate a high-entropy secret. Only the hash is stored.
  v_secret := encode(gen_random_bytes(32), 'hex');
  v_prefix := case when v_env = 'live' then 'pf_live_' else 'pf_test_' end;
  v_hash := encode(digest(v_prefix || v_secret, 'sha256'), 'hex');

  insert into public.api_keys (
    merchant_id,
    user_id,
    name,
    key_prefix,
    key_hash,
    environment,
    status
  )
  values (
    p_merchant_id,
    v_user_id,
    v_name,
    v_prefix,
    v_hash,
    v_env,
    'active'
  )
  returning id into v_id;

  return jsonb_build_object(
    'success', true,
    'id', v_id,
    'key', v_prefix || v_secret,
    'key_prefix', v_prefix,
    'environment', v_env
  );
end;
$$;

revoke all on function public.create_api_key(uuid, text, text) from public;
grant execute on function public.create_api_key(uuid, text, text) to authenticated;

-- Keep updated_at current when API keys are changed.
create or replace function public.set_api_key_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

drop trigger if exists api_keys_set_updated_at on public.api_keys;
create trigger api_keys_set_updated_at
before update on public.api_keys
for each row execute function public.set_api_key_updated_at();
