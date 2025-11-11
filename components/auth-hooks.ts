'use client';
import { useEffect, useMemo, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getSupabaseClient } from '@/lib/supabase';

export function useAuthReady() {
  const { loading, user, userId, session } = useAuth();
  return { loading, user, userId, session, ready: !loading && !!userId, signedIn: !!userId };
}

// If a user is required, call this at the top of protected pages
export function useRequireUserId() {
  const { loading, userId } = useAuth();
  const router = useRouter();
  useEffect(() => {
    if (!loading && !userId) router.replace('/login?next=' + encodeURIComponent(location.pathname));
  }, [loading, userId, router]);
  return { userId, loading, ready: !loading && !!userId };
}

// Generic fetcher for "rows owned by user_id"
export function useUserTable<T = any>(
  table: string,
  select = '*',
  order: { column?: string; ascending?: boolean } = { column: 'created_at', ascending: false },
) {
  const { ready, userId } = useAuthReady();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [data, setData] = useState<T[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!ready) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      const q = supabase
        .from(table)
        .select(select)
        .eq('user_id', userId as string)
        .order(order.column ?? 'created_at', { ascending: !!order.ascending });
      const { data, error } = await q;
      if (cancelled) return;
      if (error) setError(error.message);
      else setData((data as T[]) ?? []);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [ready, userId, table, select, order.column, order.ascending, supabase]);

  return { data, error, loading };
}
