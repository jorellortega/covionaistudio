'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session, AuthChangeEvent } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';

type Ctx = {
  session: Session | null;
  user: Session['user'] | null;
  userId: string | null;
  loading: boolean;
};

const AuthCtx = createContext<Ctx>({ session: null, user: null, userId: null, loading: true });
export const useAuth = () => useContext(AuthCtx);

const SESSION_INIT_TIMEOUT_MS = 6_000;

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initDoneRef = useRef(false);

  useEffect(() => {
    let alive = true;

    const finishLoading = () => {
      if (!alive || initDoneRef.current) return;
      initDoneRef.current = true;
      setLoading(false);
    };

    const timeout = setTimeout(() => {
      console.warn('[AuthProvider] session init timed out — continuing without block');
      finishLoading();
    }, SESSION_INIT_TIMEOUT_MS);

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((ev: AuthChangeEvent, s) => {
      if (!alive) return;
      console.log('🔔 onAuthStateChange:', ev);
      setSession(s ?? null);
      finishLoading();
    });

    supabase.auth
      .getSession()
      .then(({ data, error }) => {
        if (!alive) return;
        if (error) console.error('[getSession] error:', error);
        console.log('📡 Initial session result:', data.session ? 'present' : 'none');
        setSession(data.session ?? null);
        finishLoading();
      })
      .catch((err) => {
        if (!alive) return;
        console.error('[getSession] failed:', err);
        finishLoading();
      })
      .finally(() => {
        clearTimeout(timeout);
      });

    return () => {
      alive = false;
      clearTimeout(timeout);
      subscription.unsubscribe();
    };
  }, [supabase]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      userId: session?.user?.id ?? null,
      loading,
    }),
    [session, loading],
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return null;
  return <>{children}</>;
}
