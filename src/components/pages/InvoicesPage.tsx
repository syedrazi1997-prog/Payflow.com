import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  Card, Badge, Button, Input, Select, Modal, EmptyState, Spinner, Textarea,
} from '@/components/ui';
import {
  formatCurrency, formatDate, generateInvoiceNumber, amountToMinorUnit,
} from '@/lib/utils';
import { CURRENCIES } from '@/lib/constants';
import type { Invoice, InvoiceItem, Customer } from '@/lib/types';
import { FileText, Plus, Search, Send, Trash2, CheckCircle } from 'lucide-react';

interface DraftItem {
  id: string;
  description: string;
  quantity: string;
  unitAmount: string;
}

export function InvoicesPage() {
  const { merchant } = useAuth();
  const [loading, setLoading] = useState(true);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);
  const [customers, setCustomers] = useState<Customer[]>([]);

  // Create form
  const [customerId, setCustomerId] = useState('');
  const [currency, setCurrency] = useState(merchant?.default_currency ?? 'USD');
  const [dueDate, setDueDate] = useState('');
  const [notes, setNotes] = useState('');
  const [taxRate, setTaxRate] = useState('0');
  const [items, setItems] = useState<DraftItem[]>([
    { id: '1', description: '', quantity: '1', unitAmount: '0' },
  ]);
  const [creating, setCreating] = useState(false);

  async function loadInvoices() {
    if (!merchant) return;
    const { data } = await supabase
      .from('invoices')
      .select('*, customers(*)')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });
    setInvoices((data ?? []) as Invoice[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!merchant) return;
    loadInvoices();
    supabase
      .from('customers')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('name')
      .then(({ data }) => setCustomers((data ?? []) as Customer[]));
  }, [merchant]);

  function addItem() {
    setItems([...items, { id: String(items.length + 1), description: '', quantity: '1', unitAmount: '0' }]);
  }

  function removeItem(id: string) {
    setItems(items.filter((i) => i.id !== id));
  }

  function updateItem(id: string, field: keyof DraftItem, value: string) {
    setItems(items.map((i) => (i.id === id ? { ...i, [field]: value } : i)));
  }

  function computeSubtotal(): number {
    return items.reduce((sum, item) => {
      const qty = parseInt(item.quantity) || 0;
      const unit = parseFloat(item.unitAmount) || 0;
      return sum + amountToMinorUnit(qty * unit, currency);
    }, 0);
  }

  async function handleCreate() {
    if (!merchant) return;
    setCreating(true);
    const subtotal = computeSubtotal();
    const tax = Math.round(subtotal * (parseFloat(taxRate) / 100));
    const total = subtotal + tax;
    const invoiceNumber = generateInvoiceNumber();

    const { data: invData, error: invError } = await supabase.from('invoices').insert({
      merchant_id: merchant.id,
      customer_id: customerId || null,
      invoice_number: invoiceNumber,
      status: 'draft',
      currency,
      subtotal,
      tax_rate: parseFloat(taxRate),
      tax_amount: tax,
      total,
      amount_due: total,
      due_date: dueDate || null,
      notes: notes || null,
    }).select().single();

    if (!invError && invData) {
      const itemRows = items
        .filter((i) => i.description.trim())
        .map((item) => ({
          invoice_id: invData.id,
          description: item.description,
          quantity: parseInt(item.quantity) || 1,
          unit_amount: amountToMinorUnit(parseFloat(item.unitAmount) || 0, currency),
          currency,
          total_amount: amountToMinorUnit((parseInt(item.quantity) || 0) * (parseFloat(item.unitAmount) || 0), currency),
        }));
      if (itemRows.length > 0) {
        await supabase.from('invoice_items').insert(itemRows);
      }
    }

    setCreating(false);
    setShowCreate(false);
    setCustomerId(''); setDueDate(''); setNotes(''); setTaxRate('0');
    setItems([{ id: '1', description: '', quantity: '1', unitAmount: '0' }]);
    loadInvoices();
  }

  async function sendInvoice(inv: Invoice) {
    await supabase.from('invoices')
      .update({ status: 'open', sent_at: new Date().toISOString() })
      .eq('id', inv.id);
    loadInvoices();
  }

  async function markPaid(inv: Invoice) {
    await supabase.from('invoices')
      .update({ status: 'paid', paid_at: new Date().toISOString(), amount_due: 0 })
      .eq('id', inv.id);
    if (merchant) {
      await supabase.from('merchants')
        .update({ available_balance: merchant.available_balance + inv.total })
        .eq('id', merchant.id);
    }
    loadInvoices();
  }

  const filtered = invoices.filter((inv) =>
    !search ||
    inv.invoice_number.toLowerCase().includes(search.toLowerCase()) ||
    (inv.customers?.name ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Spinner size={32} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Invoices</h1>
          <p className="text-slate-500 text-sm mt-1">{invoices.length} total invoices</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          Create Invoice
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search invoices..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/40"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<FileText className="w-7 h-7" />}
            title="No invoices yet"
            description="Create and send professional invoices to your customers."
            action={<Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> Create Invoice</Button>}
          />
        </Card>
      ) : (
        <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/50">
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Invoice #</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Customer</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Amount</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Due Date</th>
                  <th className="text-left text-xs font-semibold text-slate-500 uppercase tracking-wider px-5 py-3">Status</th>
                  <th className="px-5 py-3"></th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-50">
                {filtered.map((inv) => (
                  <tr key={inv.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-5 py-3.5">
                      <p className="text-sm font-medium text-slate-900 font-mono">{inv.invoice_number}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <p className="text-sm text-slate-700">{inv.customers?.name ?? 'Guest'}</p>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm font-semibold text-slate-900">{formatCurrency(inv.total, inv.currency)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <span className="text-sm text-slate-500">{formatDate(inv.due_date)}</span>
                    </td>
                    <td className="px-5 py-3.5">
                      <Badge status={inv.status}>{inv.status}</Badge>
                    </td>
                    <td className="px-5 py-3.5 text-right">
                      <div className="flex items-center justify-end gap-1">
                        {inv.status === 'draft' && (
                          <button onClick={() => sendInvoice(inv)} className="p-1.5 rounded-lg text-slate-400 hover:text-blue-600 hover:bg-blue-50 transition-colors" title="Send">
                            <Send className="w-4 h-4" />
                          </button>
                        )}
                        {inv.status === 'open' && (
                          <button onClick={() => markPaid(inv)} className="p-1.5 rounded-lg text-slate-400 hover:text-emerald-600 hover:bg-emerald-50 transition-colors" title="Mark as paid">
                            <CheckCircle className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Card>
      )}

      {/* Create invoice modal */}
      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Create Invoice" maxWidth="max-w-2xl">
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Customer"
              value={customerId}
              onChange={setCustomerId}
              options={[{ value: '', label: 'No customer' }, ...customers.map((c) => ({ value: c.id, label: `${c.name} (${c.email ?? '—'})` }))]}
            />
            <Select
              label="Currency"
              value={currency}
              onChange={setCurrency}
              options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
              required
            />
          </div>

          {/* Line items */}
          <div>
            <label className="block text-sm font-medium text-slate-700 mb-2">Line Items</label>
            <div className="space-y-2">
              {items.map((item) => (
                <div key={item.id} className="grid grid-cols-12 gap-2 items-start">
                  <div className="col-span-5">
                    <input
                      value={item.description}
                      onChange={(e) => updateItem(item.id, 'description', e.target.value)}
                      placeholder="Description"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                    />
                  </div>
                  <div className="col-span-2">
                    <input
                      type="number"
                      value={item.quantity}
                      onChange={(e) => updateItem(item.id, 'quantity', e.target.value)}
                      placeholder="Qty"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                    />
                  </div>
                  <div className="col-span-3">
                    <input
                      type="number"
                      value={item.unitAmount}
                      onChange={(e) => updateItem(item.id, 'unitAmount', e.target.value)}
                      placeholder="Unit price"
                      className="w-full px-3 py-2 rounded-lg border border-slate-300 text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/40"
                    />
                  </div>
                  <div className="col-span-2 flex items-center justify-end">
                    {items.length > 1 && (
                      <button onClick={() => removeItem(item.id)} className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    )}
                  </div>
                </div>
              ))}
            </div>
            <button onClick={addItem} className="mt-2 text-sm text-slate-600 hover:text-slate-900 font-medium flex items-center gap-1.5">
              <Plus className="w-4 h-4" /> Add line item
            </button>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Tax Rate (%)"
              type="number"
              value={taxRate}
              onChange={setTaxRate}
              placeholder="0"
            />
            <Input
              label="Due Date"
              type="date"
              value={dueDate}
              onChange={setDueDate}
            />
          </div>

          {/* Summary */}
          <div className="bg-slate-50 rounded-lg p-4 space-y-1.5">
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Subtotal</span>
              <span className="font-medium text-slate-900">{formatCurrency(computeSubtotal(), currency)}</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-slate-500">Tax ({taxRate || 0}%)</span>
              <span className="font-medium text-slate-900">{formatCurrency(Math.round(computeSubtotal() * (parseFloat(taxRate) / 100)), currency)}</span>
            </div>
            <div className="flex justify-between text-sm pt-1.5 border-t border-slate-200">
              <span className="font-semibold text-slate-900">Total</span>
              <span className="font-bold text-slate-900">{formatCurrency(computeSubtotal() + Math.round(computeSubtotal() * (parseFloat(taxRate) / 100)), currency)}</span>
            </div>
          </div>

          <Textarea
            label="Notes (optional)"
            value={notes}
            onChange={setNotes}
            placeholder="Payment terms, thank you note, etc."
          />

          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating}>
              {creating ? 'Creating...' : 'Create Invoice'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
