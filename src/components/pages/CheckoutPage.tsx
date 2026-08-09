import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { Button, Input, Spinner } from '@/components/ui';
import { formatCurrency, classNames } from '@/lib/utils';
import type { PaymentLink } from '@/lib/types';
import {
  CreditCard, Lock, CheckCircle, Globe, AlertCircle, ArrowLeft,
  Wallet, ShieldCheck, Loader2,
} from 'lucide-react';

interface CheckoutPageProps {
  linkId: string;
  onBack: () => void;
}

const RAZORPAY_SCRIPT = 'https://checkout.razorpay.com/v1/checkout.js';

export function CheckoutPage({ linkId, onBack }: CheckoutPageProps) {
  const [link, setLink] = useState<PaymentLink | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [method, setMethod] = useState<string>('card');
  const [email, setEmail] = useState('');
  const [name, setName] = useState('');
  const [processing, setProcessing] = useState(false);
  const [success, setSuccess] = useState<{ txnId: string } | null>(null);
  const [scriptLoaded, setScriptLoaded] = useState(false);

  useEffect(() => {
    // Load Razorpay script
    if (document.querySelector(`script[src="${RAZORPAY_SCRIPT}"]`)) {
      setScriptLoaded(true);
      return;
    }
    const script = document.createElement('script');
    script.src = RAZORPAY_SCRIPT;
    script.async = true;
    script.onload = () => setScriptLoaded(true);
    script.onerror = () => setError('Failed to load payment gateway. Please refresh the page.');
    document.body.appendChild(script);
  }, []);

  useEffect(() => {
    async function loadLink() {
      const { data, error: queryError } = await supabase
        .from('payment_links')
        .select('*')
        .eq('link_id', linkId)
        .maybeSingle();

      if (queryError || !data) {
        setError('Payment link not found or no longer active.');
        setLoading(false);
        return;
      }

      const linkData = data as PaymentLink;

      if (linkData.status !== 'active') {
        setError('This payment link is no longer active.');
        setLoading(false);
        return;
      }

      if (linkData.expires_at && new Date(linkData.expires_at) < new Date()) {
        setError('This payment link has expired.');
        setLoading(false);
        return;
      }

      if (linkData.max_uses > 0 && linkData.use_count >= linkData.max_uses) {
        setError('This payment link has reached its usage limit.');
        setLoading(false);
        return;
      }

      setLink(linkData);
      if (linkData.payment_methods.length > 0) {
        setMethod(linkData.payment_methods[0]);
      }
      setLoading(false);
    }
    loadLink();
  }, [linkId]);

  async function callEdgeFunction(body: Record<string, unknown>) {
    const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/razorpay-checkout`;
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
    };
    // Attach anon key for auth
    const anonKey = import.meta.env.VITE_SUPABASE_ANON_KEY;
    if (anonKey) headers['Authorization'] = `Bearer ${anonKey}`;

    const res = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify(body),
    });

    if (!res.ok) {
      const errBody = await res.json().catch(() => ({}));
      throw new Error(errBody.error || `Request failed (${res.status})`);
    }

    const data = await res.json();
    if (data.error) throw new Error(data.error);
    return data;
  }

  async function handlePay() {
    if (!link || !scriptLoaded) return;
    setProcessing(true);
    setError(null);

    try {
      // Step 1: Create Razorpay order via edge function
      const orderRes = await callEdgeFunction({
        action: 'create_order',
        linkId,
      });

      // Step 2: Open Razorpay checkout modal
      const rzp = new window.Razorpay!({
        key: orderRes.keyId,
        amount: orderRes.amount,
        currency: orderRes.currency,
        name: orderRes.title || link.title,
        description: link.description || undefined,
        order_id: orderRes.orderId,
        prefill: {
          name: name || undefined,
          email: email || undefined,
        },
        notes: {
          link_id: linkId,
          payment_method: method,
        },
        theme: {
          color: '#0f172a',
        },
        handler: async (response) => {
          // Step 3: Verify payment server-side
          try {
            const verifyRes = await callEdgeFunction({
              action: 'verify_payment',
              razorpay_order_id: response.razorpay_order_id,
              razorpay_payment_id: response.razorpay_payment_id,
              razorpay_signature: response.razorpay_signature,
              merchantId: orderRes.merchantId,
              method,
              email,
              name,
              linkId,
              amount: orderRes.amount,
              currency: orderRes.currency,
              description: link.title,
            });

            setProcessing(false);
            if (verifyRes.success) {
              setSuccess({ txnId: verifyRes.txnId });
            } else {
              setError(verifyRes.error || 'Payment verification failed.');
            }
          } catch (err) {
            setProcessing(false);
            setError(err instanceof Error ? err.message : 'Payment verification failed.');
          }
        },
        modal: {
          ondismiss: () => {
            setProcessing(false);
          },
        },
      });

      rzp.on('payment.failed', () => {
        setProcessing(false);
        setError('Payment failed. Please try again.');
      });

      rzp.open();
    } catch (err) {
      setProcessing(false);
      setError(err instanceof Error ? err.message : 'Failed to initiate payment.');
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner size={40} />
      </div>
    );
  }

  if (success) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-emerald-50 flex items-center justify-center mx-auto mb-5">
              <CheckCircle className="w-8 h-8 text-emerald-600" />
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mb-2">Payment Successful</h1>
            <p className="text-slate-500 mb-1">Your payment has been processed.</p>
            <p className="text-sm text-slate-400 mb-6">Transaction ID: <span className="font-mono font-medium text-slate-600">{success.txnId}</span></p>
            <div className="bg-slate-50 rounded-lg p-4 mb-6">
              <p className="text-sm text-slate-500">Amount Paid</p>
              <p className="text-2xl font-bold text-slate-900">{link ? formatCurrency(link.amount, link.currency) : ''}</p>
            </div>
            <p className="text-xs text-slate-400 flex items-center justify-center gap-1.5">
              <Lock className="w-3 h-3" /> Secured by Razorpay
            </p>
          </div>
        </div>
      </div>
    );
  }

  if (error) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full">
          <div className="bg-white rounded-2xl shadow-lg p-8 text-center">
            <div className="w-16 h-16 rounded-full bg-rose-50 flex items-center justify-center mx-auto mb-5">
              <AlertCircle className="w-8 h-8 text-rose-600" />
            </div>
            <h1 className="text-xl font-bold text-slate-900 mb-2">Unable to Process</h1>
            <p className="text-slate-500 mb-6">{error}</p>
            <Button variant="outline" onClick={() => { setError(null); onBack(); }}>
              <ArrowLeft className="w-4 h-4" /> Go Back
            </Button>
          </div>
        </div>
      </div>
    );
  }

  if (!link) return null;

  const methodLabels: Record<string, string> = {
    card: 'Credit / Debit Card',
    paypal: 'PayPal',
    bank_transfer: 'Net Banking',
    wallet: 'Digital Wallet',
    upi: 'UPI',
    crypto: 'Cryptocurrency',
  };

  const methodIcons: Record<string, typeof CreditCard> = {
    card: CreditCard,
    paypal: Wallet,
    bank_transfer: CreditCard,
    wallet: Wallet,
    upi: CreditCard,
    crypto: CreditCard,
  };

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      {/* Header */}
      <header className="bg-white border-b border-slate-200">
        <div className="max-w-2xl mx-auto px-4 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white">
              <Globe className="w-4 h-4" />
            </div>
            <span className="font-semibold text-slate-900">PayFlow</span>
          </div>
          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <Lock className="w-3 h-3" /> Secured by Razorpay
          </div>
        </div>
      </header>

      {/* Checkout body */}
      <div className="flex-1 max-w-2xl mx-auto w-full px-4 py-8">
        <button onClick={onBack} className="flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-700 mb-6 transition-colors">
          <ArrowLeft className="w-4 h-4" /> Back
        </button>

        <div className="grid grid-cols-1 lg:grid-cols-5 gap-6">
          {/* Left: form */}
          <div className="lg:col-span-3 space-y-6">
            {/* Amount summary */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h2 className="text-sm font-medium text-slate-500 mb-1">Paying</h2>
              <p className="text-3xl font-bold text-slate-900">{formatCurrency(link.amount, link.currency)}</p>
              <h3 className="text-base font-semibold text-slate-900 mt-3">{link.title}</h3>
              {link.description && <p className="text-sm text-slate-500 mt-1">{link.description}</p>}
            </div>

            {/* Payment method selection */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <h3 className="text-sm font-medium text-slate-700 mb-3">Choose a payment method</h3>
              <div className="space-y-2">
                {link.payment_methods.map((m) => {
                  const Icon = methodIcons[m] ?? CreditCard;
                  const selected = method === m;
                  return (
                    <button
                      key={m}
                      onClick={() => setMethod(m)}
                      className={classNames(
                        'w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all',
                        selected ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                      )}
                    >
                      <div className={classNames(
                        'w-10 h-10 rounded-lg flex items-center justify-center',
                        selected ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                      )}>
                        <Icon className="w-5 h-5" />
                      </div>
                      <span className="text-sm font-medium text-slate-900 flex-1 text-left">{methodLabels[m] ?? m}</span>
                      <div className={classNames(
                        'w-5 h-5 rounded-full border-2 flex items-center justify-center',
                        selected ? 'border-slate-900' : 'border-slate-300'
                      )}>
                        {selected && <div className="w-2.5 h-2.5 rounded-full bg-slate-900" />}
                      </div>
                    </button>
                  );
                })}
              </div>
            </div>

            {/* Customer info */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 space-y-4">
              <h3 className="text-sm font-medium text-slate-700">Your Details</h3>
              <Input label="Email" type="email" value={email} onChange={setEmail} placeholder="you@example.com" />
              <Input label="Name" value={name} onChange={setName} placeholder="John Doe" />
            </div>

            {/* Info banner */}
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="w-5 h-5 text-slate-400 mt-0.5 flex-shrink-0" />
                <div>
                  <p className="text-sm text-slate-600">
                    You'll be redirected to Razorpay's secure checkout to complete your payment. Razorpay supports cards, UPI, net banking, and wallets.
                  </p>
                </div>
              </div>
            </div>
          </div>

          {/* Right: order summary / pay button */}
          <div className="lg:col-span-2">
            <div className="bg-white rounded-xl border border-slate-200 shadow-sm p-5 lg:sticky lg:top-6">
              <h3 className="text-sm font-medium text-slate-700 mb-4">Order Summary</h3>
              <div className="space-y-2 mb-4">
                <div className="flex justify-between text-sm">
                  <span className="text-slate-500">{link.title}</span>
                  <span className="font-medium text-slate-900">{formatCurrency(link.amount, link.currency)}</span>
                </div>
                <div className="flex justify-between text-sm pt-2 border-t border-slate-100">
                  <span className="font-semibold text-slate-900">Total</span>
                  <span className="font-bold text-slate-900">{formatCurrency(link.amount, link.currency)}</span>
                </div>
              </div>
              <Button
                onClick={handlePay}
                disabled={processing || !scriptLoaded}
                size="lg"
                className="w-full"
              >
                {processing ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Processing...</>
                ) : !scriptLoaded ? (
                  <><Loader2 className="w-4 h-4 animate-spin" /> Loading gateway...</>
                ) : (
                  <>Pay {formatCurrency(link.amount, link.currency)}</>
                )}
              </Button>
              <p className="text-xs text-slate-400 text-center mt-3 flex items-center justify-center gap-1.5">
                <Lock className="w-3 h-3" /> Payments are secured and encrypted by Razorpay
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
