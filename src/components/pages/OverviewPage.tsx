import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import { Card, Badge, Spinner } from '@/components/ui';
import { formatCurrency, formatCurrencyShort, timeAgo, classNames } from '@/lib/utils';
import type { Payment, Invoice, Payout } from '@/lib/types';
import {
  TrendingUp, TrendingDown, CreditCard, Banknote, FileText,
  ArrowUpRight, ArrowDownRight, Clock,
} from 'lucide-react';

interface Stats {
  totalVolume: number;
  totalVolumeCurrency: string;
  succeededCount: number;
  pendingCount: number;
  refundedAmount: number;
  refundedCurrency: string;
  invoiceCount: number;
  payoutCount: number;
}

export function OverviewPage() {
  const { merchant } = useAuth();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState<Stats | null>(null);
  const [recentPayments, setRecentPayments] = useState<Payment[]>([]);
  const [recentInvoices, setRecentInvoices] = useState<Invoice[]>([]);
  const [recentPayouts, setRecentPayouts] = useState<Payout[]>([]);
  const [chartData, setChartData] = useState<{ date: string; amount: number }[]>([]);

  useEffect(() => {
    if (!merchant) return;
    async function load() {
      const [payRes, invRes, payoutRes] = await Promise.all([
        supabase.from('payments').select('*').eq('merchant_id', merchant!.id).order('created_at', { ascending: false }).limit(100),
        supabase.from('invoices').select('*').eq('merchant_id', merchant!.id).order('created_at', { ascending: false }).limit(5),
        supabase.from('payouts').select('*').eq('merchant_id', merchant!.id).order('created_at', { ascending: false }).limit(5),
      ]);

      const payments = (payRes.data ?? []) as Payment[];
      const invoices = (invRes.data ?? []) as Invoice[];
      const payouts = (payoutRes.data ?? []) as Payout[];

      setRecentPayments(payments.slice(0, 6));
      setRecentInvoices(invoices);
      setRecentPayouts(payouts);

      const succeeded = payments.filter((p) => p.status === 'succeeded');
      const currency = merchant!.default_currency;
      const sameCurrencySucceeded = succeeded.filter((p) => p.currency === currency);
      const totalVolume = sameCurrencySucceeded.reduce((sum, p) => sum + p.amount, 0);
      const refunded = payments
        .filter((p) => p.currency === currency)
        .reduce((sum, p) => sum + (p.status === 'succeeded' ? 0 : 0), 0);

      setStats({
        totalVolume,
        totalVolumeCurrency: currency,
        succeededCount: succeeded.length,
        pendingCount: payments.filter((p) => p.status === 'pending').length,
        refundedAmount: refunded,
        refundedCurrency: currency,
        invoiceCount: invoices.length,
        payoutCount: payouts.length,
      });

      // Build 7-day chart
      const days: { date: string; amount: number }[] = [];
      for (let i = 6; i >= 0; i--) {
        const d = new Date();
        d.setDate(d.getDate() - i);
        const dateStr = d.toISOString().slice(0, 10);
        const dayAmount = succeeded
          .filter((p) => p.currency === currency && p.created_at.slice(0, 10) === dateStr)
          .reduce((sum, p) => sum + p.amount, 0);
        days.push({ date: dateStr, amount: dayAmount });
      }
      setChartData(days);
      setLoading(false);
    }
    load();
  }, [merchant]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-24">
        <Spinner size={32} />
      </div>
    );
  }

  const maxBar = Math.max(...chartData.map((d) => d.amount), 1);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Overview</h1>
        <p className="text-slate-500 text-sm mt-1">Welcome back to your dashboard</p>
      </div>

      {/* Stat cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        <StatCard
          label="Available Balance"
          value={formatCurrency(merchant?.available_balance ?? 0, merchant?.default_currency ?? 'USD')}
          icon={<Banknote className="w-5 h-5" />}
          accent="emerald"
        />
        <StatCard
          label="Pending Balance"
          value={formatCurrency(merchant?.pending_balance ?? 0, merchant?.default_currency ?? 'USD')}
          icon={<Clock className="w-5 h-5" />}
          accent="amber"
        />
        <StatCard
          label="Total Volume"
          value={formatCurrency(stats?.totalVolume ?? 0, stats?.totalVolumeCurrency ?? 'USD')}
          icon={<TrendingUp className="w-5 h-5" />}
          accent="blue"
          sublabel={`${stats?.succeededCount ?? 0} successful payments`}
        />
        <StatCard
          label="Pending Payments"
          value={String(stats?.pendingCount ?? 0)}
          icon={<CreditCard className="w-5 h-5" />}
          accent="slate"
        />
      </div>

      {/* Chart */}
      <Card className="p-6">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h3 className="text-base font-semibold text-slate-900">Payment Volume</h3>
            <p className="text-sm text-slate-500">Last 7 days</p>
          </div>
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <div className="w-3 h-3 rounded-full bg-slate-900" />
            <span>{merchant?.default_currency ?? 'USD'}</span>
          </div>
        </div>
        <div className="flex items-end justify-between gap-2 h-48">
          {chartData.map((d) => (
            <div key={d.date} className="flex-1 flex flex-col items-center gap-2">
              <div className="w-full flex items-end justify-center h-full">
                <div
                  className="w-full max-w-[48px] rounded-t-lg bg-gradient-to-t from-slate-700 to-slate-900 transition-all duration-500 hover:from-blue-600 hover:to-blue-800 group relative"
                  style={{ height: `${(d.amount / maxBar) * 100}%`, minHeight: d.amount > 0 ? '8px' : '2px' }}
                >
                  <div className="absolute -top-7 left-1/2 -translate-x-1/2 opacity-0 group-hover:opacity-100 transition-opacity text-xs font-medium text-slate-700 whitespace-nowrap bg-white px-2 py-1 rounded shadow border border-slate-100">
                    {formatCurrencyShort(d.amount, merchant?.default_currency ?? 'USD')}
                  </div>
                </div>
              </div>
              <span className="text-xs text-slate-400">
                {new Date(d.date).toLocaleDateString('en-US', { weekday: 'short' })}
              </span>
            </div>
          ))}
        </div>
      </Card>

      {/* Recent activity */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Recent payments */}
        <Card>
          <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
            <h3 className="text-base font-semibold text-slate-900">Recent Payments</h3>
            <CreditCard className="w-4 h-4 text-slate-400" />
          </div>
          <div className="divide-y divide-slate-50">
            {recentPayments.length === 0 ? (
              <p className="px-5 py-8 text-sm text-slate-400 text-center">No payments yet</p>
            ) : (
              recentPayments.map((p) => (
                <div key={p.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                  <div className="flex items-center gap-3 min-w-0">
                    <div className={classNames(
                      'w-9 h-9 rounded-lg flex items-center justify-center flex-shrink-0',
                      p.status === 'succeeded' ? 'bg-emerald-50 text-emerald-600' :
                      p.status === 'pending' ? 'bg-amber-50 text-amber-600' :
                      p.status === 'failed' ? 'bg-rose-50 text-rose-600' :
                      'bg-slate-100 text-slate-400'
                    )}>
                      {p.status === 'succeeded' ? <ArrowUpRight className="w-4 h-4" /> :
                       p.status === 'failed' ? <ArrowDownRight className="w-4 h-4" /> :
                       <Clock className="w-4 h-4" />}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{p.description ?? p.txn_id}</p>
                      <p className="text-xs text-slate-400">{timeAgo(p.created_at)}</p>
                    </div>
                  </div>
                  <div className="flex items-center gap-3 flex-shrink-0">
                    <span className="text-sm font-semibold text-slate-900">{formatCurrency(p.amount, p.currency)}</span>
                    <Badge status={p.status}>{p.status}</Badge>
                  </div>
                </div>
              ))
            )}
          </div>
        </Card>

        {/* Recent invoices + payouts */}
        <div className="space-y-6">
          <Card>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Recent Invoices</h3>
              <FileText className="w-4 h-4 text-slate-400" />
            </div>
            <div className="divide-y divide-slate-50">
              {recentInvoices.length === 0 ? (
                <p className="px-5 py-8 text-sm text-slate-400 text-center">No invoices yet</p>
              ) : (
                recentInvoices.map((inv) => (
                  <div key={inv.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{inv.invoice_number}</p>
                      <p className="text-xs text-slate-400">{timeAgo(inv.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(inv.total, inv.currency)}</span>
                      <Badge status={inv.status}>{inv.status}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>

          <Card>
            <div className="px-5 py-4 border-b border-slate-100 flex items-center justify-between">
              <h3 className="text-base font-semibold text-slate-900">Recent Payouts</h3>
              <Banknote className="w-4 h-4 text-slate-400" />
            </div>
            <div className="divide-y divide-slate-50">
              {recentPayouts.length === 0 ? (
                <p className="px-5 py-8 text-sm text-slate-400 text-center">No payouts yet</p>
              ) : (
                recentPayouts.map((po) => (
                  <div key={po.id} className="px-5 py-3 flex items-center justify-between hover:bg-slate-50 transition-colors">
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-slate-900 truncate">{po.txn_id}</p>
                      <p className="text-xs text-slate-400">{timeAgo(po.created_at)}</p>
                    </div>
                    <div className="flex items-center gap-3 flex-shrink-0">
                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(po.amount, po.currency)}</span>
                      <Badge status={po.status}>{po.status}</Badge>
                    </div>
                  </div>
                ))
              )}
            </div>
          </Card>
        </div>
      </div>
    </div>
  );
}

function StatCard({
  label, value, icon, accent, sublabel,
}: {
  label: string;
  value: string;
  icon: React.ReactNode;
  accent: 'emerald' | 'amber' | 'blue' | 'slate';
  sublabel?: string;
}) {
  const accents: Record<string, string> = {
    emerald: 'bg-emerald-50 text-emerald-600',
    amber: 'bg-amber-50 text-amber-600',
    blue: 'bg-blue-50 text-blue-600',
    slate: 'bg-slate-100 text-slate-600',
  };
  return (
    <Card className="p-5">
      <div className="flex items-start justify-between mb-3">
        <span className="text-sm text-slate-500">{label}</span>
        <div className={classNames('w-9 h-9 rounded-lg flex items-center justify-center', accents[accent])}>
          {icon}
        </div>
      </div>
      <p className="text-2xl font-bold text-slate-900">{value}</p>
      {sublabel && <p className="text-xs text-slate-400 mt-1">{sublabel}</p>}
    </Card>
  );
}
