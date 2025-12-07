'use client';
import { useEffect } from 'react';
import { useRouter, usePathname, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  // Allow public access to casting pages (the page component will handle access control)
  const isCastingPage = pathname?.startsWith('/casting/');
  const isPublicViewParam = searchParams?.get('view') === 'public';

  useEffect(() => {
    // Don't redirect if it's a casting page (let the page handle access control)
    if (!loading && !session && !isCastingPage) {
      router.replace('/login?next=' + encodeURIComponent(window.location.pathname));
    }
  }, [loading, session, router, isCastingPage]);

  if (loading) {
    return <div className="grid min-h-screen place-items-center"><p>Checking session…</p></div>;
  }
  
  // Allow rendering if user has session OR it's a casting page
  // The casting page component will handle showing appropriate content based on access
  if (!session && !isCastingPage) {
    return null; // waiting for redirect
  }
  
  return <>{children}</>;
}
