'use client';
import { useEffect, Suspense, useMemo, useRef } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getSupabaseClient } from '@/lib/supabase';
import {
  getCachedAccountAccess,
  setCachedAccountAccess,
  shouldBlockRoute,
  shouldForceLogout,
  type AccountAccessRow,
} from '@/lib/account-access-cache';

function ProtectedLayoutContent({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const supabase = useMemo(() => getSupabaseClient(), []);
  const accessCheckedForUser = useRef<string | null>(null);

  const isCastingPage = pathname?.startsWith('/casting/');

  useEffect(() => {
    if (!loading && !session && !isCastingPage) {
      router.replace('/login?next=' + encodeURIComponent(window.location.pathname));
    }
  }, [loading, session, router, isCastingPage]);

  // Blocked-route check (uses cached row — no network)
  useEffect(() => {
    if (loading || !session?.user || isCastingPage || !pathname) return;
    const cached = getCachedAccountAccess(session.user.id);
    if (cached && shouldBlockRoute(pathname, cached)) {
      router.replace('/dashboard?notice=route_blocked');
    }
  }, [loading, session?.user?.id, pathname, isCastingPage, router]);

  // Access check once per login — cached 10 min; never sign out on fetch errors
  useEffect(() => {
    if (loading || !session?.user || isCastingPage) return;

    const userId = session.user.id;
    if (accessCheckedForUser.current === userId) return;

    const cached = getCachedAccountAccess(userId);
    if (cached) {
      accessCheckedForUser.current = userId;
      const logoutReason = shouldForceLogout(cached);
      if (logoutReason) {
        void supabase.auth.signOut().then(() => {
          router.replace(`/login?reason=${logoutReason}`);
        });
      }
      return;
    }

    let cancelled = false;
    accessCheckedForUser.current = userId;

    (async () => {
      const { data: row, error } = await supabase
        .from('users')
        .select('login_disabled, access_expires_at, blocked_routes')
        .eq('id', userId)
        .maybeSingle();

      if (cancelled) return;

      if (error) {
        console.warn('[access] users lookup failed (not signing out):', error.message);
        accessCheckedForUser.current = null;
        return;
      }

      if (!row) {
        console.warn('[access] no users row found (not signing out)');
        accessCheckedForUser.current = null;
        return;
      }

      const accessRow = row as AccountAccessRow;
      setCachedAccountAccess(userId, accessRow);

      const logoutReason = shouldForceLogout(accessRow);
      if (logoutReason) {
        await supabase.auth.signOut();
        router.replace(`/login?reason=${logoutReason}`);
        return;
      }

      if (pathname && shouldBlockRoute(pathname, accessRow)) {
        router.replace('/dashboard?notice=route_blocked');
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [loading, session?.user?.id, isCastingPage, supabase, router, pathname]);

  if (isCastingPage) {
    return <>{children}</>;
  }

  // No full-page block — redirect to login in useEffect when session is confirmed absent
  if (!loading && !session) {
    return null;
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
