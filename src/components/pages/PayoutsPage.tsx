import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  Card, Badge, Button, Input, Select, Modal, EmptyState, Spinner,
} from '@/components/ui';
import { formatCurrency, formatDate, generateTxnId, amountToMinorUnit, classNames } from '@/lib/utils';
import { CURRENCIES, COUNTRIES } from '@/lib/constants';
import type { Payout, BankAccount } from '@/lib/types';
import { Banknote, Plus, Search, Building2, Star, AlertCircle } from 'lucide-react';

export function PayoutsPage() {
  const { merchant, refreshMerchant } = useAuth();
  const [loading, setLoading] = useState(true);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [amount, setAmount] = useState('');
  const [currency, setCurrency] = useState(merchant?.default_currency ?? 'USD');
  const [selectedBankId, setSelectedBankId] = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [creating, setCreating] = useState(false);

  async function loadData() {
    if (!merchant) return;
    const [payRes, bankRes] = await Promise.all([
      supabase.from('payouts').select('*').eq('merchant_id', merchant.id).order('created_at', { ascending: false }),
      supabase.from('bank_accounts').select('*').eq('merchant_id', merchant.id).order('is_default', { ascending: false }),
    ]);
    setPayouts((payRes.data ?? []) as Payout[]);
    setBankAccounts((bankRes.data ?? []) as BankAccount[]);
    const defaultBank = (bankRes.data ?? []).find((b) => b.is_default);
    if (defaultBank) setSelectedBankId(defaultBank.id);
    setLoading(false);
  }

  useEffect(() => {
    if (!merchant) return;
    loadData();
  }, [merchant]);

  async function handleCreate() {
    if (!merchant) return;
    setCreating(true);
    const minorAmount = amountToMinorUnit(parseFloat(amount), currency);
    const txnId = generateTxnId('po');
    const selectedBank = bankAccounts.find((b) => b.id === selectedBankId);

    const { error } = await supabase.from('payouts').insert({
      merchant_id: merchant.id,
      txn_id: txnId,
      amount: minorAmount,
      currency,
      status: 'pending',
      destination_bank: selectedBank?.bank_name ?? null,
      destination_account_last4: selectedBank?.account_number_last4 ?? null,
      destination_country: selectedBank?.country ?? merchant.country,
      scheduled_date: scheduledDate || null,
    });

    if (!error) {
      await supabase.from('merchants')
        .update({ available_balance: Math.max(0, merchant.available_balance - minorAmount) })
        .eq('id', merchant.id);
      refreshMerchant();
    }

    setCreating(false);
    setShowCreate(false);
    setAmount(''); setScheduledDate('');
    loadData();
  }

  const filtered = payouts.filter((p) =>
    !search || p.txn_id.toLowerCase().includes(search.toLowerCase())
  );

  const defaultBank = bankAccounts.find((b) => b.is_default);

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Spinner size={32} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Payouts</h1>
          <p className="text-slate-500 text-sm mt-1">{payouts.length} total payouts</p>
        </div>
        <Button onClick={() => setShowCreate(true)} disabled={bankAccounts.length === 0}>
          <Plus className="w-4 h-4" />
          Create Payout
        </Button>
      </div>

      {/* Balance banner */}
      <Card className="p-5 bg-gradient-to-br from-slate-900 to-slate-800 text-white border-0">
        <div className="flex items-center justify-between flex-wrap gap-4">
          <div>
            <p className="text-sm text-slate-400">Available for payout</p>
            <p className="text-3xl font-bold mt-1">{formatCurrency(merchant?.available_balance ?? 0, merchant?.default_currency ?? 'USD')}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-slate-400">Pending balance</p>
            <p className="text-xl font-semibold mt-1">{formatCurrency(merchant?.pending_balance ?? 0, merchant?.default_currency ?? 'USD')}</p>
          </div>
        </div>
      </Card>

      {/* Connected bank banner */}
      {bankAccounts.length === 0 ? (
        <Card className="p-5 border-amber-200 bg-amber-50">
          <div className="flex items-start gap-3">
            <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
            <div>
              <p className="text-sm font-semibold text-amber-900">No bank account connected</p>
              <p className="text-sm text-amber-700 mt-0.5">
                Connect a bank account in Settings to start creating payouts and receiving your earnings.
              </p>
            </div>
          </div>
        </Card>
      ) : (
        <Card className="p-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-slate-900 flex items-center justify-center text-white">
              <Building2 className="w-5 h-5" />
            </div>
            <div className="flex-1">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-slate-900">{defaultBank?.bank_name ?? bankAccounts[0]?.bank_name}</p>
                {defaultBank && <Badge status="open"><Star className="w-3 h-3" /> Default</Badge>}
              </div>
              <p className="text-xs text-slate-400">
                {defaultBank?.account_holder_name ?? bankAccounts[0]?.account_holder_name} • ••••{defaultBank?.account_number_last4 ?? bankAccounts[0]?.account_number_last4}
              </p>
            </div>
            <span className="text-xs text-slate-400">{bankAccounts.length} account{bankAccounts.length !== 1 ? 's' : ''} connected</span>
          </div>
        </Card>
      )}

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search payouts..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/40"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Banknote className="w-7 h-7" />}
            title="No payouts yet"
            description={bankAccounts.length === 0 ? "Connect a bank account in Settings to start creating payouts." : "Create a payout to send funds to your bank account."}
            action={bankAccounts.length > 0 ? <Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> Create Payout</Button> : undefined}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Payout ID</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Amount</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Destination</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Scheduled</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Date</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((p) => (
                  <tr key={p.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-slate-900 font-mono">{p.txn_id}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(p.amount, p.currency)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-slate-600">{p.destination_bank ?? '—'}</p>
                      {p.destination_account_last4 && (
                        <p className="text-xs text-slate-400">••••{p.destination_account_last4}</p>
                      )}
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-slate-500">{formatDate(p.scheduled_date)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-slate-500">{formatDate(p.created_at)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge status={p.status}>{p.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Payout">
        <div className="space-y-4">
          <div className="bg-slate-50 rounded-lg p-3 text-sm text-slate-600">
            Available: <span className="font-semibold text-slate-900">{formatCurrency(merchant?.available_balance ?? 0, merchant?.default_currency ?? 'USD')}</span>
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Amount"
              type="number"
              value={amount}
              onChange={setAmount}
              placeholder="0.00"
              required
            />
            <Select
              label="Currency"
              value={currency}
              onChange={setCurrency}
              options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
              required
            />
          </div>

          {/* Bank account selector */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-1.5">Destination Bank Account</label>
            <div className="space-y-2">
              {bankAccounts.map((bank) => (
                <button
                  key={bank.id}
                  onClick={() => setSelectedBankId(bank.id)}
                  className={classNames(
                    'w-full flex items-center gap-3 p-3 rounded-lg border-2 transition-all text-left',
                    selectedBankId === bank.id ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                  )}
                >
                  <Building2 className="w-5 h-5 text-slate-500" />
                  <div className="flex-1">
                    <p className="text-sm font-medium text-slate-900">{bank.bank_name}</p>
                    <p className="text-xs text-slate-400">••••{bank.account_number_last4} • {bank.currency}</p>
                  </div>
                  {bank.is_default && <Star className="w-3.5 h-3.5 text-amber-500" />}
                </button>
              ))}
            </div>
          </div>

          <Input
            label="Scheduled Date (optional)"
            type="date"
            value={scheduledDate}
            onChange={setScheduledDate}
          />
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !amount || !selectedBankId}>
              {creating ? 'Processing...' : 'Schedule Payout'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
