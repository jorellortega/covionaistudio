'use client';
import { useState } from 'react';
import { getSupabaseClient } from '@/lib/supabase';

export default function ResetPage() {
  const supabase = getSupabaseClient();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [msg, setMsg] = useState<string | null>(null);
  const [err, setErr] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function onSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErr(null); setMsg(null);
    if (password.length < 8) return setErr('Password must be at least 8 characters.');
    if (password !== confirm) return setErr('Passwords do not match.');
    setBusy(true);
    const { error } = await supabase.auth.updateUser({ password });
    setBusy(false);
    if (error) setErr(error.message);
    else setMsg('Password updated. You can close this tab and sign in.');
  }

  return (
    <main className="grid min-h-screen place-items-center p-6">
      <form onSubmit={onSubmit} className="w-full max-w-sm space-y-4">
        <h1 className="text-2xl font-semibold">Set a new password</h1>
        <input type="password" placeholder="New password" className="w-full rounded-md border p-2 bg-black/40"
               value={password} onChange={(e) => setPassword(e.target.value)} />
        <input type="password" placeholder="Confirm password" className="w-full rounded-md border p-2 bg-black/40"
               value={confirm} onChange={(e) => setConfirm(e.target.value)} />
        {err && <p className="text-red-500 text-sm">{err}</p>}
        {msg && <p className="text-green-500 text-sm">{msg}</p>}
        <button disabled={busy} className="w-full rounded-md border p-2">
          {busy ? 'Saving…' : 'Update password'}
        </button>
      </form>
    </main>
  );
}
