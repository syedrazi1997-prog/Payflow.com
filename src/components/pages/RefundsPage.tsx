import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  Card, Badge, Button, Input, Select, Modal, EmptyState, Spinner,
} from '@/components/ui';
import { formatCurrency, formatDate, generateTxnId, amountToMinorUnit } from '@/lib/utils';
import { REFUND_REASONS } from '@/lib/constants';
import type { Refund, Payment } from '@/lib/types';
import { RotateCcw, Search } from 'lucide-react';

export function RefundsPage({ externalPayment, onConsumed }: { externalPayment?: Payment | null; onConsumed?: () => void }) {
  const { merchant } = useAuth();
  const [loading, setLoading] = useState(true);
  const [refunds, setRefunds] = useState<Refund[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [targetPayment, setTargetPayment] = useState<Payment | null>(null);

  // Create form
  const [amount, setAmount] = useState('');
  const [reason, setReason] = useState('customer_request');
  const [creating, setCreating] = useState(false);

  async function loadRefunds() {
    if (!merchant) return;
    const { data } = await supabase
      .from('refunds')
      .select('*, payments(*)')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });
    setRefunds((data ?? []) as Refund[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!merchant) return;
    loadRefunds();
  }, [merchant]);

  // Handle external payment passed from Payments page
  useEffect(() => {
    if (externalPayment) {
      setTargetPayment(externalPayment);
      setAmount(String(externalPayment.amount / 100));
      setShowCreate(true);
      onConsumed?.();
    }
  }, [externalPayment, onConsumed]);

  async function handleCreate() {
    if (!merchant || !targetPayment) return;
    setCreating(true);
    const minorAmount = amountToMinorUnit(parseFloat(amount), targetPayment.currency);
    const txnId = generateTxnId('re');

    const { error } = await supabase.from('refunds').insert({
      merchant_id: merchant.id,
      payment_id: targetPayment.id,
      txn_id: txnId,
      amount: minorAmount,
      currency: targetPayment.currency,
      status: 'succeeded',
      reason,
    });

    if (!error) {
      await supabase.from('merchants')
        .update({ available_balance: Math.max(0, merchant.available_balance - minorAmount) })
        .eq('id', merchant.id);
    }

    setCreating(false);
    setShowCreate(false);
    setTargetPayment(null);
    setAmount('');
    loadRefunds();
  }

  const filtered = refunds.filter((r) =>
    !search ||
    r.txn_id.toLowerCase().includes(search.toLowerCase()) ||
    (r.reason ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Spinner size={32} /></div>;
  }

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Refunds</h1>
        <p className="text-slate-500 text-sm mt-1">{refunds.length} total refunds</p>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search refunds..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/40"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<RotateCcw className="w-7 h-7" />}
            title="No refunds yet"
            description="Refunds will appear here when you process one from the Payments page."
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Refund ID</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Payment</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Amount</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Reason</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Date</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Status</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((r) => (
                  <tr key={r.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-slate-900 font-mono">{r.txn_id}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-slate-600 font-mono">{r.payments?.txn_id ?? '—'}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-semibold text-rose-600">-{formatCurrency(r.amount, r.currency)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-slate-600 capitalize">{(r.reason ?? '—').replace('_', ' ')}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-slate-500">{formatDate(r.created_at)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge status={r.status}>{r.status}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      <Modal open={showCreate} onClose={() => { setShowCreate(false); setTargetPayment(null); }} title="Process Refund">
        {targetPayment && (
          <div className="space-y-4">
            <div className="bg-slate-50 rounded-lg p-4 space-y-2">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Payment</span>
                <span className="font-mono text-slate-900">{targetPayment.txn_id}</span>
              </div>
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Original Amount</span>
                <span className="font-semibold text-slate-900">{formatCurrency(targetPayment.amount, targetPayment.currency)}</span>
              </div>
            </div>
            <Input
              label="Refund Amount"
              type="number"
              value={amount}
              onChange={setAmount}
              placeholder="0.00"
              required
            />
            <Select
              label="Reason"
              value={reason}
              onChange={setReason}
              options={REFUND_REASONS}
            />
            <div className="flex justify-end gap-3 pt-2">
              <Button variant="outline" onClick={() => { setShowCreate(false); setTargetPayment(null); }}>Cancel</Button>
              <Button variant="danger" onClick={handleCreate} disabled={creating || !amount}>
                {creating ? 'Processing...' : 'Refund'}
              </Button>
            </div>
          </div>
        )}
      </Modal>
    </div>
  );
}
