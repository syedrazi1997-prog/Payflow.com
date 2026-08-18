import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-api-key, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

const ZERO_DECIMAL = new Set(['JPY', 'KRW', 'VND', 'HUF', 'CLP', 'COP']);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

async function sha256(value: string) {
  const bytes = new TextEncoder().encode(value);
  const hash = await crypto.subtle.digest('SHA-256', bytes);
  return Array.from(new Uint8Array(hash)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

function getApiKey(req: Request) {
  const xApiKey = req.headers.get('x-api-key')?.trim();
  if (xApiKey) return xApiKey;
  const auth = req.headers.get('authorization') ?? '';
  if (auth.toLowerCase().startsWith('bearer ')) return auth.slice(7).trim();
  return '';
}

class AuthError extends Error {}

async function authenticate(req: Request) {
  const secret = getApiKey(req);
  if (!secret || !/^pf_(test|live)_/.test(secret)) {
    throw new AuthError('Invalid PayFlow API key');
  }

  const hash = await sha256(secret);
  const { data: key, error } = await supabase
    .from('api_keys')
    .select('id, merchant_id, user_id, environment, status, expires_at')
    .eq('key_hash', hash)
    .maybeSingle();

  if (error) throw new Error(`API key lookup failed: ${error.message}`);
  if (!key || key.status !== 'active') throw new AuthError('Invalid or revoked PayFlow API key');
  if (key.expires_at && new Date(key.expires_at) < new Date()) throw new AuthError('PayFlow API key has expired');

  const expectedEnv = secret.startsWith('pf_live_') ? 'live' : 'test';
  if (key.environment !== expectedEnv) throw new AuthError('API key environment mismatch');

  await supabase.from('api_keys').update({ last_used_at: new Date().toISOString() }).eq('id', key.id);
  return key;
}

function makeLinkId() {
  return `pl_${crypto.randomUUID().replaceAll('-', '')}`;
}

function toMinor(amount: unknown, currency: string) {
  const value = Number(amount);
  if (!Number.isFinite(value) || value <= 0) throw new Error('amount must be a positive number');
  return ZERO_DECIMAL.has(currency) ? Math.round(value) : Math.round(value * 100);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const key = await authenticate(req);
    const body = await req.json();
    const action = body.action ?? 'create_payment_link';

    if (action === 'health') {
      return json({ success: true, service: 'PayFlow API', environment: key.environment });
    }

    if (action !== 'create_payment_link') {
      return json({ success: false, error: `Unsupported action: ${action}` }, 400);
    }

    const currency = String(body.currency ?? 'USD').toUpperCase();
    const amountMinor = body.amount_minor != null
      ? Number(body.amount_minor)
      : toMinor(body.amount, currency);

    if (!Number.isSafeInteger(amountMinor) || amountMinor <= 0) {
      return json({ success: false, error: 'Invalid amount' }, 400);
    }

    const title = String(body.title ?? 'ZippyGo payment').trim();
    if (!title) return json({ success: false, error: 'title is required' }, 400);

    const linkId = makeLinkId();
    const maxUses = Number.isInteger(body.max_uses) && body.max_uses >= 0 ? body.max_uses : 1;
    const frontendUrl = (Deno.env.get('PAYFLOW_FRONTEND_URL') ?? '').replace(/\/$/, '');
    if (!frontendUrl) return json({ success: false, error: 'PAYFLOW_FRONTEND_URL is not configured' }, 500);

    // Store the customer in PayFlow when the customers table is available.
    let customerId: string | null = null;
    if (body.customer?.email || body.customer?.name || body.customer?.phone) {
      const customer = body.customer;
      const { data: existing } = customer.email
        ? await supabase.from('customers').select('id').eq('merchant_id', key.merchant_id).eq('email', customer.email).maybeSingle()
        : { data: null };

      if (existing?.id) {
        customerId = existing.id;
      } else {
        const { data: createdCustomer, error: customerError } = await supabase.from('customers').insert({
          merchant_id: key.merchant_id,
          user_id: key.user_id,
          name: String(customer.name ?? 'Customer'),
          email: customer.email ? String(customer.email) : null,
          phone: customer.phone ? String(customer.phone) : null,
          default_currency: currency,
          country: customer.country ? String(customer.country) : null,
        }).select('id').single();
        if (customerError) throw new Error(`Customer creation failed: ${customerError.message}`);
        customerId = createdCustomer.id;
      }
    }

    const metadata = {
      source: 'api',
      provider: 'PayFlow',
      reference_id: body.reference_id ?? null,
      customer_id: customerId,
      return_url: body.return_url ?? null,
      cancel_url: body.cancel_url ?? null,
      ...(body.metadata ?? {}),
    };

    // The current payment_links schema does not expose a metadata column, so the
    // reference is returned to the caller and can also be attached to the payment later.
    const { data: link, error: insertError } = await supabase.from('payment_links').insert({
      merchant_id: key.merchant_id,
      user_id: key.user_id,
      link_id: linkId,
      amount: amountMinor,
      currency,
      title,
      description: body.description ? String(body.description) : null,
      status: 'active',
      payment_methods: Array.isArray(body.payment_methods) && body.payment_methods.length
        ? body.payment_methods
        : ['card', 'upi', 'bank_transfer', 'wallet'],
      max_uses: maxUses,
      expires_at: body.expires_at ?? null,
    }).select('id, link_id, amount, currency, status').single();

    if (insertError) throw new Error(`Payment link creation failed: ${insertError.message}`);

    const checkoutUrl = `${frontendUrl}/checkout/${encodeURIComponent(link.link_id)}`;

    return json({
      success: true,
      id: link.id,
      link_id: link.link_id,
      checkout_url: checkoutUrl,
      amount: Number(link.amount) / (ZERO_DECIMAL.has(currency) ? 1 : 100),
      amount_minor: link.amount,
      currency: link.currency,
      status: link.status,
      reference_id: body.reference_id ?? null,
      customer_id: customerId,
      metadata,
    });
  } catch (error) {
    console.error('PayFlow API error:', error);
    return json({ success: false, error: error instanceof Error ? error.message : 'Unexpected error' }, error instanceof AuthError ? 401 : 500);
  }
});
