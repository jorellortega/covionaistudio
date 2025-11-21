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

    const { planId, packageId, userId, userEmail, action, customAmount, credits } = await request.json()

    console.log('Create checkout request:', { planId, packageId, userId, userEmail, action, customAmount, credits })

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
      // TODO: Get customer from database
      // For now, create a new customer (you should store this in your database)
      const stripe = getStripe()
      const customer = await stripe.customers.create({
        metadata: { userId },
      })
      customerId = customer.id

      const session = await stripe.checkout.sessions.create({
        mode: 'payment',
        payment_method_types: ['card'],
        customer: customerId,
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
        success_url: `${baseUrl}/settings/plans-credits?success=true&type=credits&customerId=${customerId}`,
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
      const plan = plans[planId as keyof typeof plans]
      if (!plan) {
        return NextResponse.json(
          { error: 'Invalid plan' },
          { status: 400 }
        )
      }

      // Create checkout session for subscription
      const stripe = getStripe()
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
        success_url: `${baseUrl}/settings/plans-credits?success=true&type=subscription`,
        cancel_url: `${baseUrl}/settings/plans-credits?canceled=true`,
        metadata: {
          userId,
          type: action || 'subscribe',
          planId,
        },
        subscription_data: {
          metadata: {
            userId,
            planId,
          },
        },
      })

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

