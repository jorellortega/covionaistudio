'use client';
import { createContext, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { Session, User, AuthChangeEvent } from '@supabase/supabase-js';
import { getSupabaseClient } from '@/lib/supabase';

type Ctx = {
  session: Session | null;
  user: User | null;
  userId: string | null;
  loading: boolean;
};

const AuthCtx = createContext<Ctx>({ session: null, user: null, userId: null, loading: true });
export const useAuth = () => useContext(AuthCtx);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const cleanupRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    console.log('[AuthProvider] mount');
    let alive = true; // prevents setState after unmount

    (async () => {
      console.log('🚀 Initializing auth…');
      const { data, error } = await supabase.auth.getSession();
      if (error) console.error('[getSession] error:', error);
      if (!alive) return;
      console.log('📡 Initial session result:', data.session ? 'present' : 'none');
      setSession(data.session ?? null);
      setLoading(false);

      const { data: sub } = supabase.auth.onAuthStateChange((ev: AuthChangeEvent, s) => {
        if (!alive) return;
        console.log('🔔 onAuthStateChange:', ev);
        if (ev !== 'INITIAL_SESSION') setSession(s ?? null);
      });
      cleanupRef.current = () => sub.subscription.unsubscribe();
    })();

    return () => {
      console.log('[AuthProvider] unmount');
      alive = false;
      cleanupRef.current?.();
      cleanupRef.current = null;
    };
  }, [supabase]);

  const value = useMemo(
    () => ({
      session,
      user: session?.user ?? null,
      userId: session?.user?.id ?? null,
      loading,
    }),
    [session, loading]
  );

  return <AuthCtx.Provider value={value}>{children}</AuthCtx.Provider>;
}

export function RequireAuth({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  if (loading) return null;
  if (!session) return null;
  return <>{children}</>;
}
