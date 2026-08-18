import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import type { Session, User } from '@supabase/supabase-js';
import { supabase } from '@/lib/supabase';
import type { Merchant } from '@/lib/types';

interface AuthContextValue {
  session: Session | null;
  user: User | null;
  merchant: Merchant | null;
  loading: boolean;
  signIn: (email: string, password: string) => Promise<{ error: string | null }>;
  signUp: (email: string, password: string, businessName: string) => Promise<{ error: string | null }>;
  signOut: () => Promise<void>;
  refreshMerchant: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<User | null>(null);
  const [merchant, setMerchant] = useState<Merchant | null>(null);
  const [loading, setLoading] = useState(true);

  async function fetchMerchant(uid: string) {
    const { data, error } = await supabase
      .from('merchants')
      .select('*')
      .eq('user_id', uid)
      .maybeSingle();
    if (error) {
      console.error('Error fetching merchant:', error.message);
      return;
    }
    if (data) {
      setMerchant(data as Merchant);
    }
  }

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setUser(data.session?.user ?? null);
      if (data.session?.user) {
        fetchMerchant(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      setUser(newSession?.user ?? null);
      if (newSession?.user) {
        fetchMerchant(newSession.user.id).finally(() => setLoading(false));
      } else {
        setMerchant(null);
        setLoading(false);
      }
    });

    return () => {
      authListener.subscription.unsubscribe();
    };
  }, []);

  async function signIn(email: string, password: string) {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error?.message ?? null };
  }

  async function signUp(email: string, password: string, businessName: string) {
    const { data, error } = await supabase.auth.signUp({ email, password });
    if (error) return { error: error.message };
    if (data.user) {
      const { error: merchantError } = await supabase.from('merchants').insert({
        user_id: data.user.id,
        business_name: businessName,
        business_email: email,
      });
      if (merchantError) return { error: merchantError.message };
    }
    return { error: null };
  }

  async function signOut() {
    await supabase.auth.signOut();
    setMerchant(null);
  }

  async function refreshMerchant() {
    if (user) await fetchMerchant(user.id);
  }

  return (
    <AuthContext.Provider value={{ session, user, merchant, loading, signIn, signUp, signOut, refreshMerchant }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used within AuthProvider');
  return ctx;
}
