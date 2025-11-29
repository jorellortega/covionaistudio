'use client';
import { useEffect, useMemo, useState, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { useAuth } from '@/components/AuthProvider';
import { getSupabaseClient } from '@/lib/supabase';
import Link from 'next/link';
import { ArrowLeft, Check, ChevronDown, ChevronUp } from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Label } from '@/components/ui/label';
import { useToast } from '@/hooks/use-toast';

type Mode = 'signin' | 'signup' | 'reset';

const plans = [
  {
    id: 'creator',
    name: 'Creator',
    price: 45,
    description: 'For professional creators',
    features: ['25,000 Studio Credits', '300s Standard Video', '60s Cinematic Video'],
  },
  {
    id: 'studio',
    name: 'Studio',
    price: 150,
    description: 'For production teams',
    features: ['90,000 Studio Credits', '900s Standard Video', '240s Cinematic Video'],
  },
  {
    id: 'production',
    name: 'Production House',
    price: 500,
    description: 'For large production companies',
    features: ['220,000 Studio Credits', '2,400s Standard Video', '600s Cinematic Video'],
  },
];

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

  const { toast } = useToast();
  const [mode, setMode] = useState<Mode>('signin');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [selectedPlan, setSelectedPlan] = useState<string>('studio');
  const [inviteCode, setInviteCode] = useState<string>('');
  const [inviteCodeRole, setInviteCodeRole] = useState<string | null>(null);
  const [validatingInviteCode, setValidatingInviteCode] = useState(false);
  const [showInviteCodeField, setShowInviteCodeField] = useState(false);
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
        // If no invite code, plan is required
        if (!inviteCode && !selectedPlan) return 'Please select a subscription plan or enter an invite code.';
        if (password.length < 8) return 'Password must be at least 8 characters.';
        if (password !== confirm) return 'Passwords do not match.';
      }
    }
    return null;
  }

  // Validate invite code when user enters it
  async function validateInviteCode(code: string) {
    if (!code || code.trim().length === 0) {
      setInviteCodeRole(null);
      return;
    }

    setValidatingInviteCode(true);
    try {
      const response = await fetch(`/api/invite-codes/validate?code=${encodeURIComponent(code.toUpperCase())}`);
      const data = await response.json();

      if (data.valid && data.role) {
        setInviteCodeRole(data.role);
        setSelectedPlan(''); // Clear plan selection when invite code is valid
        setError(null);
      } else {
        setInviteCodeRole(null);
        setError(data.error || 'Invalid invite code');
      }
    } catch (err) {
      setInviteCodeRole(null);
      setError('Failed to validate invite code');
    } finally {
      setValidatingInviteCode(false);
    }
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
        // If invite code is provided, validate and use it
        let finalRole = null;
        if (inviteCode && inviteCode.trim().length > 0) {
          // First validate it (without using it)
          const validateResponse = await fetch(`/api/invite-codes/validate?code=${encodeURIComponent(inviteCode.toUpperCase())}`);
          const validateData = await validateResponse.json();
          
          if (!validateData.valid || !validateData.role) {
            throw new Error(validateData.error || 'Invalid invite code');
          }
          
          finalRole = validateData.role;
          
          // Now actually use the code (increment used_count)
          // We'll do this after user creation to ensure atomicity
        }

        // Sign up the user
        const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
          email,
          password,
          options: { 
            emailRedirectTo: `${window.location.origin}/reset`,
            data: {
              selectedPlan: finalRole ? null : selectedPlan, // Store plan only if no invite code
              inviteCodeRole: finalRole, // Store role from invite code
              inviteCode: finalRole ? inviteCode.toUpperCase() : null,
            }
          }
        });
        
        if (signUpError) {
          console.error('❌ SIGNUP: Error creating account:', signUpError)
          throw signUpError
        }
        
        console.log('✅ SIGNUP: User account created successfully')
        console.log('📋 SIGNUP: User ID:', signUpData.user?.id)
        console.log('📋 SIGNUP: User email:', signUpData.user?.email)
        console.log('📋 SIGNUP: Selected plan:', selectedPlan)
        console.log('📋 SIGNUP: Invite code role:', finalRole)
        
        // If invite code was used, skip Stripe and assign role directly
        if (finalRole && signUpData.user && inviteCode) {
          // Use the invite code (increment used_count)
          const useCodeResponse = await fetch(`/api/invite-codes/use?code=${encodeURIComponent(inviteCode.toUpperCase())}`);
          if (!useCodeResponse.ok) {
            console.error('❌ SIGNUP: Error using invite code');
            // Continue anyway - role is already set by trigger
          }

          // Update user role in database (in case trigger didn't work)
          const { error: roleError } = await supabase
            .from('users')
            .update({ role: finalRole })
            .eq('id', signUpData.user.id);

          if (roleError) {
            console.error('❌ SIGNUP: Error updating user role:', roleError);
            // Don't throw - account was created, role can be updated later
          } else {
            console.log('✅ SIGNUP: User role updated to:', finalRole);
          }

          // Check if email confirmation is required
          const needsEmailConfirmation = !signUpData.session && signUpData.user;
          
          // If session exists (email confirmation disabled), redirect to dashboard
          if (signUpData.session) {
            toast({
              title: "Account created successfully",
              description: `Your account has been created with ${finalRole} role.`,
              variant: "default",
            });
            router.replace(next);
            return;
          }
          
          // Email confirmation required
          toast({
            title: "Account created successfully",
            description: `Your account has been created with ${finalRole} role. Please check your email to confirm your account.`,
            variant: "default",
          });

          setMessage('Account created! Check your email to confirm, then sign in.');
          setMode('signin');
          return;
        }
        
        // Redirect to checkout with selected plan (normal flow)
        if (selectedPlan && signUpData.user) {
          console.log('🔧 SIGNUP: Creating checkout session...')
          console.log('📋 SIGNUP: Checkout payload:', {
            planId: selectedPlan,
            userId: signUpData.user.id,
            userEmail: email,
            action: 'subscribe',
          })
          
          try {
            const checkoutPayload = {
              planId: selectedPlan,
              userId: signUpData.user.id,
              userEmail: email,
              action: 'subscribe',
            }
            
            console.log('📤 SIGNUP: Sending checkout request to /api/stripe/create-checkout')
            const response = await fetch('/api/stripe/create-checkout', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
              },
              body: JSON.stringify(checkoutPayload),
            });

            console.log('📥 SIGNUP: Checkout response received')
            console.log('📋 SIGNUP: Response status:', response.status)
            console.log('📋 SIGNUP: Response ok:', response.ok)

            if (!response.ok) {
              const errorData = await response.json();
              console.error('❌ SIGNUP: Checkout error response:', errorData)
              throw new Error(errorData.error || 'Failed to create checkout session');
            }

            const checkoutResponse = await response.json();
            console.log('✅ SIGNUP: Checkout session created successfully')
            console.log('📋 SIGNUP: Checkout response:', checkoutResponse)
            
            const { url } = checkoutResponse;
            console.log('📋 SIGNUP: Checkout URL:', url)
            
            if (url) {
              console.log('🔧 SIGNUP: Redirecting to Stripe Checkout...')
              // Redirect to Stripe Checkout
              window.location.href = url;
              return;
            } else {
              console.error('❌ SIGNUP: No checkout URL in response')
            }
          } catch (checkoutError: any) {
            console.error('❌ SIGNUP: Error creating checkout session:', checkoutError);
            console.error('❌ SIGNUP: Error details:', {
              message: checkoutError.message,
              stack: checkoutError.stack,
            })
            toast({
              title: "Account created",
              description: "Your account was created successfully. You can subscribe to a plan later.",
              variant: "default",
            });
          }
        } else {
          console.log('⚠️ SIGNUP: No plan selected or user not created, skipping checkout')
        }
        
        // If session exists (email confirmation disabled), redirect to dashboard
        if (signUpData.session) {
          router.replace(next);
          return;
        }
        
        // Email confirmation required
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
      
      <div className="w-full max-w-sm space-y-4">
        <Tabs 
          value={mode === 'reset' ? 'signin' : mode} 
          onValueChange={(value) => setMode(value as Mode)}
          className="w-full"
        >
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="signin">Sign In</TabsTrigger>
            <TabsTrigger value="signup">Sign Up</TabsTrigger>
          </TabsList>

          <TabsContent value="signin" className="space-y-4 mt-4">
            <form onSubmit={onSubmit} className="space-y-4">
              <h1 className="text-2xl font-semibold">Sign in</h1>

              <label className="block">
                <span className="text-sm">Email</span>
                <input type="email" autoComplete="email"
                  className="mt-1 w-full rounded-md border p-2 bg-black/40"
                  value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>

              <label className="block">
                <span className="text-sm">Password</span>
                <input type="password"
                  autoComplete="current-password"
                  className="mt-1 w-full rounded-md border p-2 bg-black/40"
                  value={password} onChange={(e) => setPassword(e.target.value)} required />
              </label>

              {error && <p className="text-red-500 text-sm">{error}</p>}
              {message && <p className="text-green-500 text-sm">{message}</p>}

              <button type="submit" disabled={submitting} className="w-full rounded-md border p-2">
                {submitting ? 'Please wait…' : 'Sign in'}
              </button>

              <div className="text-right pt-2">
                <button 
                  type="button" 
                  onClick={() => setMode('reset')} 
                  className="text-xs text-gray-600 hover:text-foreground font-medium transition-colors"
                >
                  Forgot password?
                </button>
              </div>
            </form>
          </TabsContent>

          <TabsContent value="signup" className="space-y-4 mt-4">
            <form onSubmit={onSubmit} className="space-y-4">
              <h1 className="text-2xl font-semibold">Create account</h1>

              {/* Invite Code Field - Collapsible */}
              <div className="space-y-2">
                <button
                  type="button"
                  onClick={() => setShowInviteCodeField(!showInviteCodeField)}
                  className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors w-full"
                >
                  {showInviteCodeField ? (
                    <ChevronUp className="h-4 w-4" />
                  ) : (
                    <ChevronDown className="h-4 w-4" />
                  )}
                  <span>Have an invite code?</span>
                </button>
                
                {showInviteCodeField && (
                  <div className="space-y-2 pt-2">
                    <Label className="text-sm font-medium">
                      Invite Code (Optional)
                    </Label>
                    <input
                      type="text"
                      placeholder="Enter invite code"
                      className="w-full rounded-md border p-2 bg-black/40 uppercase"
                      value={inviteCode}
                      onChange={(e) => {
                        const code = e.target.value.toUpperCase();
                        setInviteCode(code);
                        if (code.length > 0) {
                          validateInviteCode(code);
                        } else {
                          setInviteCodeRole(null);
                          setError(null);
                        }
                      }}
                      disabled={validatingInviteCode}
                    />
                    {validatingInviteCode && (
                      <p className="text-xs text-muted-foreground">Validating invite code...</p>
                    )}
                    {inviteCodeRole && (
                      <p className="text-xs text-green-500">
                        ✓ Valid invite code - You'll get {inviteCodeRole} role
                      </p>
                    )}
                    {inviteCode && !inviteCodeRole && !validatingInviteCode && (
                      <p className="text-xs text-muted-foreground">
                        Enter a valid invite code to skip payment
                      </p>
                    )}
                  </div>
                )}
              </div>

              {/* Plan Selection - Required only if no invite code */}
              {!inviteCodeRole && (
                <div className="space-y-3">
                  <Label className="text-sm font-medium">
                    Select a subscription plan <span className="text-red-500">*</span>
                  </Label>
                  <RadioGroup value={selectedPlan} onValueChange={setSelectedPlan} className="space-y-2" required>
                    {plans.map((plan) => (
                      <div key={plan.id} className="flex items-center space-x-2">
                        <RadioGroupItem value={plan.id} id={plan.id} />
                        <Label
                          htmlFor={plan.id}
                          className={`flex-1 rounded-md border-2 p-3 cursor-pointer transition-colors ${
                            plan.id === selectedPlan 
                              ? 'border-primary bg-primary/5' 
                              : 'border-muted hover:bg-accent'
                          }`}
                        >
                          <div className="flex items-center justify-between">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 mb-1">
                                <span className="text-sm font-semibold">{plan.name}</span>
                                {plan.id === selectedPlan && (
                                  <Check className="h-4 w-4 text-primary" />
                                )}
                              </div>
                              <p className="text-xs text-muted-foreground">{plan.description}</p>
                            </div>
                            <div className="text-right ml-4">
                              <span className="text-sm font-semibold">${plan.price}<span className="text-xs text-muted-foreground">/mo</span></span>
                            </div>
                          </div>
                        </Label>
                      </div>
                    ))}
                  </RadioGroup>
                  {!selectedPlan && mode === 'signup' && (
                    <p className="text-xs text-red-500">Please select a subscription plan to continue.</p>
                  )}
                </div>
              )}

              <label className="block">
                <span className="text-sm">Email</span>
                <input type="email" autoComplete="email"
                  className="mt-1 w-full rounded-md border p-2 bg-black/40"
                  value={email} onChange={(e) => setEmail(e.target.value)} required />
              </label>

              <label className="block">
                <span className="text-sm">Password</span>
                <input type="password"
                  autoComplete="new-password"
                  className="mt-1 w-full rounded-md border p-2 bg-black/40"
                  value={password} onChange={(e) => setPassword(e.target.value)} required />
              </label>

              <label className="block">
                <span className="text-sm">Confirm password</span>
                <input type="password" autoComplete="new-password"
                  className="mt-1 w-full rounded-md border p-2 bg-black/40"
                  value={confirm} onChange={(e) => setConfirm(e.target.value)} required />
              </label>

              {error && <p className="text-red-500 text-sm">{error}</p>}
              {message && <p className="text-green-500 text-sm">{message}</p>}

              <button 
                type="submit" 
                disabled={submitting || (!selectedPlan && !inviteCodeRole)} 
                className="w-full rounded-md border p-2 disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {submitting 
                  ? 'Please wait…' 
                  : inviteCodeRole
                    ? `Create free account (${inviteCodeRole} role)`
                    : selectedPlan 
                      ? `Continue to checkout - $${plans.find(p => p.id === selectedPlan)?.price}/mo` 
                      : 'Select a plan or enter invite code to continue'
                }
              </button>
            </form>
          </TabsContent>
        </Tabs>

        {mode === 'reset' && (
          <form onSubmit={onSubmit} className="space-y-4">
            <h1 className="text-2xl font-semibold">Reset password</h1>

            <label className="block">
              <span className="text-sm">Email</span>
              <input type="email" autoComplete="email"
                className="mt-1 w-full rounded-md border p-2 bg-black/40"
                value={email} onChange={(e) => setEmail(e.target.value)} required />
            </label>

            {error && <p className="text-red-500 text-sm">{error}</p>}
            {message && <p className="text-green-500 text-sm">{message}</p>}

            <button type="submit" disabled={submitting} className="w-full rounded-md border p-2">
              {submitting ? 'Please wait…' : 'Send reset email'}
            </button>

            <div className="text-center">
              <button type="button" onClick={() => setMode('signin')} className="text-sm text-muted-foreground hover:text-foreground">
                Back to sign in
              </button>
            </div>
          </form>
        )}
      </div>
    </main>
  );
}
