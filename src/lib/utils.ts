import { CURRENCIES } from './constants';

export function formatCurrency(amount: number, currency: string): string {
  const cur = CURRENCIES.find((c) => c.code === currency);
  const symbol = cur?.symbol ?? '';
  const divisor = cur?.zeroDecimal ? 1 : 100;

  const value = amount / divisor;
  const formatted = value.toLocaleString('en-US', {
    minimumFractionDigits: cur?.zeroDecimal ? 0 : 2,
    maximumFractionDigits: cur?.zeroDecimal ? 0 : 2,
  });

  return `${symbol}${formatted}`;
}

export function formatCurrencyShort(amount: number, currency: string): string {
  const cur = CURRENCIES.find((c) => c.code === currency);
  const symbol = cur?.symbol ?? '';
  const divisor = cur?.zeroDecimal ? 1 : 100;
  const value = amount / divisor;

  if (value >= 1_000_000) return `${symbol}${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `${symbol}${(value / 1_000).toFixed(1)}K`;
  return formatCurrency(amount, currency);
}

export function formatDate(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
  });
}

export function formatDateTime(dateStr: string | null): string {
  if (!dateStr) return '—';
  return new Date(dateStr).toLocaleString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (days > 30) return formatDate(dateStr);
  if (days > 0) return `${days}d ago`;
  if (hours > 0) return `${hours}h ago`;
  if (minutes > 0) return `${minutes}m ago`;
  return 'just now';
}

export function generateTxnId(prefix: string): string {
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let random = '';
  for (let i = 0; i < 10; i++) {
    random += chars[Math.floor(Math.random() * chars.length)];
  }
  return `${prefix}_${random}`;
}

export function generateInvoiceNumber(): string {
  const year = new Date().getFullYear();
  const random = Math.floor(1000 + Math.random() * 9000);
  return `INV-${year}-${random}`;
}

export function amountToMinorUnit(amount: number, currency: string): number {
  const cur = CURRENCIES.find((c) => c.code === currency);
  const divisor = cur?.zeroDecimal ? 1 : 100;
  return Math.round(amount * divisor);
}

export function minorUnitToAmount(minor: number, currency: string): number {
  const cur = CURRENCIES.find((c) => c.code === currency);
  const divisor = cur?.zeroDecimal ? 1 : 100;
  return minor / divisor;
}

export function classNames(...classes: (string | false | undefined | null)[]): string {
  return classes.filter(Boolean).join(' ');
}
