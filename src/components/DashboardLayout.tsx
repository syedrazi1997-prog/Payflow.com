import { useState, type ReactNode } from 'react';
import { useAuth } from '@/lib/auth';
import { classNames } from '@/lib/utils';
import {
  LayoutDashboard, CreditCard, RotateCcw, Banknote, FileText,
  Users, Settings, Globe, LogOut, Menu, X,
} from 'lucide-react';

export type Page = 'overview' | 'payments' | 'refunds' | 'payouts' | 'invoices' | 'customers' | 'settings';

const NAV_ITEMS: { key: Page; label: string; icon: typeof LayoutDashboard }[] = [
  { key: 'overview', label: 'Overview', icon: LayoutDashboard },
  { key: 'payments', label: 'Payments', icon: CreditCard },
  { key: 'refunds', label: 'Refunds', icon: RotateCcw },
  { key: 'payouts', label: 'Payouts', icon: Banknote },
  { key: 'invoices', label: 'Invoices', icon: FileText },
  { key: 'customers', label: 'Customers', icon: Users },
  { key: 'settings', label: 'Settings', icon: Settings },
];

export function DashboardLayout({
  current,
  onNavigate,
  children,
}: {
  current: Page;
  onNavigate: (page: Page) => void;
  children: ReactNode;
}) {
  const { merchant, signOut } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  return (
    <div className="min-h-screen bg-slate-50 flex">
      {/* Sidebar */}
      <aside className={classNames(
        'fixed lg:sticky top-0 left-0 z-40 h-screen w-64 bg-slate-900 flex-shrink-0 flex flex-col transition-transform duration-300',
        mobileOpen ? 'translate-x-0' : '-translate-x-full lg:translate-x-0'
      )}>
        <div className="flex items-center gap-3 px-6 py-5 border-b border-white/10">
          <div className="w-9 h-9 rounded-lg bg-white/10 flex items-center justify-center text-white">
            <Globe className="w-5 h-5" />
          </div>
          <span className="text-lg font-semibold text-white tracking-tight">PayFlow</span>
        </div>

        <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
          {NAV_ITEMS.map((item) => {
            const Icon = item.icon;
            const active = current === item.key;
            return (
              <button
                key={item.key}
                onClick={() => { onNavigate(item.key); setMobileOpen(false); }}
                className={classNames(
                  'w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium transition-all duration-150',
                  active
                    ? 'bg-white/10 text-white'
                    : 'text-slate-400 hover:text-white hover:bg-white/5'
                )}
              >
                <Icon className="w-[18px] h-[18px]" />
                {item.label}
              </button>
            );
          })}
        </nav>

        <div className="px-3 py-4 border-t border-white/10">
          <div className="px-3 mb-3">
            <p className="text-sm font-medium text-white truncate">{merchant?.business_name ?? 'Merchant'}</p>
            <p className="text-xs text-slate-500 truncate">{merchant?.business_email ?? ''}</p>
          </div>
          <button
            onClick={signOut}
            className="w-full flex items-center gap-3 px-3 py-2.5 rounded-lg text-sm font-medium text-slate-400 hover:text-white hover:bg-white/5 transition-all duration-150"
          >
            <LogOut className="w-[18px] h-[18px]" />
            Sign out
          </button>
        </div>
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-30 bg-slate-900/40 lg:hidden" onClick={() => setMobileOpen(false)} />
      )}

      {/* Main content */}
      <div className="flex-1 min-w-0 flex flex-col">
        {/* Mobile header */}
        <header className="lg:hidden flex items-center justify-between px-4 py-3 bg-white border-b border-slate-200 sticky top-0 z-20">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-lg bg-slate-900 flex items-center justify-center text-white">
              <Globe className="w-4 h-4" />
            </div>
            <span className="font-semibold text-slate-900">PayFlow</span>
          </div>
          <button onClick={() => setMobileOpen(true)} className="p-2 rounded-lg hover:bg-slate-100">
            <Menu className="w-5 h-5 text-slate-600" />
          </button>
        </header>

        <main className="flex-1 p-4 lg:p-8 max-w-7xl mx-auto w-full">
          {children}
        </main>
      </div>
    </div>
  );
}
