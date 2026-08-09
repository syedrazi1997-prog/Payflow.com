import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { useAuth } from '@/lib/auth';
import {
  Card, Badge, Button, Input, Select, Modal, EmptyState, Spinner,
} from '@/components/ui';
import { formatDate, classNames } from '@/lib/utils';
import { CURRENCIES, COUNTRIES } from '@/lib/constants';
import type { Customer } from '@/lib/types';
import { Users, Plus, Search, Mail, Phone, MapPin } from 'lucide-react';

export function CustomersPage() {
  const { merchant } = useAuth();
  const [loading, setLoading] = useState(true);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [search, setSearch] = useState('');
  const [showCreate, setShowCreate] = useState(false);

  // Create form
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [phone, setPhone] = useState('');
  const [currency, setCurrency] = useState(merchant?.default_currency ?? 'USD');
  const [country, setCountry] = useState(merchant?.country ?? 'US');
  const [addressLine1, setAddressLine1] = useState('');
  const [city, setCity] = useState('');
  const [postalCode, setPostalCode] = useState('');
  const [creating, setCreating] = useState(false);

  async function loadCustomers() {
    if (!merchant) return;
    const { data } = await supabase
      .from('customers')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });
    setCustomers((data ?? []) as Customer[]);
    setLoading(false);
  }

  useEffect(() => {
    if (!merchant) return;
    loadCustomers();
  }, [merchant]);

  async function handleCreate() {
    if (!merchant) return;
    setCreating(true);
    await supabase.from('customers').insert({
      merchant_id: merchant.id,
      name,
      email: email || null,
      phone: phone || null,
      default_currency: currency,
      country,
      address_line1: addressLine1 || null,
      city: city || null,
      postal_code: postalCode || null,
    });
    setCreating(false);
    setShowCreate(false);
    setName(''); setEmail(''); setPhone(''); setAddressLine1(''); setCity(''); setPostalCode('');
    loadCustomers();
  }

  const filtered = customers.filter((c) =>
    !search ||
    c.name.toLowerCase().includes(search.toLowerCase()) ||
    (c.email ?? '').toLowerCase().includes(search.toLowerCase())
  );

  if (loading) {
    return <div className="flex items-center justify-center py-24"><Spinner size={32} /></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-4">
        <div>
          <h1 className="text-2xl font-bold text-slate-900">Customers</h1>
          <p className="text-slate-500 text-sm mt-1">{customers.length} total customers</p>
        </div>
        <Button onClick={() => setShowCreate(true)}>
          <Plus className="w-4 h-4" />
          Add Customer
        </Button>
      </div>

      <div className="relative max-w-md">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-400" />
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="Search by name or email..."
          className="w-full pl-10 pr-4 py-2.5 rounded-lg border border-slate-300 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-slate-400/40"
        />
      </div>

      {filtered.length === 0 ? (
        <Card>
          <EmptyState
            icon={<Users className="w-7 h-7" />}
            title="No customers yet"
            description="Add customers to associate them with payments and invoices."
            action={<Button onClick={() => setShowCreate(true)}><Plus className="w-4 h-4" /> Add Customer</Button>}
          />
        </Card>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((c) => (
            <Card key={c.id} className="p-5 hover:shadow-md transition-shadow">
              <div className="flex items-start gap-3 mb-4">
                <div className={classNames(
                  'w-11 h-11 rounded-xl flex items-center justify-center text-white font-semibold text-lg flex-shrink-0',
                  'bg-gradient-to-br from-slate-700 to-slate-900'
                )}>
                  {c.name.charAt(0).toUpperCase()}
                </div>
                <div className="min-w-0 flex-1">
                  <h3 className="text-base font-semibold text-slate-900 truncate">{c.name}</h3>
                  <Badge status="draft">{c.default_currency}</Badge>
                </div>
              </div>
              <div className="space-y-2 text-sm">
                {c.email && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Mail className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{c.email}</span>
                  </div>
                )}
                {c.phone && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <Phone className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span>{c.phone}</span>
                  </div>
                )}
                {(c.city || c.country) && (
                  <div className="flex items-center gap-2 text-slate-600">
                    <MapPin className="w-3.5 h-3.5 text-slate-400 flex-shrink-0" />
                    <span className="truncate">{[c.city, c.country].filter(Boolean).join(', ')}</span>
                  </div>
                )}
              </div>
              <div className="mt-4 pt-3 border-t border-slate-100">
                <p className="text-xs text-slate-400">Added {formatDate(c.created_at)}</p>
              </div>
            </Card>
          ))}
        </div>
      )}

      <Modal open={showCreate} onClose={() => setShowCreate(false)} title="Add Customer">
        <div className="space-y-4">
          <Input
            label="Name"
            value={name}
            onChange={setName}
            placeholder="John Doe"
            required
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="john@example.com"
            />
            <Input
              label="Phone"
              value={phone}
              onChange={setPhone}
              placeholder="+1 555 0000"
            />
          </div>
          <div className="grid grid-cols-2 gap-4">
            <Select
              label="Default Currency"
              value={currency}
              onChange={setCurrency}
              options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
            />
            <Select
              label="Country"
              value={country}
              onChange={setCountry}
              options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))}
            />
          </div>
          <Input
            label="Address"
            value={addressLine1}
            onChange={setAddressLine1}
            placeholder="123 Main St"
          />
          <div className="grid grid-cols-2 gap-4">
            <Input
              label="City"
              value={city}
              onChange={setCity}
              placeholder="New York"
            />
            <Input
              label="Postal Code"
              value={postalCode}
              onChange={setPostalCode}
              placeholder="10001"
            />
          </div>
          <div className="flex justify-end gap-3 pt-2">
            <Button variant="outline" onClick={() => setShowCreate(false)}>Cancel</Button>
            <Button onClick={handleCreate} disabled={creating || !name}>
              {creating ? 'Adding...' : 'Add Customer'}
            </Button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
