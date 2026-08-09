import { useState } from 'react';
import { AuthProvider, useAuth } from '@/lib/auth';
import { AuthPage } from '@/components/AuthPage';
import { DashboardLayout, type Page } from '@/components/DashboardLayout';
import { OverviewPage } from '@/components/pages/OverviewPage';
import { PaymentsPage } from '@/components/pages/PaymentsPage';
import { RefundsPage } from '@/components/pages/RefundsPage';
import { PayoutsPage } from '@/components/pages/PayoutsPage';
import { InvoicesPage } from '@/components/pages/InvoicesPage';
import { CustomersPage } from '@/components/pages/CustomersPage';
import { SettingsPage } from '@/components/pages/SettingsPage';
import { CheckoutPage } from '@/components/pages/CheckoutPage';
import { Spinner } from '@/components/ui';
import type { Payment } from '@/lib/types';

function getCheckoutLinkId(): string | null {
  const match = window.location.pathname.match(/^\/checkout\/(.+)$/);
  return match ? match[1] : null;
}

function AppContent() {
  const { user, loading } = useAuth();
  const [page, setPage] = useState<Page>('overview');
  const [refundTarget, setRefundTarget] = useState<Payment | null>(null);

  // Public checkout page — no auth required
  const checkoutLinkId = getCheckoutLinkId();
  if (checkoutLinkId) {
    return <CheckoutPage linkId={checkoutLinkId} onBack={() => window.history.back()} />;
  }

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Spinner size={40} />
      </div>
    );
  }

  if (!user) {
    return <AuthPage />;
  }

  function handleRefundNavigate(payment: Payment) {
    setRefundTarget(payment);
    setPage('refunds');
  }

  return (
    <DashboardLayout current={page} onNavigate={setPage}>
      {page === 'overview' && <OverviewPage />}
      {page === 'payments' && <PaymentsPage onRefund={handleRefundNavigate} />}
      {page === 'refunds' && (
        <RefundsPage
          externalPayment={refundTarget}
          onConsumed={() => setRefundTarget(null)}
        />
      )}
      {page === 'payouts' && <PayoutsPage />}
      {page === 'invoices' && <InvoicesPage />}
      {page === 'customers' && <CustomersPage />}
      {page === 'settings' && <SettingsPage />}
    </DashboardLayout>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;
