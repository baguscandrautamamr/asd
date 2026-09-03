import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';
import type { Session } from '@supabase/supabase-js';
import { isSupabaseConfigured, supabase } from '../lib/supabase';

export interface AppUser {
  id: string;
  email: string;
  name: string;
}

interface AuthContextValue {
  /** False when the app runs without Supabase env vars (local mode). */
  configured: boolean;
  /** True until the initial session lookup finishes. */
  loading: boolean;
  user: AppUser | null;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string, fullName: string) => Promise<string | null>;
  sendMagicLink: (email: string) => Promise<void>;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

function toAppUser(session: Session | null): AppUser | null {
  if (!session?.user) return null;
  const meta = session.user.user_metadata ?? {};
  const email = session.user.email ?? '';
  return {
    id: session.user.id,
    email,
    name: (meta.full_name as string) || email.split('@')[0] || 'User',
  };
}

export const AuthProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [user, setUser] = useState<AppUser | null>(null);
  const [loading, setLoading] = useState(isSupabaseConfigured);

  useEffect(() => {
    if (!supabase) return;

    let active = true;
    supabase.auth.getSession().then(({ data }) => {
      if (!active) return;
      setUser(toAppUser(data.session));
      setLoading(false);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setUser(toAppUser(session));
      setLoading(false);
    });

    return () => {
      active = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  const signIn = useCallback(async (email: string, password: string) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string, fullName: string) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { data: { full_name: fullName } },
    });
    if (error) throw error;
    // With email confirmation enabled Supabase returns a user but no session;
    // the caller shows a "check your inbox" message in that case.
    return data.session ? null : 'confirm-email';
  }, []);

  const sendMagicLink = useCallback(async (email: string) => {
    if (!supabase) throw new Error('Supabase not configured');
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: window.location.origin },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    if (!supabase) return;
    await supabase.auth.signOut();
    setUser(null);
  }, []);

  const value = useMemo(
    () => ({
      configured: isSupabaseConfigured,
      loading,
      user,
      signIn,
      signUp,
      sendMagicLink,
      signOut,
    }),
    [loading, user, signIn, signUp, sendMagicLink, signOut]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
};

export function useAuth(): AuthContextValue {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside <AuthProvider>');
  return ctx;
}
