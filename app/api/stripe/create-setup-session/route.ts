import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-12-18.acacia',
  })
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      )
    }

    const { userId, customerId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    // Get or create customer
    let stripeCustomerId = customerId

    const stripe = getStripe()
    if (!stripeCustomerId) {
      // Create new customer
      const customer = await stripe.customers.create({
        metadata: { userId },
      })
      stripeCustomerId = customer.id
    }

    // Create checkout session in setup mode
    const session = await stripe.checkout.sessions.create({
      mode: 'setup',
      payment_method_types: ['card'],
      customer: stripeCustomerId,
      success_url: `${baseUrl}/settings/plans-credits?setup_success=true&customerId=${stripeCustomerId}&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${baseUrl}/settings/plans-credits?setup_canceled=true`,
      metadata: {
        userId,
        type: 'setup',
        customerId: stripeCustomerId,
      },
    })

    return NextResponse.json({ 
      url: session.url,
      customerId: stripeCustomerId,
    })
  } catch (error) {
    console.error('Error creating setup session:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create setup session'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

