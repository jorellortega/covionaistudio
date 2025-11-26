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

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const sessionId = searchParams.get('sessionId')

    if (!sessionId) {
      return NextResponse.json(
        { error: 'Session ID is required' },
        { status: 400 }
      )
    }

    console.log('🔧 GET-SESSION: Fetching checkout session:', sessionId)
    const stripe = getStripe()
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['subscription', 'customer'],
    })

    console.log('✅ GET-SESSION: Session retrieved')
    console.log('📋 GET-SESSION: Session ID:', session.id)
    console.log('📋 GET-SESSION: Subscription ID:', session.subscription)
    console.log('📋 GET-SESSION: Customer ID:', session.customer)
    console.log('📋 GET-SESSION: Payment Intent ID:', session.payment_intent)
    console.log('📋 GET-SESSION: Session metadata:', JSON.stringify(session.metadata, null, 2))

    return NextResponse.json({
      sessionId: session.id,
      subscriptionId: typeof session.subscription === 'string' ? session.subscription : session.subscription?.id,
      customerId: typeof session.customer === 'string' ? session.customer : session.customer?.id,
      paymentIntentId: typeof session.payment_intent === 'string' ? session.payment_intent : session.payment_intent?.id,
      metadata: session.metadata,
      status: session.status,
    })
  } catch (error) {
    console.error('❌ GET-SESSION: Error fetching session:', error)
    return NextResponse.json(
      {
        error: 'Failed to fetch session',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

