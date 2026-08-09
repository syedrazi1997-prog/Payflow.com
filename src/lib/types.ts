export interface Merchant {
  id: string;
  user_id: string;
  business_name: string;
  business_email: string | null;
  country: string;
  default_currency: string;
  supported_currencies: string[];
  payout_schedule: string;
  available_balance: number;
  pending_balance: number;
  created_at: string;
  updated_at: string;
}

export interface Customer {
  id: string;
  merchant_id: string;
  user_id: string;
  name: string;
  email: string | null;
  phone: string | null;
  default_currency: string;
  country: string | null;
  address_line1: string | null;
  address_line2: string | null;
  city: string | null;
  state: string | null;
  postal_code: string | null;
  created_at: string;
}

export interface Payment {
  id: string;
  merchant_id: string;
  user_id: string;
  customer_id: string | null;
  txn_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed' | 'cancelled';
  payment_method: string;
  description: string | null;
  metadata: Record<string, unknown> | null;
  failure_reason: string | null;
  created_at: string;
  updated_at: string;
  customers?: Customer | null;
}

export interface Refund {
  id: string;
  merchant_id: string;
  user_id: string;
  payment_id: string;
  txn_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'succeeded' | 'failed';
  reason: string | null;
  created_at: string;
  updated_at: string;
  payments?: Payment | null;
}

export interface Payout {
  id: string;
  merchant_id: string;
  user_id: string;
  txn_id: string;
  amount: number;
  currency: string;
  status: 'pending' | 'in_transit' | 'paid' | 'failed' | 'cancelled';
  destination_bank: string | null;
  destination_account_last4: string | null;
  destination_country: string | null;
  scheduled_date: string | null;
  created_at: string;
  updated_at: string;
}

export interface InvoiceItem {
  id: string;
  invoice_id: string;
  user_id: string;
  description: string;
  quantity: number;
  unit_amount: number;
  currency: string;
  total_amount: number;
  created_at: string;
}

export interface Invoice {
  id: string;
  merchant_id: string;
  user_id: string;
  customer_id: string | null;
  invoice_number: string;
  status: 'draft' | 'open' | 'paid' | 'void' | 'uncollectible';
  currency: string;
  subtotal: number;
  tax_rate: number;
  tax_amount: number;
  total: number;
  amount_due: number;
  issue_date: string;
  due_date: string | null;
  sent_at: string | null;
  paid_at: string | null;
  notes: string | null;
  created_at: string;
  updated_at: string;
  customers?: Customer | null;
  invoice_items?: InvoiceItem[];
}

export interface PaymentLink {
  id: string;
  merchant_id: string;
  user_id: string;
  link_id: string;
  amount: number;
  currency: string;
  title: string;
  description: string | null;
  status: 'active' | 'expired' | 'disabled';
  payment_methods: string[];
  max_uses: number;
  use_count: number;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}

export interface BankAccount {
  id: string;
  merchant_id: string;
  user_id: string;
  account_holder_name: string;
  bank_name: string;
  account_number_last4: string;
  routing_number: string | null;
  iban: string | null;
  swift_bic: string | null;
  country: string;
  currency: string;
  is_default: boolean;
  status: string;
  nickname: string | null;
  created_at: string;
  updated_at: string;
}

export interface ApiKey {
  id: string;
  merchant_id: string;
  user_id: string;
  name: string;
  key_prefix: string;
  environment: 'test' | 'live';
  status: 'active' | 'revoked';
  last_used_at: string | null;
  expires_at: string | null;
  created_at: string;
  updated_at: string;
}
