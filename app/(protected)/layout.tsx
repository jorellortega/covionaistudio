'use client';
import { useEffect, Suspense } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

function ProtectedLayoutContent({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Allow public access to casting pages (the page component will handle access control)
  const isCastingPage = pathname?.startsWith('/casting/');

  useEffect(() => {
    // Don't redirect if it's a casting page (let the page handle access control)
    if (!loading && !session && !isCastingPage) {
      router.replace('/login?next=' + encodeURIComponent(window.location.pathname));
    }
  }, [loading, session, router, isCastingPage]);

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
  
  return <>{children}</>;
}

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center"><p>Loading…</p></div>}>
      <ProtectedLayoutContent>{children}</ProtectedLayoutContent>
    </Suspense>
  );
}
