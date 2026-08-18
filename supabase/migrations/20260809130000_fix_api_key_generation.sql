-- PayFlow API-key generation fix.
-- Root cause: two overloaded public.create_api_key functions exist:
--   (uuid,text,text)
--   (uuid,text,text,timestamptz)
-- PostgREST cannot choose between them for the frontend's three parameters.

create extension if not exists pgcrypto;

drop function if exists public.create_api_key(uuid, text, text);
drop function if exists public.create_api_key(uuid, text, text, timestamptz);

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
  v_row public.api_keys%rowtype;
begin
  if v_user_id is null then
    raise exception 'Authentication required';
  end if;

  if p_merchant_id is null then
    raise exception 'Merchant ID is required';
  end if;

  if p_name is null or btrim(p_name) = '' then
    raise exception 'API key name is required';
  end if;

  if length(btrim(p_name)) > 100 then
    raise exception 'API key name must be 100 characters or fewer';
  end if;

  if p_environment not in ('test', 'live') then
    raise exception 'Environment must be test or live';
  end if;

  if not exists (
    select 1 from public.merchants m
    where m.id = p_merchant_id and m.user_id = v_user_id
  ) then
    raise exception 'You do not have permission to create an API key for this merchant';
  end if;

  v_secret := 'pf_' || p_environment || '_' || encode(gen_random_bytes(32), 'hex');
  v_prefix := left(v_secret, 16);
  v_hash := encode(digest(v_secret, 'sha256'), 'hex');

  insert into public.api_keys (
    merchant_id, user_id, name, key_prefix, key_hash, environment, status
  )
  values (
    p_merchant_id, v_user_id, btrim(p_name), v_prefix, v_hash, p_environment, 'active'
  )
  returning * into v_row;

  return jsonb_build_object(
    'success', true,
    'key', v_secret,
    'id', v_row.id,
    'key_prefix', v_row.key_prefix,
    'environment', v_row.environment
  );
end;
$$;

revoke all on function public.create_api_key(uuid, text, text) from public;
grant execute on function public.create_api_key(uuid, text, text) to authenticated;
