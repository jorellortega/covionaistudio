'use client';
import { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getSupabaseClient } from '@/lib/supabase';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';

type Mode = 'signin' | 'signup' | 'reset';

export default function LoginPage() {
  return (
    <Suspense fallback={<div className="grid min-h-screen place-items-center"><p>Loading...</p></div>}>
      <LoginPageContent />
    </Suspense>
  );
}

function LoginPageContent() {
  const { session, loading } = useAuth();
  const router = useRouter();
  const sp = useSearchParams();
  const next = sp.get('next') || '/dashboard';
  const supabase = useMemo(() => getSupabaseClient(), []);

  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  console.log('[ENV] URL:', process.env.NEXT_PUBLIC_SUPABASE_URL);
  console.log('[ENV] ANON present:', !!process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
  console.log('[login] loading:', loading, 'session:', !!session);

  useEffect(() => {
    if (!loading && session) router.replace(next);
  }, [loading, session, next, router]);

  function validate(): string | null {
    if (!email) return 'Email is required.';
    if (mode !== 'reset') {
      if (!password) return 'Password is required.';
      if (mode === 'signup') {
        if (password.length < 8) return 'Password must be at least 8 characters.';
        if (password !== confirm) return 'Passwords do not match.';
      }
    }
    return null;
  }

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null); setMessage(null);
    const v = validate();
    if (v) { setError(v); return; }
    setSubmitting(true);
    try {
      if (mode === 'signin') {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        router.replace(next);
      } else if (mode === 'signup') {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: { emailRedirectTo: `${window.location.origin}/reset` }
        });
        if (error) throw error;
        setMessage('Check your email to confirm your account, then sign in.');
        setMode('signin');
      } else {
        const { error } = await supabase.auth.resetPasswordForEmail(email, {
          redirectTo: `${window.location.origin}/reset`,
        });
        if (error) throw error;
        setMessage('Password reset email sent.');
        setMode('signin');
      }
    } catch (err: any) {
      setError(err?.message ?? 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) return <div className="grid min-h-screen place-items-center"><p>Initializing authentication…</p></div>;
  if (session) return null;

  return (
    <main className="grid min-h-screen place-items-center p-6">
      {/* Go Home Button */}
      <div className="absolute top-6 left-6">
        <Link href="/" className="inline-flex items-center gap-2 px-4 py-2 text-sm font-medium text-muted-foreground hover:text-foreground transition-colors">
          <ArrowLeft className="h-4 w-4" />
          Go Home
        </Link>
      </div>
      
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">
          {mode === 'signin' ? 'Sign in' : mode === 'signup' ? 'Create account' : 'Reset password'}
        </h1>

        <label className="block">
          <span className="text-sm">Email</span>
          <input type="email" autoComplete="email"
            className="mt-1 w-full rounded-md border p-2 bg-black/40"
            value={email} onChange={(e) => setEmail(e.target.value)} required />
        </label>

        {mode !== 'reset' && (
          <>
            <label className="block">
              <span className="text-sm">Password</span>
              <input type="password"
                autoComplete={mode === 'signup' ? 'new-password' : 'current-password'}
                className="mt-1 w-full rounded-md border p-2 bg-black/40"
                value={password} onChange={(e) => setPassword(e.target.value)} required />
            </label>
            {mode === 'signup' && (
              <label className="block">
                <span className="text-sm">Confirm password</span>
                <input type="password" autoComplete="new-password"
                  className="mt-1 w-full rounded-md border p-2 bg-black/40"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </label>
            )}
          </>
        )}

        {error && <p className="text-red-500 text-sm">{error}</p>}
        {message && <p className="text-green-500 text-sm">{message}</p>}

        <button type="submit" disabled={submitting} className="w-full rounded-md border p-2">
          {submitting ? 'Please wait…' : mode === 'signin' ? 'Sign in'
            : mode === 'signup' ? 'Create account' : 'Send reset email'}
        </button>

        <div className="flex justify-between text-sm">
          {mode === 'signin' && (
            <>
              <button type="button" onClick={() => setMode('signup')}>Create account</button>
              <button type="button" onClick={() => setMode('reset')}>Forgot password?</button>
            </>
          )}
          {mode !== 'signin' && <button type="button" onClick={() => setMode('signin')}>Back to sign in</button>}
        </div>
      </form>
    </main>
  );
}
