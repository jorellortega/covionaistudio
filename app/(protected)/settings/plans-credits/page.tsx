"use client"

import { useState, useEffect } from 'react'
import { useAuthReady } from '@/components/auth-hooks'
import { getSupabaseClient } from '@/lib/supabase'
import Header from '@/components/header'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { useToast } from '@/hooks/use-toast'
import { 
  CreditCard, 
  Zap, 
  ArrowUp, 
  ArrowDown, 
  X, 
  Play, 
  ShoppingCart,
  Check,
  Loader2,
  RefreshCw,
  Infinity,
  Wallet,
  Trash2,
  Plus
} from 'lucide-react'
import Link from 'next/link'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const plans = [
  { id: 'creator', name: 'Creator', price: 60, credits: 25000 },
  { id: 'studio', name: 'Studio', price: 150, credits: 90000 },
  { id: 'production', name: 'Production House', price: 500, credits: 220000 },
]

const creditPackages = [
  { id: 'pack1', name: 'Starter Pack', credits: 5000, price: 10 },
  { id: 'pack2', name: 'Creator Pack', credits: 15000, price: 25 },
  { id: 'pack3', name: 'Studio Pack', credits: 50000, price: 75 },
  { id: 'pack4', name: 'Production Pack', credits: 150000, price: 200 },
]

export default function PlansCreditsPage() {
  const { user, userId, ready } = useAuthReady()
  const { toast } = useToast()
  const [loading, setLoading] = useState(true)
  const [currentPlan, setCurrentPlan] = useState<string | null>(null)
  const [currentCredits, setCurrentCredits] = useState(0)
  const [subscriptionStatus, setSubscriptionStatus] = useState<'active' | 'canceled' | 'none'>('none')
  const [cancelAtPeriodEnd, setCancelAtPeriodEnd] = useState(false)
  const [showUpgradeDialog, setShowUpgradeDialog] = useState(false)
  const [showDowngradeDialog, setShowDowngradeDialog] = useState(false)
  const [showCancelDialog, setShowCancelDialog] = useState(false)
  const [showStartDialog, setShowStartDialog] = useState(false)
  const [showBuyCreditsDialog, setShowBuyCreditsDialog] = useState(false)
  const [selectedPlan, setSelectedPlan] = useState<string | null>(null)
  const [selectedCreditPackage, setSelectedCreditPackage] = useState<string | null>(null)
  const [isProcessing, setIsProcessing] = useState(false)
  const [creditAmount, setCreditAmount] = useState<string>('')
  const [customCredits, setCustomCredits] = useState<number>(0)
  const [savedPaymentMethods, setSavedPaymentMethods] = useState<any[]>([])
  const [stripeCustomerId, setStripeCustomerId] = useState<string | null>(null)
  const [showPaymentMethods, setShowPaymentMethods] = useState(false)
  const [isLoadingPaymentMethods, setIsLoadingPaymentMethods] = useState(false)
  
  // Credit rate: $1 = 500 credits (adjust as needed)
  const CREDIT_RATE = 500

  useEffect(() => {
    if (ready && userId) {
      loadSubscriptionData()
      loadPaymentMethods()
    }
  }, [ready, userId])

  const loadPaymentMethods = async (customerIdToUse?: string) => {
    if (!userId) return
    
    const customerId = customerIdToUse || stripeCustomerId
    if (!customerId) return
    
    try {
      setIsLoadingPaymentMethods(true)
      const response = await fetch('/api/stripe/payment-methods/list', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          customerId,
        }),
      })
      
      const data = await response.json()
      if (response.ok) {
        setSavedPaymentMethods(data.paymentMethods || [])
        if (!stripeCustomerId) {
          setStripeCustomerId(customerId)
        }
      }
    } catch (error) {
      console.error('Error loading payment methods:', error)
    } finally {
      setIsLoadingPaymentMethods(false)
    }
  }

  const handleQuickBuy = async (amount: number, paymentMethodId: string) => {
    if (!userId || !stripeCustomerId) {
      toast({
        title: "Error",
        description: "Payment method not available",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    const credits = Math.floor(amount * CREDIT_RATE)

    try {
      const response = await fetch('/api/stripe/quick-buy', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          customerId: stripeCustomerId,
          paymentMethodId,
          amount,
          credits,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Payment failed')
      }

      toast({
        title: "Success!",
        description: `${credits.toLocaleString()} credits added to your account`,
      })

      // Reload data
      loadSubscriptionData()
      loadPaymentMethods()
    } catch (error) {
      console.error('Error processing quick buy:', error)
      toast({
        title: "Payment Failed",
        description: error instanceof Error ? error.message : 'Failed to process payment',
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleAddPaymentMethod = async () => {
    if (!userId) {
      toast({
        title: "Error",
        description: "You must be logged in to add a payment method",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    
    try {
      // Get or create customer
      let customerId = stripeCustomerId
      
      if (!customerId) {
        // Create a setup intent which will create a customer if needed
        const setupResponse = await fetch('/api/stripe/setup-intent', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ userId }),
        })
        
        const setupData = await setupResponse.json()
        
        if (!setupResponse.ok) {
          throw new Error(setupData.error || 'Failed to create setup intent')
        }
        
        customerId = setupData.customerId
        setStripeCustomerId(customerId)
      }

      // Create checkout session in setup mode
      const response = await fetch('/api/stripe/create-setup-session', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId,
          customerId,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to create setup session')
      }

      if (!data.url) {
        throw new Error('No setup URL received')
      }

      // Redirect to Stripe Checkout setup page
      window.location.href = data.url
    } catch (error) {
      console.error('Error adding payment method:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : 'Failed to add payment method',
        variant: "destructive",
      })
      setIsProcessing(false)
    }
  }

  const handleDeletePaymentMethod = async (paymentMethodId: string) => {
    try {
      const response = await fetch('/api/stripe/payment-methods/delete', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ paymentMethodId }),
      })

      if (!response.ok) {
        throw new Error('Failed to delete payment method')
      }

      toast({
        title: "Success",
        description: "Payment method removed",
      })

      loadPaymentMethods()
    } catch (error) {
      console.error('Error deleting payment method:', error)
      toast({
        title: "Error",
        description: "Failed to remove payment method",
        variant: "destructive",
      })
    }
  }

  // Handle success/cancel URLs from Stripe
  useEffect(() => {
    if (typeof window !== 'undefined') {
      const params = new URLSearchParams(window.location.search)
      const success = params.get('success')
      const canceled = params.get('canceled')
      const setupSuccess = params.get('setup_success')
      const setupCanceled = params.get('setup_canceled')
      const type = params.get('type')
      const customerId = params.get('customerId')

      if (success === 'true') {
        toast({
          title: "Success!",
          description: type === 'credits' 
            ? "Your credits have been added to your account" 
            : "Your subscription has been activated",
        })
        
        // Save customer ID if provided
        if (customerId) {
          setStripeCustomerId(customerId)
          // TODO: Save customerId to database
        }
        
        // Reload subscription data and payment methods
        console.log('🔄 Reloading subscription data after successful checkout...')
        loadSubscriptionData()
        if (customerId) {
          loadPaymentMethods(customerId)
        }
        
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname)
      } else if (setupSuccess === 'true') {
        toast({
          title: "Payment Method Added!",
          description: "Your payment method has been saved successfully",
        })
        
        // Save customer ID if provided
        if (customerId) {
          setStripeCustomerId(customerId)
          // TODO: Save customerId to database
        }
        
        // Reload payment methods
        if (customerId) {
          loadPaymentMethods(customerId)
        }
        
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname)
      } else if (canceled === 'true' || setupCanceled === 'true') {
        toast({
          title: "Canceled",
          description: canceled === 'true' ? "Checkout was canceled" : "Setup was canceled",
          variant: "default",
        })
        // Clean URL
        window.history.replaceState({}, '', window.location.pathname)
      }
    }
  }, [])

  const loadSubscriptionData = async () => {
    try {
      setLoading(true)
      console.log('🔄 Loading subscription data for user:', userId)
      
      if (!userId) {
        console.log('⚠️ No userId, skipping subscription load')
        setCurrentPlan(null)
        setSubscriptionStatus('none')
        return
      }

      const supabase = getSupabaseClient()
      
      // Fetch subscription from database (including canceled ones scheduled to end)
      const { data: subscription, error } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .in('status', ['active', 'canceled'])
        .order('created_at', { ascending: false })
        .limit(1)
        .single()

      if (error) {
        // If no subscription found, that's okay
        if (error.code === 'PGRST116') {
          console.log('ℹ️ No active subscription found')
          setCurrentPlan(null)
          setSubscriptionStatus('none')
          setCancelAtPeriodEnd(false)
        } else {
          console.error('❌ Error fetching subscription:', error)
          throw error
        }
      } else if (subscription) {
        console.log('✅ Subscription found:', subscription)
        setCurrentPlan(subscription.plan_id)
        setSubscriptionStatus(subscription.status as 'active' | 'canceled' | 'none')
        setCancelAtPeriodEnd(subscription.cancel_at_period_end || false)
        console.log('📋 Subscription cancel_at_period_end:', subscription.cancel_at_period_end)
        
        // TODO: Fetch actual credits from credit_transactions table
        // For now, set a default
        setCurrentCredits(5000)
      } else {
        console.log('ℹ️ No subscription data returned')
        setCurrentPlan(null)
        setSubscriptionStatus('none')
        setCancelAtPeriodEnd(false)
      }
    } catch (error) {
      console.error('❌ Error loading subscription data:', error)
      toast({
        title: "Error",
        description: "Failed to load subscription data",
        variant: "destructive",
      })
      setCurrentPlan(null)
      setSubscriptionStatus('none')
      setCancelAtPeriodEnd(false)
    } finally {
      setLoading(false)
    }
  }

  const handleUpgrade = async (planId: string) => {
    setIsProcessing(true)
    try {
      // TODO: Create Stripe checkout session for upgrade
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          userId,
          action: 'upgrade',
        }),
      })

      if (!response.ok) throw new Error('Failed to create checkout session')

      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      console.error('Error upgrading plan:', error)
      toast({
        title: "Error",
        description: "Failed to start upgrade process",
        variant: "destructive",
      })
      setIsProcessing(false)
    }
  }

  const handleDowngrade = async (planId: string) => {
    setIsProcessing(true)
    try {
      // TODO: Create Stripe checkout session for downgrade
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          userId,
          action: 'downgrade',
        }),
      })

      if (!response.ok) throw new Error('Failed to create checkout session')

      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      console.error('Error downgrading plan:', error)
      toast({
        title: "Error",
        description: "Failed to start downgrade process",
        variant: "destructive",
      })
      setIsProcessing(false)
    }
  }

  const handleCancel = async () => {
    setIsProcessing(true)
    try {
      console.log('🔄 Canceling subscription for user:', userId)
      const response = await fetch('/api/stripe/cancel-subscription', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ userId }),
      })

      const data = await response.json()

      if (!response.ok) {
        console.error('❌ Cancel subscription failed:', data)
        throw new Error(data.error || 'Failed to cancel subscription')
      }

      console.log('✅ Subscription cancellation successful:', data)
      console.log('📋 Updated subscription from API:', data.subscription)
      
      // Update local state immediately
      if (data.subscription) {
        setCancelAtPeriodEnd(data.subscription.cancel_at_period_end || false)
        console.log('📋 Updated cancel_at_period_end state:', data.subscription.cancel_at_period_end)
      }
      
      toast({
        title: "Subscription Canceled",
        description: "Your subscription will remain active until the end of the billing period",
      })
      
      // Reload subscription data to reflect the cancellation
      await loadSubscriptionData()
      setShowCancelDialog(false)
    } catch (error) {
      console.error('❌ Error canceling subscription:', error)
      toast({
        title: "Error",
        description: error instanceof Error ? error.message : "Failed to cancel subscription",
        variant: "destructive",
      })
    } finally {
      setIsProcessing(false)
    }
  }

  const handleStart = async (planId: string) => {
    setIsProcessing(true)
    try {
      // TODO: Create Stripe checkout session for new subscription
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          planId,
          userId,
          action: 'subscribe',
        }),
      })

      if (!response.ok) throw new Error('Failed to create checkout session')

      const { url } = await response.json()
      window.location.href = url
    } catch (error) {
      console.error('Error starting subscription:', error)
      toast({
        title: "Error",
        description: "Failed to start subscription",
        variant: "destructive",
      })
      setIsProcessing(false)
    }
  }

  const handleBuyCredits = async (packageId?: string, customAmount?: number) => {
    if (!userId) {
      toast({
        title: "Error",
        description: "You must be logged in to purchase credits",
        variant: "destructive",
      })
      return
    }

    setIsProcessing(true)
    
    try {
      let credits = 0
      let amount = 0
      
      if (customAmount !== undefined) {
        // Custom amount purchase
        amount = customAmount
        credits = Math.floor(customAmount * CREDIT_RATE)
        
        if (amount < 1) {
          toast({
            title: "Invalid Amount",
            description: "Minimum purchase is $1",
            variant: "destructive",
          })
          setIsProcessing(false)
          return
        }
        
        if (amount > 10000) {
          toast({
            title: "Amount Too Large",
            description: "Maximum purchase is $10,000",
            variant: "destructive",
          })
          setIsProcessing(false)
          return
        }
      } else if (packageId) {
        // Package purchase
        const pkg = creditPackages.find(p => p.id === packageId)
        if (!pkg) {
          throw new Error('Invalid credit package')
        }
        amount = pkg.price
        credits = pkg.credits
        setSelectedCreditPackage(packageId)
      } else {
        throw new Error('No package or amount specified')
      }
      
      console.log('Starting credit purchase:', { packageId, customAmount, amount, credits, userId })
      
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          packageId: packageId || undefined,
          customAmount: customAmount || undefined,
          credits,
          userId,
          action: 'buy-credits',
        }),
      })

      const data = await response.json()
      
      if (!response.ok) {
        const errorMessage = data.error || 'Failed to create checkout session'
        console.error('API Error:', errorMessage, data)
        throw new Error(errorMessage)
      }

      if (!data.url) {
        console.error('No URL in response:', data)
        throw new Error('No checkout URL received from server')
      }

      console.log('Redirecting to checkout:', data.url)
      setShowBuyCreditsDialog(false)
      setCreditAmount('')
      setCustomCredits(0)
      window.location.href = data.url
    } catch (error) {
      console.error('Error purchasing credits:', error)
      const errorMessage = error instanceof Error ? error.message : 'Failed to start credit purchase'
      toast({
        title: "Error",
        description: errorMessage,
        variant: "destructive",
      })
      setIsProcessing(false)
      setSelectedCreditPackage(null)
    }
  }

  // Calculate credits when dollar amount changes
  useEffect(() => {
    if (creditAmount) {
      const amount = parseFloat(creditAmount)
      if (!isNaN(amount) && amount > 0) {
        setCustomCredits(Math.floor(amount * CREDIT_RATE))
      } else {
        setCustomCredits(0)
      }
    } else {
      setCustomCredits(0)
    }
  }, [creditAmount])

  if (!ready) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading...</p>
          </div>
        </main>
      </div>
    )
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-background">
        <Header />
        <main className="container mx-auto px-4 py-8 max-w-6xl">
          <div className="text-center">
            <Loader2 className="h-8 w-8 animate-spin mx-auto mb-4" />
            <p>Loading subscription data...</p>
          </div>
        </main>
      </div>
    )
  }

  const currentPlanData = plans.find(p => p.id === currentPlan)

  return (
    <div className="min-h-screen bg-background">
      <Header />
      
      <main className="container mx-auto px-4 py-8 max-w-6xl">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-3xl font-bold mb-2 bg-gradient-to-r from-blue-500 to-cyan-400 bg-clip-text text-transparent">
              Plans & Credits
            </h1>
            <p className="text-muted-foreground">Manage your subscription and purchase credits</p>
          </div>
          <Button variant="outline" asChild>
            <Link href="/settings">
              <X className="h-4 w-4 mr-2" />
              Back to Settings
            </Link>
          </Button>
        </div>

        {/* Credit Balance Card */}
        <Card className="mb-8 border-primary/30 bg-gradient-to-br from-primary/5 to-primary/10">
          <CardContent className="pt-6">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-16 h-16 rounded-full bg-gradient-to-br from-primary to-cyan-400 flex items-center justify-center">
                  <Zap className="h-8 w-8 text-white" />
                </div>
                <div>
                  <p className="text-sm text-muted-foreground mb-1">Current Credit Balance</p>
                  <p className="text-4xl font-bold bg-gradient-to-r from-primary to-cyan-400 bg-clip-text text-transparent">
                    {currentCredits.toLocaleString()}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">Studio Credits</p>
                </div>
              </div>
              <div className="flex items-center gap-3">
                <Button 
                  variant="outline"
                  onClick={() => setShowBuyCreditsDialog(true)}
                  className="border-primary/30 hover:bg-primary/10"
                >
                  <ShoppingCart className="h-4 w-4 mr-2" />
                  Add Credits
                </Button>
                <Button 
                  variant="ghost"
                  size="icon"
                  onClick={loadSubscriptionData}
                  disabled={loading}
                  title="Refresh balance"
                >
                  <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
                </Button>
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 mb-8">
          {/* Current Plan Card */}
          <Card className="lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <CreditCard className="h-5 w-5" />
                Current Plan
              </CardTitle>
              <CardDescription>Your active subscription details</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              {subscriptionStatus === 'none' ? (
                <div className="text-center py-8">
                  <p className="text-muted-foreground mb-4">You don't have an active subscription</p>
                  <Button onClick={() => setShowStartDialog(true)} className="gradient-button text-white">
                    <Play className="h-4 w-4 mr-2" />
                    Start Subscription
                  </Button>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-2xl font-bold">{currentPlanData?.name || 'No Plan'}</p>
                      <p className="text-muted-foreground">${currentPlanData?.price}/month</p>
                    </div>
                    <Badge variant={
                      cancelAtPeriodEnd 
                        ? 'secondary' 
                        : subscriptionStatus === 'active' 
                          ? 'default' 
                          : 'destructive'
                    }>
                      {cancelAtPeriodEnd 
                        ? 'Canceling' 
                        : subscriptionStatus === 'active' 
                          ? 'Active' 
                          : 'Canceled'}
                    </Badge>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4 pt-4 border-t">
                    <div>
                      <p className="text-sm text-muted-foreground">Monthly Credits</p>
                      <p className="text-lg font-semibold">{currentPlanData?.credits.toLocaleString() || 0}</p>
                    </div>
                    <div>
                      <p className="text-sm text-muted-foreground">Current Credits</p>
                      <p className="text-lg font-semibold flex items-center gap-1">
                        {currentCredits.toLocaleString()}
                        <RefreshCw className="h-4 w-4 text-muted-foreground" />
                      </p>
                    </div>
                  </div>

                  {cancelAtPeriodEnd && (
                    <div className="mt-4 p-3 bg-yellow-50 dark:bg-yellow-900/20 border border-yellow-200 dark:border-yellow-800 rounded-md">
                      <p className="text-sm text-yellow-800 dark:text-yellow-200">
                        ⚠️ Your subscription is scheduled to cancel at the end of the billing period.
                      </p>
                    </div>
                  )}
                  
                  <div className="flex gap-2 pt-4">
                    {subscriptionStatus === 'active' && !cancelAtPeriodEnd && (
                      <>
                        <Button 
                          variant="outline" 
                          onClick={() => setShowUpgradeDialog(true)}
                          className="flex-1"
                        >
                          <ArrowUp className="h-4 w-4 mr-2" />
                          Upgrade
                        </Button>
                        <Button 
                          variant="outline" 
                          onClick={() => setShowDowngradeDialog(true)}
                          className="flex-1"
                        >
                          <ArrowDown className="h-4 w-4 mr-2" />
                          Downgrade
                        </Button>
                        <Button 
                          variant="destructive" 
                          onClick={() => setShowCancelDialog(true)}
                        >
                          <X className="h-4 w-4 mr-2" />
                          Cancel
                        </Button>
                      </>
                    )}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* Quick Actions Card */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Zap className="h-5 w-5" />
                Quick Actions
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button 
                className="w-full gradient-button text-white" 
                onClick={() => setShowBuyCreditsDialog(true)}
              >
                <ShoppingCart className="h-4 w-4 mr-2" />
                Buy Credits
              </Button>
              <Button 
                variant="outline" 
                className="w-full" 
                asChild
              >
                <Link href="/subscriptions">
                  View All Plans
                </Link>
              </Button>
              <div className="pt-4 border-t">
                <p className="text-xs text-muted-foreground mb-2">
                  <Infinity className="h-3 w-3 inline mr-1" />
                  You can reload credits on any plan for unlimited usage
                </p>
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Saved Payment Methods */}
        {savedPaymentMethods.length > 0 && (
          <Card className="mb-8">
            <CardHeader>
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="flex items-center gap-2">
                    <Wallet className="h-5 w-5" />
                    Saved Payment Methods
                  </CardTitle>
                  <CardDescription>Quick buy with saved payment methods</CardDescription>
                </div>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setShowPaymentMethods(!showPaymentMethods)}
                >
                  {showPaymentMethods ? 'Hide' : 'Show'} Methods
                </Button>
              </div>
            </CardHeader>
            {showPaymentMethods && (
              <CardContent>
                <div className="space-y-4">
                  {savedPaymentMethods.map((pm) => (
                    <div
                      key={pm.id}
                      className="flex items-center justify-between p-4 border rounded-lg"
                    >
                      <div className="flex items-center gap-3">
                        <CreditCard className="h-5 w-5 text-muted-foreground" />
                        <div>
                          <p className="font-medium">
                            {pm.card?.brand?.toUpperCase()} •••• {pm.card?.last4}
                          </p>
                          <p className="text-sm text-muted-foreground">
                            Expires {pm.card?.exp_month}/{pm.card?.exp_year}
                          </p>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        {/* Quick Buy Buttons */}
                        <div className="flex gap-1">
                          {[10, 25, 50, 100].map((amount) => (
                            <Button
                              key={amount}
                              size="sm"
                              variant="outline"
                              onClick={() => handleQuickBuy(amount, pm.id)}
                              disabled={isProcessing}
                              className="text-xs"
                            >
                              ${amount}
                            </Button>
                          ))}
                        </div>
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => handleDeletePaymentMethod(pm.id)}
                          className="text-destructive hover:text-destructive"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            )}
          </Card>
        )}

        {/* Add Payment Method Card */}
        <Card className="mb-8">
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              <Wallet className="h-5 w-5" />
              Save Payment Method
            </CardTitle>
            <CardDescription>
              Save your payment method for quick purchases
            </CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-4">
              <p className="text-sm text-muted-foreground">
                Save your payment method to enable quick buy buttons. Your card will be securely stored by Stripe.
              </p>
              <Button
                variant="outline"
                onClick={handleAddPaymentMethod}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <Plus className="h-4 w-4 mr-2" />
                    Add Payment Method
                  </>
                )}
              </Button>
            </div>
          </CardContent>
        </Card>

        {/* Credit Packages - Quick Options */}
        <Card id="credit-packages">
          <CardHeader>
            <CardTitle>Quick Credit Packages</CardTitle>
            <CardDescription>Or use the Buy Credits button above to enter a custom amount</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              {creditPackages.map((pkg) => (
                <Card key={pkg.id} className="hover:border-primary transition-colors">
                  <CardHeader>
                    <CardTitle className="text-lg">{pkg.name}</CardTitle>
                    <CardDescription>{pkg.credits.toLocaleString()} Credits</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <div className="mb-4">
                      <p className="text-2xl font-bold">${pkg.price}</p>
                    </div>
                    <Button 
                      className="w-full" 
                      variant="outline"
                      onClick={() => handleBuyCredits(pkg.id)}
                      disabled={isProcessing}
                    >
                      {isProcessing && selectedCreditPackage === pkg.id ? (
                        <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                      ) : (
                        <ShoppingCart className="h-4 w-4 mr-2" />
                      )}
                      Purchase
                    </Button>
                  </CardContent>
                </Card>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Buy Credits Dialog */}
        <Dialog open={showBuyCreditsDialog} onOpenChange={setShowBuyCreditsDialog}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>Buy Credits</DialogTitle>
              <DialogDescription>
                Enter the dollar amount you want to spend. Credits are calculated at $1 = {CREDIT_RATE.toLocaleString()} credits.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-4 py-4">
              <div>
                <Label htmlFor="credit-amount">Amount (USD)</Label>
                <div className="relative mt-2">
                  <span className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground">$</span>
                  <Input
                    id="credit-amount"
                    type="number"
                    min="1"
                    max="10000"
                    step="0.01"
                    value={creditAmount}
                    onChange={(e) => setCreditAmount(e.target.value)}
                    placeholder="0.00"
                    className="pl-8"
                    disabled={isProcessing}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  Minimum: $1 • Maximum: $10,000
                </p>
              </div>
              
              {customCredits > 0 && (
                <div className="p-4 bg-muted rounded-lg">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="text-sm text-muted-foreground">You'll receive</p>
                      <p className="text-2xl font-bold">{customCredits.toLocaleString()} Credits</p>
                    </div>
                    <Zap className="h-8 w-8 text-primary" />
                  </div>
                </div>
              )}

              <div className="text-xs text-muted-foreground space-y-1">
                <p>• Credits are added instantly after payment</p>
                <p>• Credits never expire</p>
                <p>• Use credits with any plan</p>
              </div>
            </div>
            <DialogFooter>
              <Button 
                variant="outline" 
                onClick={() => {
                  setShowBuyCreditsDialog(false)
                  setCreditAmount('')
                  setCustomCredits(0)
                }}
                disabled={isProcessing}
              >
                Cancel
              </Button>
              <Button 
                className="gradient-button text-white"
                onClick={() => {
                  const amount = parseFloat(creditAmount)
                  if (isNaN(amount) || amount < 1) {
                    toast({
                      title: "Invalid Amount",
                      description: "Please enter an amount between $1 and $10,000",
                      variant: "destructive",
                    })
                    return
                  }
                  handleBuyCredits(undefined, amount)
                }}
                disabled={isProcessing || !creditAmount || parseFloat(creditAmount) < 1}
              >
                {isProcessing ? (
                  <>
                    <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                    Processing...
                  </>
                ) : (
                  <>
                    <ShoppingCart className="h-4 w-4 mr-2" />
                    Purchase {customCredits > 0 ? `${customCredits.toLocaleString()} Credits` : 'Credits'}
                  </>
                )}
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Upgrade Dialog */}
        <Dialog open={showUpgradeDialog} onOpenChange={setShowUpgradeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Upgrade Plan</DialogTitle>
              <DialogDescription>
                Choose a plan to upgrade to. You'll be charged the prorated difference.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {plans
                .filter(p => {
                  if (!currentPlanData) return true
                  const currentIndex = plans.findIndex(pl => pl.id === currentPlan)
                  const planIndex = plans.findIndex(pl => pl.id === p.id)
                  return planIndex > currentIndex
                })
                .map((plan) => (
                  <Button
                    key={plan.id}
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => {
                      setSelectedPlan(plan.id)
                      handleUpgrade(plan.id)
                    }}
                    disabled={isProcessing}
                  >
                    <div className="text-left">
                      <p className="font-semibold">{plan.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ${plan.price}/month • {plan.credits.toLocaleString()} credits
                      </p>
                    </div>
                    {isProcessing && selectedPlan === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowUp className="h-4 w-4" />
                    )}
                  </Button>
                ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowUpgradeDialog(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Downgrade Dialog */}
        <Dialog open={showDowngradeDialog} onOpenChange={setShowDowngradeDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Downgrade Plan</DialogTitle>
              <DialogDescription>
                Choose a plan to downgrade to. Changes take effect at the end of your billing period.
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {plans
                .filter(p => {
                  if (!currentPlanData) return false
                  const currentIndex = plans.findIndex(pl => pl.id === currentPlan)
                  const planIndex = plans.findIndex(pl => pl.id === p.id)
                  return planIndex < currentIndex
                })
                .map((plan) => (
                  <Button
                    key={plan.id}
                    variant="outline"
                    className="w-full justify-between"
                    onClick={() => {
                      setSelectedPlan(plan.id)
                      handleDowngrade(plan.id)
                    }}
                    disabled={isProcessing}
                  >
                    <div className="text-left">
                      <p className="font-semibold">{plan.name}</p>
                      <p className="text-sm text-muted-foreground">
                        ${plan.price}/month • {plan.credits.toLocaleString()} credits
                      </p>
                    </div>
                    {isProcessing && selectedPlan === plan.id ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <ArrowDown className="h-4 w-4" />
                    )}
                  </Button>
                ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowDowngradeDialog(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Cancel Dialog */}
        <Dialog open={showCancelDialog} onOpenChange={setShowCancelDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Cancel Subscription</DialogTitle>
              <DialogDescription>
                Are you sure you want to cancel your subscription? You'll retain access until the end of your billing period.
              </DialogDescription>
            </DialogHeader>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowCancelDialog(false)}>
                Keep Subscription
              </Button>
              <Button 
                variant="destructive" 
                onClick={handleCancel}
                disabled={isProcessing}
              >
                {isProcessing ? (
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                ) : (
                  <X className="h-4 w-4 mr-2" />
                )}
                Cancel Subscription
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* Start Subscription Dialog */}
        <Dialog open={showStartDialog} onOpenChange={setShowStartDialog}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>Start Subscription</DialogTitle>
              <DialogDescription>
                Choose a plan to subscribe to
              </DialogDescription>
            </DialogHeader>
            <div className="space-y-2">
              {plans.map((plan) => (
                <Button
                  key={plan.id}
                  variant="outline"
                  className="w-full justify-between"
                  onClick={() => {
                    setSelectedPlan(plan.id)
                    handleStart(plan.id)
                  }}
                  disabled={isProcessing}
                >
                  <div className="text-left">
                    <p className="font-semibold">{plan.name}</p>
                    <p className="text-sm text-muted-foreground">
                      ${plan.price}/month • {plan.credits.toLocaleString()} credits
                    </p>
                  </div>
                  {isProcessing && selectedPlan === plan.id ? (
                    <Loader2 className="h-4 w-4 animate-spin" />
                  ) : (
                    <Play className="h-4 w-4" />
                  )}
                </Button>
              ))}
            </div>
            <DialogFooter>
              <Button variant="outline" onClick={() => setShowStartDialog(false)}>
                Cancel
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </main>
    </div>
  )
}


