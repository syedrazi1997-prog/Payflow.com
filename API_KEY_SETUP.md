# PayFlow API Key Generation Fix

## 1. Configure Supabase
Set these Vite variables in your local `.env` / hosting environment:

VITE_SUPABASE_URL=https://lxbvechmapkaedahbwlv.supabase.co
VITE_SUPABASE_PUBLISHABLE_KEY=<your sb_publishable_... key>

The frontend also accepts the legacy `VITE_SUPABASE_ANON_KEY` variable.

## 2. Apply the database migration
In Supabase Dashboard -> SQL Editor, run:

supabase/migrations/20260809130000_fix_api_key_generation.sql

This creates the `api_keys` table, RLS policies, and the `create_api_key()` function.

## 3. Build
npm install
npm run typecheck
npm run build

## 4. Generate a key
Settings -> API Keys -> Create API Key.

The complete key is returned once, for example:
pf_test_<secret>
pf_live_<secret>

Only the SHA-256 hash is stored in the database.
