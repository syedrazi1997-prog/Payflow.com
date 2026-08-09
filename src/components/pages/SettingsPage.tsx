import { useEffect, useState } from 'react';
import { useAuth } from '@/lib/auth';
import { supabase } from '@/lib/supabase';
import { Card, Button, Input, Select, Spinner, Modal, Badge } from '@/components/ui';
import { CURRENCIES, COUNTRIES, PAYOUT_SCHEDULES } from '@/lib/constants';
import { formatCurrency, formatDate, classNames } from '@/lib/utils';
import type { BankAccount, ApiKey } from '@/lib/types';
import {
  Check, Building2, Plus, Trash2, Star, Key, Copy, Eye, EyeOff,
  AlertCircle, ShieldCheck, Clock, Zap, ExternalLink,
} from 'lucide-react';

type SettingsTab = 'business' | 'banking' | 'api' | 'gateway';

export function SettingsPage() {
  const { merchant, refreshMerchant } = useAuth();
  const [tab, setTab] = useState<SettingsTab>('business');
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  // Business profile
  const [businessName, setBusinessName] = useState(merchant?.business_name ?? '');
  const [businessEmail, setBusinessEmail] = useState(merchant?.business_email ?? '');
  const [country, setCountry] = useState(merchant?.country ?? 'US');
  const [defaultCurrency, setDefaultCurrency] = useState(merchant?.default_currency ?? 'USD');
  const [payoutSchedule, setPayoutSchedule] = useState(merchant?.payout_schedule ?? 'manual');
  const [selectedCurrencies, setSelectedCurrencies] = useState<string[]>(merchant?.supported_currencies ?? ['USD']);

  // Bank accounts
  const [bankAccounts, setBankAccounts] = useState<BankAccount[]>([]);
  const [showAddBank, setShowAddBank] = useState(false);
  const [bankLoading, setBankLoading] = useState(true);
  const [bankHolder, setBankHolder] = useState('');
  const [bankName, setBankName] = useState('');
  const [bankAccountNumber, setBankAccountNumber] = useState('');
  const [bankRouting, setBankRouting] = useState('');
  const [bankIban, setBankIban] = useState('');
  const [bankSwift, setBankSwift] = useState('');
  const [bankCountry, setBankCountry] = useState(merchant?.country ?? 'US');
  const [bankCurrency, setBankCurrency] = useState(merchant?.default_currency ?? 'USD');
  const [bankNickname, setBankNickname] = useState('');
  const [addingBank, setAddingBank] = useState(false);

  // API keys
  const [apiKeys, setApiKeys] = useState<ApiKey[]>([]);
  const [showCreateKey, setShowCreateKey] = useState(false);
  const [keyLoading, setKeyLoading] = useState(true);
  const [keyName, setKeyName] = useState('');
  const [keyEnv, setKeyEnv] = useState<'test' | 'live'>('test');
  const [creatingKey, setCreatingKey] = useState(false);
  const [newlyCreatedKey, setNewlyCreatedKey] = useState<string | null>(null);
  const [showKey, setShowKey] = useState(false);
  const [copiedKey, setCopiedKey] = useState(false);

  // Gateway credentials (Razorpay)
  const [gatewayCreds, setGatewayCreds] = useState<Array<{ id: string; key_id: string; environment: string; status: string; created_at: string }> | null>(null);
  const [razorpayKeyId, setRazorpayKeyId] = useState('');
  const [razorpayKeySecret, setRazorpayKeySecret] = useState('');
  const [razorpayWebhookSecret, setRazorpayWebhookSecret] = useState('');
  const [razorpayEnv, setRazorpayEnv] = useState<'test' | 'live'>('test');
  const [savingGateway, setSavingGateway] = useState(false);
  const [gatewaySaved, setGatewaySaved] = useState(false);

  useEffect(() => {
    if (!merchant) return;
    loadBankAccounts();
    loadApiKeys();
    loadGatewayCreds();
  }, [merchant]);

  async function loadBankAccounts() {
    if (!merchant) return;
    const { data } = await supabase
      .from('bank_accounts')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });
    setBankAccounts((data ?? []) as BankAccount[]);
    setBankLoading(false);
  }

  async function loadApiKeys() {
    if (!merchant) return;
    const { data } = await supabase
      .from('api_keys')
      .select('*')
      .eq('merchant_id', merchant.id)
      .order('created_at', { ascending: false });
    setApiKeys((data ?? []) as ApiKey[]);
    setKeyLoading(false);
  }

  async function loadGatewayCreds() {
    if (!merchant) return;
    const { data } = await supabase
      .from('gateway_credentials')
      .select('id, key_id, environment, status, created_at')
      .eq('merchant_id', merchant.id)
      .eq('gateway', 'razorpay')
      .order('created_at', { ascending: false });
    setGatewayCreds(data ?? []);
  }

  async function handleSaveGateway() {
    if (!merchant || !razorpayKeyId || !razorpayKeySecret) return;
    setSavingGateway(true);
    const { error } = await supabase.rpc('upsert_gateway_credentials', {
      p_merchant_id: merchant.id,
      p_gateway: 'razorpay',
      p_key_id: razorpayKeyId,
      p_key_secret: razorpayKeySecret,
      p_webhook_secret: razorpayWebhookSecret || null,
      p_environment: razorpayEnv,
    });
    setSavingGateway(false);
    if (!error) {
      setGatewaySaved(true);
      setRazorpayKeySecret('');
      setRazorpayWebhookSecret('');
      loadGatewayCreds();
      setTimeout(() => setGatewaySaved(false), 3000);
    }
  }

  async function handleDeleteGateway(credId: string) {
    await supabase.from('gateway_credentials').delete().eq('id', credId);
    loadGatewayCreds();
  }

  function toggleCurrency(code: string) {
    if (selectedCurrencies.includes(code)) {
      if (code === defaultCurrency) return;
      setSelectedCurrencies(selectedCurrencies.filter((c) => c !== code));
    } else {
      setSelectedCurrencies([...selectedCurrencies, code]);
    }
  }

  async function handleSave() {
    setSaving(true);
    setSaved(false);
    await supabase.from('merchants').update({
      business_name: businessName,
      business_email: businessEmail,
      country,
      default_currency: defaultCurrency,
      payout_schedule: payoutSchedule,
      supported_currencies: selectedCurrencies,
    }).eq('id', merchant!.id);
    setSaving(false);
    setSaved(true);
    refreshMerchant();
    setTimeout(() => setSaved(false), 3000);
  }

  async function handleAddBank() {
    if (!merchant || !bankAccountNumber) return;
    setAddingBank(true);
    const last4 = bankAccountNumber.replace(/\s/g, '').slice(-4);
    const isFirst = bankAccounts.length === 0;

    const { data, error } = await supabase.from('bank_accounts').insert({
      merchant_id: merchant.id,
      account_holder_name: bankHolder || merchant.business_name,
      bank_name: bankName,
      account_number_last4: last4,
      routing_number: bankRouting || null,
      iban: bankIban || null,
      swift_bic: bankSwift || null,
      country: bankCountry,
      currency: bankCurrency,
      nickname: bankNickname || null,
      is_default: isFirst,
    }).select().single();

    if (!error && data && isFirst) {
      // Already set as default in insert
    }

    setAddingBank(false);
    setShowAddBank(false);
    setBankHolder(''); setBankName(''); setBankAccountNumber(''); setBankRouting('');
    setBankIban(''); setBankSwift(''); setBankNickname('');
    loadBankAccounts();
  }

  async function handleSetDefault(bankId: string) {
    await supabase.rpc('set_default_bank_account', { p_bank_account_id: bankId });
    loadBankAccounts();
  }

  async function handleDeleteBank(bankId: string) {
    await supabase.from('bank_accounts').delete().eq('id', bankId);
    loadBankAccounts();
  }

  async function handleCreateKey() {
    if (!merchant || !keyName) return;
    setCreatingKey(true);
    const { data, error } = await supabase.rpc('create_api_key', {
      p_merchant_id: merchant.id,
      p_name: keyName,
      p_environment: keyEnv,
    });

    setCreatingKey(false);

    if (error || !data || data.success === false) {
      return;
    }

    setNewlyCreatedKey(data.key);
    setShowKey(false);
    setKeyName('');
    setShowCreateKey(false);
    loadApiKeys();
  }

  async function handleRevokeKey(keyId: string) {
    await supabase.from('api_keys').update({ status: 'revoked' }).eq('id', keyId);
    loadApiKeys();
  }

  async function handleDeleteKey(keyId: string) {
    await supabase.from('api_keys').delete().eq('id', keyId);
    loadApiKeys();
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    setCopiedKey(true);
    setTimeout(() => setCopiedKey(false), 2000);
  }

  if (!merchant) {
    return <div className="flex items-center justify-center py-24"><Spinner size={32} /></div>;
  }

  const tabs: { key: SettingsTab; label: string; icon: typeof Building2 }[] = [
    { key: 'business', label: 'Business Profile', icon: Building2 },
    { key: 'banking', label: 'Bank Accounts', icon: Building2 },
    { key: 'gateway', label: 'Payment Gateway', icon: Zap },
    { key: 'api', label: 'API Keys', icon: Key },
  ];

  return (
    <div className="space-y-6 max-w-3xl">
      <div>
        <h1 className="text-2xl font-bold text-slate-900">Settings</h1>
        <p className="text-slate-500 text-sm mt-1">Manage your business, banking, and API settings</p>
      </div>

      {/* Tabs */}
      <div className="flex items-center gap-1 border-b border-slate-200">
        {tabs.map((t) => {
          const Icon = t.icon;
          const active = tab === t.key;
          return (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={classNames(
                'px-4 py-2.5 text-sm font-medium border-b-2 transition-colors -mb-px flex items-center gap-2',
                active ? 'border-slate-900 text-slate-900' : 'border-transparent text-slate-500 hover:text-slate-700'
              )}
            >
              <Icon className="w-4 h-4" /> {t.label}
            </button>
          );
        })}
      </div>

      {/* ============ BUSINESS TAB ============ */}
      {tab === 'business' && (
        <>
          <Card className="p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Business Profile</h3>
            <div className="space-y-4">
              <Input label="Business Name" value={businessName} onChange={setBusinessName} placeholder="Acme Inc." />
              <Input label="Business Email" type="email" value={businessEmail} onChange={setBusinessEmail} placeholder="contact@acme.com" />
              <Select label="Country" value={country} onChange={setCountry} options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))} />
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Currency Settings</h3>
            <div className="space-y-4">
              <Select
                label="Default Currency"
                value={defaultCurrency}
                onChange={(val) => {
                  setDefaultCurrency(val);
                  if (!selectedCurrencies.includes(val)) setSelectedCurrencies([...selectedCurrencies, val]);
                }}
                options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))}
              />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-2">
                  Supported Currencies ({selectedCurrencies.length})
                </label>
                <div className="flex flex-wrap gap-2 max-h-48 overflow-y-auto p-1">
                  {CURRENCIES.map((c) => (
                    <button
                      key={c.code}
                      onClick={() => toggleCurrency(c.code)}
                      className={classNames(
                        'px-3 py-1.5 rounded-lg text-sm font-medium border transition-all',
                        selectedCurrencies.includes(c.code)
                          ? 'bg-slate-900 text-white border-slate-900'
                          : 'bg-white text-slate-600 border-slate-200 hover:border-slate-300'
                      )}
                    >
                      {c.code}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </Card>

          <Card className="p-6">
            <h3 className="text-base font-semibold text-slate-900 mb-4">Payout Settings</h3>
            <Select label="Payout Schedule" value={payoutSchedule} onChange={setPayoutSchedule} options={PAYOUT_SCHEDULES} />
            <div className="mt-4 bg-slate-50 rounded-lg p-4">
              <div className="flex justify-between text-sm">
                <span className="text-slate-500">Current Available Balance</span>
                <span className="font-semibold text-slate-900">{formatCurrency(merchant.available_balance, merchant.default_currency)}</span>
              </div>
              <div className="flex justify-between text-sm mt-1">
                <span className="text-slate-500">Pending Balance</span>
                <span className="font-semibold text-slate-900">{formatCurrency(merchant.pending_balance, merchant.default_currency)}</span>
              </div>
            </div>
          </Card>

          <div className="flex items-center justify-end gap-3">
            {saved && (
              <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                <Check className="w-4 h-4" /> Saved
              </span>
            )}
            <Button onClick={handleSave} disabled={saving} size="lg">
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </div>
        </>
      )}

      {/* ============ BANKING TAB ============ */}
      {tab === 'banking' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Connect your bank account to receive automatic payouts when payments are processed.
            </p>
            <Button onClick={() => setShowAddBank(true)}>
              <Plus className="w-4 h-4" /> Add Bank Account
            </Button>
          </div>

          {bankLoading ? (
            <div className="flex justify-center py-12"><Spinner size={28} /></div>
          ) : bankAccounts.length === 0 ? (
            <Card className="p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4 mx-auto">
                <Building2 className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">No bank accounts connected</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mb-4">
                Add a bank account to enable automatic payouts. Your earnings will be sent directly to your bank.
              </p>
              <Button onClick={() => setShowAddBank(true)}>
                <Plus className="w-4 h-4" /> Connect Bank Account
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {bankAccounts.map((bank) => (
                <Card key={bank.id} className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={classNames(
                        'w-11 h-11 rounded-lg flex items-center justify-center',
                        bank.is_default ? 'bg-slate-900 text-white' : 'bg-slate-100 text-slate-500'
                      )}>
                        <Building2 className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{bank.bank_name}</p>
                          {bank.is_default && (
                            <Badge status="open"><Star className="w-3 h-3" /> Default</Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500 mt-0.5">
                          {bank.account_holder_name} • ••••{bank.account_number_last4}
                        </p>
                        <p className="text-xs text-slate-400 mt-1">
                          {bank.country} • {bank.currency}
                          {bank.routing_number && ` • Routing: ${bank.routing_number}`}
                          {bank.iban && ` • IBAN: ${bank.iban}`}
                          {bank.swift_bic && ` • SWIFT: ${bank.swift_bic}`}
                        </p>
                        {bank.nickname && (
                          <p className="text-xs text-slate-400 mt-0.5">"{bank.nickname}"</p>
                        )}
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {!bank.is_default && (
                        <button
                          onClick={() => handleSetDefault(bank.id)}
                          className="p-2 rounded-lg text-slate-400 hover:text-amber-600 hover:bg-amber-50 transition-colors"
                          title="Set as default"
                        >
                          <Star className="w-4 h-4" />
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteBank(bank.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                        title="Remove"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Add Bank Modal */}
          <Modal open={showAddBank} onClose={() => setShowAddBank(false)} title="Connect Bank Account" maxWidth="max-w-lg">
            <div className="space-y-4">
              <div className="bg-blue-50 rounded-lg p-3 flex items-start gap-2.5">
                <ShieldCheck className="w-4 h-4 text-blue-600 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-blue-700">
                  Your bank details are encrypted and stored securely. We never store your full account number — only the last 4 digits.
                </p>
              </div>
              <Input label="Account Holder Name" value={bankHolder} onChange={setBankHolder} placeholder="John Doe" />
              <Input label="Bank Name" value={bankName} onChange={setBankName} placeholder="e.g. Chase, HSBC, ICICI..." required />
              <Input label="Account Number" value={bankAccountNumber} onChange={setBankAccountNumber} placeholder="000123456789" required />
              <div className="grid grid-cols-2 gap-4">
                <Input label="Routing Number (US)" value={bankRouting} onChange={setBankRouting} placeholder="021000021" />
                <Input label="SWIFT/BIC (Intl)" value={bankSwift} onChange={setBankSwift} placeholder="CHASUS33" />
              </div>
              <Input label="IBAN (Optional)" value={bankIban} onChange={setBankIban} placeholder="GB29 NWBK 6016..." />
              <div className="grid grid-cols-2 gap-4">
                <Select label="Country" value={bankCountry} onChange={setBankCountry} options={COUNTRIES.map((c) => ({ value: c.code, label: c.name }))} />
                <Select label="Currency" value={bankCurrency} onChange={setBankCurrency} options={CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} — ${c.name}` }))} />
              </div>
              <Input label="Nickname (Optional)" value={bankNickname} onChange={setBankNickname} placeholder="e.g. Main checking" />
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowAddBank(false)}>Cancel</Button>
                <Button onClick={handleAddBank} disabled={addingBank || !bankName || !bankAccountNumber}>
                  {addingBank ? 'Connecting...' : 'Connect Account'}
                </Button>
              </div>
            </div>
          </Modal>
        </>
      )}

      {/* ============ API KEYS TAB ============ */}
      {tab === 'api' && (
        <>
          <div className="flex items-center justify-between">
            <p className="text-sm text-slate-500">
              Generate API keys to integrate PayFlow into your applications.
            </p>
            <Button onClick={() => setShowCreateKey(true)}>
              <Plus className="w-4 h-4" /> Create Key
            </Button>
          </div>

          {/* Newly created key banner */}
          {newlyCreatedKey && (
            <Card className="p-5 border-amber-300 bg-amber-50">
              <div className="flex items-start gap-3">
                <AlertCircle className="w-5 h-5 text-amber-600 mt-0.5 flex-shrink-0" />
                <div className="flex-1">
                  <p className="text-sm font-semibold text-amber-900 mb-1">
                    Copy your API key now — you won't be able to see it again.
                  </p>
                  <div className="flex items-center gap-2 mt-2">
                    <code className="flex-1 px-3 py-2 bg-white rounded-lg text-sm font-mono text-slate-900 border border-amber-200 overflow-x-auto">
                      {showKey ? newlyCreatedKey : '•'.repeat(newlyCreatedKey.length)}
                    </code>
                    <button
                      onClick={() => setShowKey(!showKey)}
                      className="p-2 rounded-lg text-slate-500 hover:bg-amber-100 transition-colors"
                    >
                      {showKey ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                    <button
                      onClick={() => copyToClipboard(newlyCreatedKey)}
                      className="p-2 rounded-lg text-slate-500 hover:bg-amber-100 transition-colors"
                    >
                      {copiedKey ? <Check className="w-4 h-4 text-emerald-600" /> : <Copy className="w-4 h-4" />}
                    </button>
                  </div>
                  <button
                    onClick={() => setNewlyCreatedKey(null)}
                    className="text-xs text-amber-700 hover:text-amber-900 mt-2 font-medium"
                  >
                    I've copied my key — dismiss
                  </button>
                </div>
              </div>
            </Card>
          )}

          {keyLoading ? (
            <div className="flex justify-center py-12"><Spinner size={28} /></div>
          ) : apiKeys.length === 0 ? (
            <Card className="p-10 text-center">
              <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4 mx-auto">
                <Key className="w-7 h-7" />
              </div>
              <h3 className="text-base font-semibold text-slate-900 mb-1">No API keys yet</h3>
              <p className="text-sm text-slate-500 max-w-sm mx-auto mb-4">
                Create an API key to start accepting payments from your website or app.
              </p>
              <Button onClick={() => setShowCreateKey(true)}>
                <Plus className="w-4 h-4" /> Create API Key
              </Button>
            </Card>
          ) : (
            <div className="space-y-3">
              {apiKeys.map((key) => (
                <Card key={key.id} className="p-5">
                  <div className="flex items-start justify-between">
                    <div className="flex items-start gap-3">
                      <div className={classNames(
                        'w-11 h-11 rounded-lg flex items-center justify-center',
                        key.status === 'active'
                          ? key.environment === 'live' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                          : 'bg-slate-100 text-slate-400'
                      )}>
                        <Key className="w-5 h-5" />
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="text-sm font-semibold text-slate-900">{key.name}</p>
                          <Badge status={key.environment === 'live' ? 'open' : 'draft'}>
                            {key.environment}
                          </Badge>
                          {key.status === 'revoked' && <Badge status="void">revoked</Badge>}
                        </div>
                        <p className="text-sm font-mono text-slate-500 mt-0.5">{key.key_prefix}••••••</p>
                        <div className="flex items-center gap-3 mt-1.5 text-xs text-slate-400">
                          <span className="flex items-center gap-1">
                            <Clock className="w-3 h-3" /> Created {formatDate(key.created_at)}
                          </span>
                          {key.last_used_at && (
                            <span>Last used {formatDate(key.last_used_at)}</span>
                          )}
                          {key.expires_at && (
                            <span>Expires {formatDate(key.expires_at)}</span>
                          )}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-1">
                      {key.status === 'active' && (
                        <button
                          onClick={() => handleRevokeKey(key.id)}
                          className="px-3 py-1.5 rounded-lg text-xs font-medium text-amber-600 hover:bg-amber-50 transition-colors"
                        >
                          Revoke
                        </button>
                      )}
                      <button
                        onClick={() => handleDeleteKey(key.id)}
                        className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </Card>
              ))}
            </div>
          )}

          {/* Create Key Modal */}
          <Modal open={showCreateKey} onClose={() => setShowCreateKey(false)} title="Create API Key">
            <div className="space-y-4">
              <Input label="Key Name" value={keyName} onChange={setKeyName} placeholder="e.g. Production API, Mobile App" required />
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Environment</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setKeyEnv('test')}
                    className={classNames(
                      'p-3 rounded-lg border-2 text-left transition-all',
                      keyEnv === 'test' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <p className="text-sm font-semibold text-slate-900">Test</p>
                    <p className="text-xs text-slate-400">For development & testing</p>
                  </button>
                  <button
                    onClick={() => setKeyEnv('live')}
                    className={classNames(
                      'p-3 rounded-lg border-2 text-left transition-all',
                      keyEnv === 'live' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <p className="text-sm font-semibold text-slate-900">Live</p>
                    <p className="text-xs text-slate-400">For production payments</p>
                  </button>
                </div>
              </div>
              <div className="bg-slate-50 rounded-lg p-3 flex items-start gap-2.5">
                <AlertCircle className="w-4 h-4 text-slate-500 mt-0.5 flex-shrink-0" />
                <p className="text-xs text-slate-500">
                  Your full API key will only be shown once after creation. Store it securely — you won't be able to retrieve it later.
                </p>
              </div>
              <div className="flex justify-end gap-3 pt-2">
                <Button variant="outline" onClick={() => setShowCreateKey(false)}>Cancel</Button>
                <Button onClick={handleCreateKey} disabled={creatingKey || !keyName}>
                  {creatingKey ? 'Generating...' : 'Generate Key'}
                </Button>
              </div>
            </div>
          </Modal>
        </>
      )}

      {/* ============ PAYMENT GATEWAY TAB ============ */}
      {tab === 'gateway' && (
        <>
          <Card className="p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-lg bg-blue-50 flex items-center justify-center text-blue-600">
                <Zap className="w-5 h-5" />
              </div>
              <div>
                <h3 className="text-base font-semibold text-slate-900">Razorpay Integration</h3>
                <p className="text-sm text-slate-500">Connect your Razorpay account to accept real payments</p>
              </div>
            </div>

            <div className="bg-blue-50 rounded-lg p-4 mb-5">
              <p className="text-sm text-blue-700">
                Don't have a Razorpay account?{' '}
                <a href="https://razorpay.com" target="_blank" rel="noopener noreferrer" className="font-semibold underline inline-flex items-center gap-0.5">
                  Create one here <ExternalLink className="w-3 h-3" />
                </a>
              </p>
              <p className="text-xs text-blue-600 mt-1">
                Get your API keys from Razorpay Dashboard → Settings → API Keys.
              </p>
            </div>

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-slate-700 mb-1.5">Environment</label>
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setRazorpayEnv('test')}
                    className={classNames(
                      'p-3 rounded-lg border-2 text-left transition-all',
                      razorpayEnv === 'test' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <p className="text-sm font-semibold text-slate-900">Test Mode</p>
                    <p className="text-xs text-slate-400">Use test keys for development</p>
                  </button>
                  <button
                    onClick={() => setRazorpayEnv('live')}
                    className={classNames(
                      'p-3 rounded-lg border-2 text-left transition-all',
                      razorpayEnv === 'live' ? 'border-slate-900 bg-slate-50' : 'border-slate-200 hover:border-slate-300'
                    )}
                  >
                    <p className="text-sm font-semibold text-slate-900">Live Mode</p>
                    <p className="text-xs text-slate-400">Use live keys for real payments</p>
                  </button>
                </div>
              </div>

              <Input label="Key ID" value={razorpayKeyId} onChange={setRazorpayKeyId} placeholder="rzp_test_XXXXXXXX" required />
              <Input label="Key Secret" type="password" value={razorpayKeySecret} onChange={setRazorpayKeySecret} placeholder="Enter your key secret" required />
              <Input label="Webhook Secret (Optional)" type="password" value={razorpayWebhookSecret} onChange={setRazorpayWebhookSecret} placeholder="For webhook verification" />

              <div className="flex items-center justify-end gap-3">
                {gatewaySaved && (
                  <span className="flex items-center gap-1.5 text-sm text-emerald-600 font-medium">
                    <Check className="w-4 h-4" /> Saved
                  </span>
                )}
                <Button onClick={handleSaveGateway} disabled={savingGateway || !razorpayKeyId || !razorpayKeySecret}>
                  {savingGateway ? 'Saving...' : 'Save Credentials'}
                </Button>
              </div>
            </div>
          </Card>

          {gatewayCreds && gatewayCreds.length > 0 && (
            <Card className="p-5">
              <h4 className="text-sm font-semibold text-slate-900 mb-3">Connected Credentials</h4>
              <div className="space-y-3">
                {gatewayCreds.map((cred) => (
                  <div key={cred.id} className="flex items-center justify-between p-3 rounded-lg border border-slate-200">
                    <div className="flex items-center gap-3">
                      <div className={classNames(
                        'w-9 h-9 rounded-lg flex items-center justify-center',
                        cred.environment === 'live' ? 'bg-emerald-50 text-emerald-600' : 'bg-blue-50 text-blue-600'
                      )}>
                        <Zap className="w-4 h-4" />
                      </div>
                      <div>
                        <p className="text-sm font-mono text-slate-900">{cred.key_id}</p>
                        <div className="flex items-center gap-2 mt-0.5">
                          <Badge status={cred.environment === 'live' ? 'open' : 'draft'}>{cred.environment}</Badge>
                          <span className="text-xs text-slate-400">Added {formatDate(cred.created_at)}</span>
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteGateway(cred.id)}
                      className="p-2 rounded-lg text-slate-400 hover:text-rose-600 hover:bg-rose-50 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </Card>
          )}
        </>
      )}
    </div>
  );
}
