import type { ReactNode } from 'react';
import { classNames } from '@/lib/utils';

export function Badge({ status, children }: { status: string; children: ReactNode }) {
  const styles: Record<string, string> = {
    succeeded: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    paid: 'bg-emerald-50 text-emerald-700 border-emerald-200',
    open: 'bg-blue-50 text-blue-700 border-blue-200',
    pending: 'bg-amber-50 text-amber-700 border-amber-200',
    in_transit: 'bg-blue-50 text-blue-700 border-blue-200',
    failed: 'bg-rose-50 text-rose-700 border-rose-200',
    cancelled: 'bg-gray-100 text-gray-500 border-gray-200',
    void: 'bg-gray-100 text-gray-500 border-gray-200',
    uncollectible: 'bg-rose-50 text-rose-700 border-rose-200',
    draft: 'bg-gray-100 text-gray-600 border-gray-200',
  };

  return (
    <span className={classNames(
      'inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium border',
      styles[status] ?? 'bg-gray-100 text-gray-600 border-gray-200'
    )}>
      <span className={classNames(
        'w-1.5 h-1.5 rounded-full',
        status === 'succeeded' || status === 'paid' ? 'bg-emerald-500' :
        status === 'pending' ? 'bg-amber-500' :
        status === 'failed' || status === 'uncollectible' ? 'bg-rose-500' :
        status === 'open' || status === 'in_transit' ? 'bg-blue-500' :
        'bg-gray-400'
      )} />
      {children}
    </span>
  );
}

export function Button({
  children,
  onClick,
  variant = 'primary',
  size = 'md',
  type = 'button',
  disabled = false,
  className = '',
}: {
  children: ReactNode;
  onClick?: () => void;
  variant?: 'primary' | 'secondary' | 'ghost' | 'danger' | 'outline';
  size?: 'sm' | 'md' | 'lg';
  type?: 'button' | 'submit';
  disabled?: boolean;
  className?: string;
}) {
  const variants: Record<string, string> = {
    primary: 'bg-slate-900 text-white hover:bg-slate-800 active:bg-slate-950 shadow-sm',
    secondary: 'bg-slate-100 text-slate-700 hover:bg-slate-200',
    ghost: 'text-slate-600 hover:bg-slate-100',
    danger: 'bg-rose-600 text-white hover:bg-rose-700 shadow-sm',
    outline: 'border border-slate-300 text-slate-700 hover:bg-slate-50 bg-white',
  };
  const sizes: Record<string, string> = {
    sm: 'px-3 py-1.5 text-sm',
    md: 'px-4 py-2 text-sm',
    lg: 'px-6 py-3 text-base',
  };

  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      className={classNames(
        'inline-flex items-center justify-center gap-2 rounded-lg font-medium transition-all duration-150',
        'focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:ring-offset-1',
        'disabled:opacity-50 disabled:cursor-not-allowed',
        variants[variant],
        sizes[size],
        className
      )}
    >
      {children}
    </button>
  );
}

export function Input({
  label,
  value,
  onChange,
  type = 'text',
  placeholder,
  required = false,
  className = '',
}: {
  label?: string;
  value: string | number;
  onChange: (val: string) => void;
  type?: string;
  placeholder?: string;
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        required={required}
        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400
          focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:border-slate-400
          transition-all duration-150 text-sm"
      />
    </div>
  );
}

export function Select({
  label,
  value,
  onChange,
  options,
  required = false,
  className = '',
}: {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  options: { value: string; label: string }[];
  required?: boolean;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
        </label>
      )}
      <select
        value={value}
        onChange={(e) => onChange(e.target.value)}
        required={required}
        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900
          focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:border-slate-400
          transition-all duration-150 text-sm appearance-none cursor-pointer
          bg-[url('data:image/svg+xml;charset=US-ASCII,%3Csvg%20width%3D%2212%22%20height%3D%2212%22%20viewBox%3D%220%200%2012%2012%22%20xmlns%3D%22http%3A//www.w3.org/2000/svg%22%3E%3Cpath%20d%3D%22M2%204l4%204%204-4%22%20stroke%3D%22%2364748b%22%20stroke-width%3D%221.5%22%20fill%3D%22none%22%20stroke-linecap%3D%22round%22%20stroke-linejoin%3D%22round%22/%3E%3C/svg%3E')] bg-no-repeat bg-[right_0.75rem_center] pr-10"
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
    </div>
  );
}

export function Textarea({
  label,
  value,
  onChange,
  placeholder,
  rows = 3,
  className = '',
}: {
  label?: string;
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  className?: string;
}) {
  return (
    <div className={className}>
      {label && (
        <label className="block text-sm font-medium text-slate-700 mb-1.5">
          {label}
        </label>
      )}
      <textarea
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        rows={rows}
        className="w-full px-3.5 py-2.5 rounded-lg border border-slate-300 bg-white text-slate-900 placeholder:text-slate-400
          focus:outline-none focus:ring-2 focus:ring-slate-400/40 focus:border-slate-400
          transition-all duration-150 text-sm resize-none"
      />
    </div>
  );
}

export function Card({ children, className = '' }: { children: ReactNode; className?: string }) {
  return (
    <div className={classNames('bg-white rounded-xl border border-slate-200 shadow-sm', className)}>
      {children}
    </div>
  );
}

export function Modal({
  open,
  onClose,
  title,
  children,
  maxWidth = 'max-w-lg',
}: {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  maxWidth?: string;
}) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-slate-900/40 backdrop-blur-sm" onClick={onClose} />
      <div className={classNames('relative w-full bg-white rounded-2xl shadow-2xl', maxWidth)}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-slate-100">
          <h2 className="text-lg font-semibold text-slate-900">{title}</h2>
          <button onClick={onClose} className="text-slate-400 hover:text-slate-600 transition-colors p-1 rounded-lg hover:bg-slate-100">
            <svg width="20" height="20" viewBox="0 0 20 20" fill="none">
              <path d="M5 5l10 10M15 5L5 15" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
            </svg>
          </button>
        </div>
        <div className="px-6 py-5 max-h-[70vh] overflow-y-auto">
          {children}
        </div>
      </div>
    </div>
  );
}

export function EmptyState({ icon, title, description, action }: { icon: ReactNode; title: string; description: string; action?: ReactNode }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-slate-100 flex items-center justify-center text-slate-400 mb-4">
        {icon}
      </div>
      <h3 className="text-base font-semibold text-slate-900 mb-1">{title}</h3>
      <p className="text-sm text-slate-500 max-w-sm mb-4">{description}</p>
      {action}
    </div>
  );
}

export function Spinner({ size = 20 }: { size?: number }) {
  return (
    <div className="flex items-center justify-center" style={{ width: size, height: size }}>
      <div
        className="border-2 border-slate-200 border-t-slate-700 rounded-full animate-spin"
        style={{ width: size, height: size }}
      />
    </div>
  );
}
