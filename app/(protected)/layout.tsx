'use client';
import { useEffect, Suspense, useMemo, useState } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getSupabaseClient } from '@/lib/supabase';
import { accountAccessExpired, pathMatchesBlockedRoute } from '@/lib/path-access';

function ProtectedLayoutContent({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const [accessLoading, setAccessLoading] = useState(false);

  // Allow public access to casting pages (the page component will handle access control)
  const isCastingPage = pathname?.startsWith('/casting/');

  useEffect(() => {
    // Don't redirect if it's a casting page (let the page handle access control)
    if (!loading && !session && !isCastingPage) {
      router.replace('/login?next=' + encodeURIComponent(window.location.pathname));
    }
  }, [loading, session, router, isCastingPage]);

  useEffect(() => {
    if (loading || !session?.user || isCastingPage) return;

    let cancelled = false;
    (async () => {
      setAccessLoading(true);
      const { data: row, error } = await supabase
        .from('users')
        .select('login_disabled, access_expires_at, blocked_routes')
        .eq('id', session.user.id)
        .maybeSingle();

      if (cancelled) return;
      setAccessLoading(false);

      if (error || !row) return;

      if (row.login_disabled) {
        await supabase.auth.signOut();
        router.replace('/login?reason=disabled');
        return;
      }
      if (accountAccessExpired(row.access_expires_at)) {
        await supabase.auth.signOut();
        router.replace('/login?reason=expired');
        return;
      }
      if (pathname && pathMatchesBlockedRoute(pathname, row.blocked_routes)) {
        router.replace('/dashboard?notice=route_blocked');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, session, pathname, isCastingPage, supabase, router]);

  // For casting pages, allow rendering immediately without waiting for auth
  if (isCastingPage) {
    return <>{children}</>;
  }

  if (loading) {
    return <div className="grid min-h-screen place-items-center"><p>Checking session…</p></div>;
  }
  
  // Allow rendering if user has session
  if (!session) {
    return null; // waiting for redirect
  }

  if (accessLoading) {
    return <div className="grid min-h-screen place-items-center"><p>Checking access…</p></div>;
  }
  
  return <>{children}</>;
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center"><p>Loading…</p></div>}>
      <ProtectedLayoutContent>{children}</ProtectedLayoutContent>
    </Suspense>
  );
}
