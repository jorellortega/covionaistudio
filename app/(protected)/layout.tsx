'use client';
import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';

export default function ProtectedLayout({ children }: { children: React.ReactNode }) {
  const { session, loading } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (!loading && !session) {
      router.replace('/login?next=' + encodeURIComponent(window.location.pathname));
    }
  }, [loading, session, router]);

  if (loading) {
    return <div className="grid min-h-screen place-items-center"><p>Checking session…</p></div>;
  }
  if (!session) return null; // waiting for redirect
  return <>{children}</>;
}
