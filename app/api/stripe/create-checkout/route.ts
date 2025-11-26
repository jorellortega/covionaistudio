import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-10-29.clover',
  })
}

const plans = {
  creator: { priceId: process.env.STRIPE_PRICE_CREATOR!, name: 'Creator', amount: 4500 },
  studio: { priceId: process.env.STRIPE_PRICE_STUDIO!, name: 'Studio', amount: 15000 },
  production: { priceId: process.env.STRIPE_PRICE_PRODUCTION!, name: 'Production House', amount: 50000 },
}

const creditPackages = {
  pack1: { name: 'Starter Pack', credits: 5000, amount: 1000 },
  pack2: { name: 'Creator Pack', credits: 15000, amount: 2500 },
  pack3: { name: 'Studio Pack', credits: 50000, amount: 7500 },
  pack4: { name: 'Production Pack', credits: 150000, amount: 20000 },
}

export async function POST(request: NextRequest) {
  try {
    // Check if Stripe is configured
    if (!process.env.STRIPE_SECRET_KEY) {
      console.error('STRIPE_SECRET_KEY is not set')
      return NextResponse.json(
        { error: 'Stripe is not configured. Please set STRIPE_SECRET_KEY in your environment variables.' },
        { status: 500 }
      )
    }

    console.log('🔧 CHECKOUT: ========== CREATE CHECKOUT REQUEST ==========')
    console.log('🔧 CHECKOUT: Timestamp:', new Date().toISOString())
    
    const { planId, packageId, userId, userEmail, action, customAmount, credits } = await request.json()

    console.log('📋 CHECKOUT: Request payload:', { planId, packageId, userId, userEmail, action, customAmount, credits })

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    if (action === 'buy-credits') {
      let credits = 0
      let amount = 0
      let productName = 'Studio Credits'
      
      if (packageId) {
        // Package purchase
        const creditPackage = creditPackages[packageId as keyof typeof creditPackages]
        if (!creditPackage) {
          return NextResponse.json(
            { error: 'Invalid credit package' },
            { status: 400 }
          )
        }
        credits = creditPackage.credits
        amount = creditPackage.amount
        productName = creditPackage.name
      } else if (customAmount !== undefined) {
        // Custom amount purchase
        const customAmt = parseFloat(customAmount.toString())
        if (isNaN(customAmt) || customAmt < 1 || customAmt > 10000) {
          return NextResponse.json(
            { error: 'Invalid amount. Must be between $1 and $10,000' },
            { status: 400 }
          )
        }
        amount = Math.round(customAmt * 100) // Convert to cents
        // Use credits from request if provided, otherwise calculate (default: $1 = 500 credits)
        credits = credits ? parseInt(credits.toString()) : Math.floor(customAmt * 500)
        productName = `${credits.toLocaleString()} Studio Credits`
      } else {
        return NextResponse.json(
          { error: 'Package ID or custom amount is required' },
          { status: 400 }
        )
      }

      // Get or create customer
      let customerId: string
      const stripe = getStripe()
      
      // Try to get customer ID from database first
      const { createClient } = await import('@supabase/supabase-js')
      const supabase = createClient(
        process.env.NEXT_PUBLIC_SUPABASE_URL!,
        process.env.SUPABASE_SERVICE_ROLE_KEY!
      )
      
      const { data: userData } = await supabase
        .from('users')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single()
      
      if (userData?.stripe_customer_id) {
        console.log('📋 CHECKOUT: Using existing customer ID:', userData.stripe_customer_id)
        customerId = userData.stripe_customer_id
      } else {
        // Create new customer
        console.log('📋 CHECKOUT: Creating new customer...')
        const customer = await stripe.customers.create({
          email: userEmail || undefined, // Set email on customer
          metadata: { userId },
        })
        customerId = customer.id
        
        // Save customer ID to database
        console.log('📋 CHECKOUT: Saving customer ID to database...')
        await supabase
          .from('users')
          .update({ stripe_customer_id: customerId })
          .eq('id', userId)
        console.log('✅ CHECKOUT: Customer ID saved to database')
      }

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer: customerId, // Don't use customer_email when customer is specified
        line_items: [
          {
            price_data: {
              currency: 'usd',
              product_data: {
                name: productName,
                description: `${credits.toLocaleString()} Studio Credits`,
              },
              unit_amount: amount,
            },
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/settings/plans-credits?success=true&type=credits&customerId=${customerId}&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/settings/plans-credits?canceled=true`,
        payment_intent_data: {
          setup_future_usage: 'off_session', // Save payment method for future use
        },
        metadata: {
          userId,
          type: 'credits',
          packageId: packageId || 'custom',
          credits: credits.toString(),
          amount: amount.toString(),
          customerId,
        },
      })

      return NextResponse.json({ url: session.url })
    }

    if (planId) {
      console.log('🔧 CHECKOUT: Creating subscription checkout session...')
      console.log('📋 CHECKOUT: Plan ID:', planId)
      console.log('📋 CHECKOUT: User ID:', userId)
      console.log('📋 CHECKOUT: User Email:', userEmail)
      
      const plan = plans[planId as keyof typeof plans]
      if (!plan) {
        console.error('❌ CHECKOUT: Invalid plan ID:', planId)
        return NextResponse.json(
          { error: 'Invalid plan' },
          { status: 400 }
        )
      }
      
      console.log('📋 CHECKOUT: Plan details:', {
        name: plan.name,
        priceId: plan.priceId,
        amount: plan.amount,
      })
      
      console.log('📋 CHECKOUT: Environment variables check:')
      console.log('  - STRIPE_PRICE_CREATOR:', process.env.STRIPE_PRICE_CREATOR ? `✅ ${process.env.STRIPE_PRICE_CREATOR.substring(0, 20)}...` : '❌ Missing')
      console.log('  - STRIPE_PRICE_STUDIO:', process.env.STRIPE_PRICE_STUDIO ? `✅ ${process.env.STRIPE_PRICE_STUDIO.substring(0, 20)}...` : '❌ Missing')
      console.log('  - STRIPE_PRICE_PRODUCTION:', process.env.STRIPE_PRICE_PRODUCTION ? `✅ ${process.env.STRIPE_PRICE_PRODUCTION.substring(0, 20)}...` : '❌ Missing')
      console.log('  - Plan priceId matches env:', plan.priceId === process.env[`STRIPE_PRICE_${planId.toUpperCase()}`] ? '✅ Yes' : '❌ No')

      // Create checkout session for subscription
      const stripe = getStripe()
      
      const checkoutMetadata = {
        userId,
        type: action || 'subscribe',
        planId,
      }
      
      const subscriptionMetadata = {
        userId,
        planId,
      }
      
      console.log('📋 CHECKOUT: Checkout session metadata:', JSON.stringify(checkoutMetadata, null, 2))
      console.log('📋 CHECKOUT: Subscription metadata:', JSON.stringify(subscriptionMetadata, null, 2))
      console.log('📋 CHECKOUT: Base URL:', baseUrl)
      
      console.log('🔧 CHECKOUT: Creating Stripe checkout session...')
      const session = await stripe.checkout.sessions.create({
        mode: 'subscription',
        payment_method_types: ['card'],
        customer_email: userEmail || undefined, // Pre-fill email if provided
        line_items: [
          {
            price: plan.priceId,
            quantity: 1,
          },
        ],
        success_url: `${baseUrl}/settings/plans-credits?success=true&type=subscription&session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${baseUrl}/settings/plans-credits?canceled=true`,
        metadata: checkoutMetadata,
        subscription_data: {
          metadata: subscriptionMetadata,
        },
      })
      
      console.log('✅ CHECKOUT: Checkout session created successfully!')
      console.log('📋 CHECKOUT: Session ID:', session.id)
      console.log('📋 CHECKOUT: Session URL:', session.url)
      console.log('📋 CHECKOUT: Session metadata:', JSON.stringify(session.metadata, null, 2))
      console.log('📋 CHECKOUT: Customer email:', session.customer_email)
      console.log('📋 CHECKOUT: Customer ID:', session.customer)
      console.log('📋 CHECKOUT: Subscription ID (if exists):', (session as any).subscription)
      console.log('🔧 CHECKOUT: ========== CHECKOUT COMPLETE ==========')

      return NextResponse.json({ url: session.url })
    }

    return NextResponse.json(
      { error: 'Plan ID or Package ID is required' },
      { status: 400 }
    )
  } catch (error) {
    console.error('Error creating checkout session:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create checkout session'
    return NextResponse.json(
      { 
        error: errorMessage,
        details: error instanceof Error ? error.stack : undefined
      },
      { status: 500 }
    )
  }
}

