import { useState } from 'react';
import { useAuth } from '@/lib/auth';
import { Button, Input } from '@/components/ui';
import { Globe } from 'lucide-react';

export function AuthPage() {
  const { signIn, signUp } = useAuth();
  const [mode, setMode] = useState<'signin' | 'signup'>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [businessName, setBusinessName] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setBusy(true);
    const result = mode === 'signin'
      ? await signIn(email, password)
      : await signUp(email, password, businessName);
    setBusy(false);
    if (result.error) setError(result.error);
  }

  return (
    <div className="min-h-screen flex">
      {/* Left panel */}
      <div className="hidden lg:flex lg:w-1/2 bg-slate-900 relative overflow-hidden">
        <div className="absolute inset-0 opacity-20" style={{
          backgroundImage: 'radial-gradient(circle at 20% 50%, #3b82f6 0%, transparent 50%), radial-gradient(circle at 80% 80%, #10b981 0%, transparent 50%)',
        }} />
        <div className="relative z-10 flex flex-col justify-between p-12 text-white">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-white/10 backdrop-blur flex items-center justify-center">
              <Globe className="w-6 h-6" />
            </div>
            <span className="text-xl font-semibold tracking-tight">PayFlow</span>
          </div>
          <div>
            <h1 className="text-4xl font-bold leading-tight mb-4">
              The payment gateway<br />built for the world.
            </h1>
            <p className="text-slate-400 text-lg max-w-md">
              Accept payments, send invoices, process refunds, and manage payouts — all in 40+ currencies, anywhere on the globe.
            </p>
            <div className="mt-8 space-y-3">
              {[
                'Accept payments in 40+ currencies',
                'Send professional invoices to customers',
                'Process full and partial refunds',
                'Schedule automatic payouts to your bank',
              ].map((feat) => (
                <div key={feat} className="flex items-center gap-3 text-slate-300">
                  <div className="w-5 h-5 rounded-full bg-emerald-500/20 flex items-center justify-center">
                    <svg width="12" height="12" viewBox="0 0 12 12" fill="none">
                      <path d="M2.5 6l2.5 2.5L9.5 3.5" stroke="#10b981" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                    </svg>
                  </div>
                  <span className="text-sm">{feat}</span>
                </div>
              ))}
            </div>
          </div>
          <p className="text-slate-500 text-sm">Trusted by businesses in 50+ countries</p>
        </div>
      </div>

      {/* Right panel - form */}
      <div className="flex-1 flex items-center justify-center p-6 bg-slate-50">
        <div className="w-full max-w-md">
          <div className="lg:hidden flex items-center gap-3 mb-8">
            <div className="w-10 h-10 rounded-xl bg-slate-900 flex items-center justify-center text-white">
              <Globe className="w-6 h-6" />
            </div>
            <span className="text-xl font-semibold tracking-tight text-slate-900">PayFlow</span>
          </div>

          <h2 className="text-2xl font-bold text-slate-900 mb-1">
            {mode === 'signin' ? 'Welcome back' : 'Create your account'}
          </h2>
          <p className="text-slate-500 text-sm mb-6">
            {mode === 'signin' ? 'Sign in to your dashboard' : 'Start accepting payments in minutes'}
          </p>

          <form onSubmit={handleSubmit} className="space-y-4">
            {mode === 'signup' && (
              <Input
                label="Business name"
                value={businessName}
                onChange={setBusinessName}
                placeholder="Acme Inc."
                required
              />
            )}
            <Input
              label="Email"
              type="email"
              value={email}
              onChange={setEmail}
              placeholder="you@business.com"
              required
            />
            <Input
              label="Password"
              type="password"
              value={password}
              onChange={setPassword}
              placeholder="Min 6 characters"
              required
            />

            {error && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 text-sm px-4 py-3 rounded-lg">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" disabled={busy} className="w-full">
              {busy ? 'Please wait...' : mode === 'signin' ? 'Sign in' : 'Create account'}
            </Button>
          </form>

          <p className="text-center text-sm text-slate-500 mt-6">
            {mode === 'signin' ? "Don't have an account? " : 'Already have an account? '}
            <button
              onClick={() => { setMode(mode === 'signin' ? 'signup' : 'signin'); setError(null); }}
              className="text-slate-900 font-medium hover:underline"
            >
              {mode === 'signin' ? 'Sign up' : 'Sign in'}
            </button>
          </p>
        </div>
      </div>
    </div>
  );
}
