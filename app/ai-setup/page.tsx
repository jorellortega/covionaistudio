'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

export default function AISetupRedirect() {
  const router = useRouter();

  useEffect(() => {
    // Redirect to the correct route
    router.replace('/setup-ai');
  }, [router]);

  return (
    <div className="min-h-screen bg-background flex items-center justify-center">
      <div className="text-center">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500 mx-auto mb-4"></div>
        <p className="text-muted-foreground">Redirecting to AI Setup...</p>
      </div>
    </div>
  );
}
