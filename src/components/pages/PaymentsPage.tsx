import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  Card, Badge, Button, Input, Select, Modal, EmptyState, Spinner, Textarea,
} from '@/components/ui';
import {
  formatCurrency, formatDate, generateTxnId, amountToMinorUnit, classNames,
} from '@/lib/utils';
import { CURRENCIES, PAYMENT_METHODS } from '@/lib/constants';
import type { Payment, Customer, PaymentLink } from '@/lib/types';
import {
  CreditCard, Plus, Search, RotateCcw, Link2, Copy, Check, ExternalLink,
  Power, Trash2,
} from 'lucide-react';

type Tab = 'payments' | 'links';

export function PaymentsPage({ onRefund, onNavigate }: { onRefund?: (payment: Payment) => void; onNavigate?: (page: string) => void }) {
  const { merchant } = useAuth();
  const [tab, setTab] = useState<Tab>('payments');
  const [loading, setLoading] = useState(true);
  const [payments, setPayments] = useState<Payment[]>([]);
  const [links, setLinks] = useState<PaymentLink[]>([]);
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [showCreate, setShowCreate] = useState(false);
  const [showCreateLink, setShowCreateLink] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [copiedId, setCopiedId] = useState<string | null>(null);

  // Create payment form
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(merchant?.default_currency ?? 'USD');
  const [method, setMethod] = useState('card');
  const [customerId, setCustomerId] = useState('');
  const [description, setDescription] = useState('');
  const [creating, setCreating] = useState(false);

  // Create link form
  const [linkAmount, setLinkAmount] = useState('');
  const [linkCurrency, setLinkCurrency] = useState(merchant?.default_currency ?? 'USD');
  const [linkTitle, setLinkTitle] = useState('');
  const [linkDescription, setLinkDescription] = useState('');
  const [linkMethods, setLinkMethods] = useState<string[]>(['card', 'paypal']);
  const [linkMaxUses, setLinkMaxUses] = useState('0');
  const [linkExpiresAt, setLinkExpiresAt] = useState('');
  const [creatingLink, setCreatingLink] = useState(false);

  async function loadPayments() {
    if (!merchant) return;
    const [payRes, linkRes] = await Promise.all([
      supabase.from('payments').select('*, customers(*)').eq('merchant_id', merchant.id).order('created_at', { ascending: false }),
      supabase.from('payment_links').select('*').eq('merchant_id', merchant.id).order('created_at', { ascending: false }),
    ]);
    setPayments((payRes.data ?? []) as Payment[]);
    setLinks((linkRes.data ?? []) as PaymentLink[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!merchant) return;
    loadPayments();
    supabase
      .from('customers')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('name')
      .then(({ data }) => setCustomers((data ?? []) as Customer[]));
  }, [merchant]);

  async function handleCreate() {
    if (!merchant) return;
    setCreating(true);
    const minorAmount = amountToMinorUnit(parseFloat(amount), currency);
    const txnId = generateTxnId('pay');
    const { error } = await supabase.from('payments').insert({
      merchant_id: merchant.id,
      customer_id: customerId || null,
      txn_id: txnId,
      amount: minorAmount,
      currency,
      status: 'succeeded',
      payment_method: method,
      description: description || null,
    });

    if (!error) {
      await supabase.from('merchants')
        .update({ available_balance: merchant.available_balance + minorAmount })
        .eq('id', merchant.id);
    }

    setCreating(false);
    setShowCreate(false);
    setAmount(''); setDescription(''); setCustomerId('');
    loadPayments();
  }

  async function handleCreateLink() {
    if (!merchant) return;
    setCreatingLink(true);
    const minorAmount = amountToMinorUnit(parseFloat(linkAmount), linkCurrency);
    await supabase.from('payment_links').insert({
      merchant_id: merchant.id,
      amount: minorAmount,
      currency: linkCurrency,
      title: linkTitle,
      description: linkDescription || null,
      payment_methods: linkMethods,
      max_uses: parseInt(linkMaxUses) || 0,
      expires_at: linkExpiresAt || null,
    });
    setCreatingLink(false);
    setShowCreateLink(false);
    setLinkAmount(''); setLinkTitle(''); setLinkDescription(''); setLinkMaxUses('0'); setLinkExpiresAt('');
    setLinkMethods(['card', 'paypal']);
    loadPayments();
  }

  async function toggleLinkStatus(link: PaymentLink) {
    const newStatus = link.status === 'active' ? 'disabled' : 'active';
    await supabase.from('payment_links').update({ status: newStatus }).eq('id', link.id);
    loadPayments();
  }

  async function deleteLink(link: PaymentLink) {
    await supabase.from('payment_links').delete().eq('id', link.id);
    loadPayments();
  }

  function copyLinkUrl(linkId: string) {
    const url = `${window.location.origin}/checkout/${linkId}`;
    navigator.clipboard.writeText(url);
    setCopiedId(linkId);
    setTimeout(() => setCopiedId(null), 2000);
  }

  function openCheckout(linkId: string) {
    window.open(`/checkout/${linkId}`, '_blank');
  }

  const filteredPayments = payments.filter((p) => {
    const matchesSearch = !search ||
      p.txn_id.toLowerCase().includes(search.toLowerCase()) ||
      (p.description ?? '').toLowerCase().includes(search.toLowerCase()) ||
      (p.customers?.name ?? '').toLowerCase().includes(search.toLowerCase());
    const matchesStatus = statusFilter === 'all' || p.status === statusFilter;
    return matchesSearch && matchesStatus;
  });

  const filteredLinks = links.filter((l) =>
    !search || l.title.toLowerCase().includes(search.toLowerCase()) || l.link_id.toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Spinner size={32} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payments</h1>
          <p className="text-slate-500 text-sm mt-1">
            {tab === 'payments' ? `${payments.length} total payments` : `${links.length} payment links`}
          </p>
        </div>
        {tab === 'payments' ? (
          <Button onClick={() => setShowCreate(true)}>
            <Plus className="w-4 h-4" /> Create Payment
          </Button>
        ) : (
          <Button onClick={() => setShowCreateLink(true)}>
            <Plus className="w-4 h-4" /> Create Payment Link
          </Button>
        )}
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        <button
          onClick={() => setTab('payments')}
          className={classNames(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
            tab === 'payments' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
        >
          <CreditCard className="w-4 h-4 inline mr-1.5" /> Payments
        </button>
        <button
          onClick={() => setTab('links')}
          className={classNames(
            'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px',
            tab === 'links' ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
        >
          <Link2 className="w-4 h-4 inline mr-1.5" /> Payment Links
        </button>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3 flex-wrap">
        <div className="relative flex-1 min-w-[200px]">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={tab === 'payments' ? 'Search by ID, description, or customer...' : 'Search by title or link ID...'}
            className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:border-slate-400"
          />
        </div>
        {tab === 'payments' && (
          <Select
            value={statusFilter}
            onChange={setStatusFilter}
            options={[
              { value: 'all', label: 'All statuses' },
              { value: 'succeeded', label: 'Succeeded' },
              { value: 'pending', label: 'Pending' },
              { value: 'failed', label: 'Failed' },
              { value: 'cancelled', label: 'Cancelled' },
            ]}
            className="w-auto"
          />
        )}
      </div>

      {/* Content */}
      {tab === 'payments' ? (
        filteredPayments.length === 0 ? (
          <Card>
            <EmptyState
              icon={<CreditCard className="w-7 h-7" />}
              title="No payments found"
              description="Create a payment or share a payment link to start collecting."
              action={<Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> Create Payment</Button>}
            />
          </Card>
        ) : (
          <Card className="overflow-hidden">
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b border-slate-100 bg-slate-50/50">
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Transaction</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Customer</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Amount</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Method</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Date</th>
                    <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Status</th>
                    <th className="px-5 py-3"></th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-50">
                  {filteredPayments.map((p) => (
                    <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                      <td className="px-5 py-3.5">
                        <p className="text-sm font-medium text-slate-900 font-mono">{p.txn_id}</p>
                        <p className="text-xs text-slate-400 truncate max-w-[200px]">{p.description ?? '—'}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <p className="text-sm text-slate-700">{p.customers?.name ?? 'Guest'}</p>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm font-semibold text-slate-900">{formatCurrency(p.amount, p.currency)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-slate-600 capitalize">{p.payment_method.replace('_', ' ')}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <span className="text-sm text-slate-500">{formatDate(p.created_at)}</span>
                      </td>
                      <td className="px-5 py-3.5">
                        <Badge status={p.status}>{p.status}</Badge>
                      </td>
                      <td className="px-5 py-3.5 text-right">
                        {p.status === 'succeeded' && onRefund && (
                          <button
                            onClick={() => onRefund(p)}
                            className="text-slate-400 hover:text-rose-600 transition-colors p-1.5 rounded-lg hover:bg-rose-50"
                            title="Refund"
                          >
                            <RotateCcw className="w-4 h-4" />
                          </button>
                        )}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Card>
        )
      ) : (
        filteredLinks.length === 0 ? (
          <Card>
            <EmptyState
              icon={<Link2 className="w-7 h-7" />}
              title="No payment links yet"
              description="Create a shareable link that customers can use to pay with card or PayPal."
              action={<Button onClick={() => setShowCreateLink(true)}><Plus className="w-4 h-4" /> Create Payment Link</Button>}
            />
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredLinks.map((link) => (
              <Card key={link.id} className="p-5 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-3">
                  <div className="w-10 h-10 rounded-lg bg-slate-100 flex items-center justify-center text-slate-600">
                    <Link2 className="w-5 h-5" />
                  </div>
                  <Badge status={link.status === 'active' ? 'open' : link.status === 'disabled' ? 'void' : 'cancelled'}>
                    {link.status}
                  </Badge>
                </div>
                <h3 className="text-base font-semibold text-slate-900 truncate mb-1">{link.title}</h3>
                <p className="text-2xl font-bold text-slate-900 mb-2">{formatCurrency(link.amount, link.currency)}</p>
                {link.description && (
                  <p className="text-sm text-slate-500 mb-3 line-clamp-2">{link.description}</p>
                )}
                <div className="flex items-center gap-3 text-xs text-slate-400 mb-4">
                  <span>{link.use_count}{link.max_uses > 0 ? ` / ${link.max_uses}` : ''} uses</span>
                  <span>•</span>
                  <span>{link.payment_methods.map((m) => m.replace('_', ' ')).join(', ')}</span>
                </div>
                <div className="flex items-center gap-2 pt-3 border-t border-slate-100">
                  <button
                    onClick={() => copyLinkUrl(link.link_id)}
                    className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium bg-slate-900 text-white hover:bg-slate-800 transition-colors"
                  >
                    {copiedId === link.link_id ? <Check className="w-4 h-4" /> : <Copy className="w-4 h-4" />}
                    {copiedId === link.link_id ? 'Copied' : 'Copy Link'}
                  </button>
                  <button
                    onClick={() => openCheckout(link.link_id)}
                    className="p-2 rounded-lg text-slate-400 hover:text-slate-700 hover:bg-slate-100 transition-colors"
                    title="Open checkout"
                  >
                    <ExternalLink className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => toggleLinkStatus(link)}
                    className={classNames(
                      'p-2 rounded-lg transition-colors',
                      link.status === 'active' ? 'text-slate-400 hover:text-amber-600 hover:bg-amber-50' : 'text-slate-400 hover:text-emerald-600 hover:bg-emerald-50'
                    )}
                    title={link.status === 'active' ? 'Disable' : 'Enable'}
                  >
                    <Power className="w-4 h-4" />
                  </button>
                  <button
                    onClick={() => deleteLink(link)}
                    className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    title="Delete"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </Card>
            ))}
          </div>
        )
      )}

      {/* Create payment modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Payment">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Input label="Amount" type="number" value={amount} onChange={setAmount} placeholder="0.00" required />
            <Select label="Currency" value={currency} onChange={setCurrency} options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))} required />
          </div>
          <Select label="Payment Method" value={method} onChange={setMethod} options={PAYMENT_METHODS} />
          <Select
            label="Customer (optional)"
            value={customerId}
            onChange={setCustomerId}
            options={[{ value: '', label: 'Guest checkout' }, ...customers.map((c) => ({ value: c.id, label: `${c.name} (${c.email ?? 'no email'})` }))]}
          />
          <Input label="Description" value={description} onChange={setDescription} placeholder="Product purchase, subscription, etc." />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !amount}>{creating ? 'Processing...' : 'Charge'}</Button>
          </div>
        </div>
      </Modal>

      {/* Create payment link modal */}
      <Modal open={showCreateLink} onClose={() => setShowCreateLink(false)} title="Create Payment Link" maxWidth="max-w-lg">
        <div className="space-y-4">
          <Input label="Title" value={linkTitle} onChange={setLinkTitle} placeholder="e.g. Premium Subscription, Consultation Fee" required />
          <div className="grid grid-cols-2 gap-4">
            <Input label="Amount" type="number" value={linkAmount} onChange={setLinkAmount} placeholder="0.00" required />
            <Select label="Currency" value={linkCurrency} onChange={setLinkCurrency} options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))} required />
          </div>
          <Textarea label="Description (optional)" value={linkDescription} onChange={setLinkDescription} placeholder="What the customer is paying for" rows={2} />

          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Accepted Payment Methods</label>
            <div className="flex flex-wrap gap-2">
              {PAYMENT_METHODS.map((m) => {
                const selected = linkMethods.includes(m.value);
                return (
                  <button
                    key={m.value}
                    onClick={() => {
                      if (selected) {
                        if (linkMethods.length > 1) setLinkMethods(linkMethods.filter((v) => v !== m.value));
                      } else {
                        setLinkMethods([...linkMethods, m.value]);
                      }
                    }}
                    className={classNames(
                      'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                      selected ? 'bg-slate-900 text-white border-slate-900' : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                    )}
                  >
                    {m.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input label="Max Uses (0 = unlimited)" type="number" value={linkMaxUses} onChange={setLinkMaxUses} placeholder="0" />
            <Input label="Expires At (optional)" type="datetime-local" value={linkExpiresAt} onChange={setLinkExpiresAt} />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowCreateLink(false)}>Cancel</Button>
            <Button onClick={handleCreateLink} disabled={creatingLink || !linkAmount || !linkTitle}>
              {creatingLink ? 'Creating...' : 'Create Link'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
