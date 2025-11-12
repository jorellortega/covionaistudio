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

    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // TODO: Get or create Stripe customer for this user
    // For now, create a customer
    const stripe = getStripe()
    const customer = await stripe.customers.create({
      metadata: { userId },
    })

    // Create setup intent for saving payment method
    const setupIntent = await stripe.setupIntents.create({
      customer: customer.id,
      payment_method_types: ['card'],
      metadata: {
        userId,
      },
    })

    return NextResponse.json({
      clientSecret: setupIntent.client_secret,
      customerId: customer.id,
    })
  } catch (error) {
    console.error('Error creating setup intent:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to create setup intent'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

