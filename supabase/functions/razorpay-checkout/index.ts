import { createClient } from 'https://esm.sh/@supabase/supabase-js@2.57.4';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const supabase = createClient(
  Deno.env.get('SUPABASE_URL')!,
  Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!,
  { auth: { persistSession: false } },
);

function json(data: unknown, status = 200) {
  return new Response(JSON.stringify(data), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}

function getEnv() { return Deno.env.get('SUPABASE_URL')!; }

async function hmacSha256Hex(secret: string, message: string) {
  const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(secret), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign']);
  const signature = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(message));
  return Array.from(new Uint8Array(signature)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

async function createRazorpayOrder(keyId: string, keySecret: string, amount: number, currency: string, receipt: string, notes: Record<string, string>) {
  const auth = btoa(`${keyId}:${keySecret}`);
  const response = await fetch('https://api.razorpay.com/v1/orders', {
    method: 'POST',
    headers: { Authorization: `Basic ${auth}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ amount, currency, receipt, notes }),
  });
  const data = await response.json();
  if (!response.ok) throw new Error(data?.error?.description ?? data?.error?.reason ?? 'Razorpay order creation failed');
  return data;
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });
  try {
    const body = await req.json();
    const action = body.action;
    if (!action) return json({ error: 'action is required' }, 400);

    const anon = req.headers.get('authorization');
    if (!anon) return json({ error: 'Authorization required' }, 401);

    if (action === 'create_order') {
      const { data: link, error: linkError } = await supabase.from('payment_links').select('*, merchants(*)').eq('link_id', body.linkId).maybeSingle();
      if (linkError || !link) return json({ error: 'Payment link not found' }, 404);
      if (link.status !== 'active') return json({ error: 'Payment link is not active' }, 400);
      if (link.expires_at && new Date(link.expires_at) < new Date()) return json({ error: 'Payment link has expired' }, 400);
      if (link.max_uses > 0 && link.use_count >= link.max_uses) return json({ error: 'Payment link usage limit reached' }, 400);

      const { data: creds, error: credsError } = await supabase
        .from('gateway_credentials')
        .select('key_id, key_secret, webhook_secret, environment')
        .eq('merchant_id', link.merchant_id)
        .eq('gateway', 'razorpay')
        .eq('status', 'active')
        .eq('environment', 'live')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (credsError || !creds?.key_id || !creds?.key_secret) {
        return json({ error: 'PayFlow gateway is not configured for this merchant. Add the Razorpay credentials in PayFlow Settings → Gateway.' }, 400);
      }

      const order = await createRazorpayOrder(
        creds.key_id,
        creds.key_secret,
        Number(link.amount),
        link.currency,
        `PF-${link.link_id}`,
        { link_id: link.link_id },
      );

      return json({ success: true, keyId: creds.key_id, orderId: order.id, amount: order.amount, currency: order.currency, title: link.title, merchantId: link.merchant_id });
    }

    if (action === 'verify_payment') {
      const { data: link, error: linkError } = await supabase.from('payment_links').select('*').eq('link_id', body.linkId).maybeSingle();
      if (linkError || !link) return json({ error: 'Payment link not found' }, 404);

      const { data: creds } = await supabase
        .from('gateway_credentials')
        .select('key_id, key_secret, environment')
        .eq('merchant_id', link.merchant_id)
        .eq('gateway', 'razorpay')
        .eq('status', 'active')
        .eq('environment', 'live')
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();

      if (!creds?.key_secret) return json({ error: 'Gateway credentials are not configured' }, 400);

      const expected = await hmacSha256Hex(creds.key_secret, `${body.razorpay_order_id}|${body.razorpay_payment_id}`);
      if (expected !== body.razorpay_signature) return json({ error: 'Invalid payment signature' }, 400);

      const txnId = String(body.razorpay_payment_id);
      const minorAmount = Number(body.amount ?? link.amount);

      let customerId = null;
      if (body.email || body.name) {
        const { data: existing } = body.email
          ? await supabase.from('customers').select('id').eq('merchant_id', link.merchant_id).eq('email', body.email).maybeSingle()
          : { data: null };
        if (existing?.id) customerId = existing.id;
        else {
          const { data: customer } = await supabase.from('customers').insert({ merchant_id: link.merchant_id, user_id: link.user_id, name: body.name || 'Customer', email: body.email || null, default_currency: link.currency }).select('id').single();
          customerId = customer?.id ?? null;
        }
      }

      const { error: paymentError } = await supabase.from('payments').insert({
        merchant_id: link.merchant_id,
        user_id: link.user_id,
        customer_id: customerId,
        txn_id: txnId,
        amount: minorAmount,
        currency: link.currency,
        status: 'succeeded',
        payment_method: body.method || 'card',
        description: body.description || link.title,
        metadata: { provider: 'razorpay', order_id: body.razorpay_order_id, link_id: link.link_id },
      });

      if (paymentError && !paymentError.message.toLowerCase().includes('duplicate')) {
        throw new Error(`Payment record failed: ${paymentError.message}`);
      }

      await supabase.from('payment_links').update({ use_count: Number(link.use_count ?? 0) + 1 }).eq('id', link.id);

      const { data: merchant } = await supabase.from('merchants').select('available_balance').eq('id', link.merchant_id).single();
      if (merchant) await supabase.from('merchants').update({ available_balance: Number(merchant.available_balance ?? 0) + minorAmount }).eq('id', link.merchant_id);

      return json({ success: true, txnId });
    }

    return json({ error: `Unsupported action: ${action}` }, 400);
  } catch (error) {
    console.error('Checkout function error:', error);
    return json({ error: error instanceof Error ? error.message : 'Unexpected error' }, 500);
  }
});
