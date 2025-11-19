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

export async function GET(request: NextRequest) {
  try {
    const stripe = getStripe()
    const { searchParams } = new URL(request.url)
    const customerEmail = searchParams.get('email') || 'vidaxci@gmail.com'

    // Find customer by email
    const customers = await stripe.customers.list({
      email: customerEmail,
      limit: 1,
    })

    if (customers.data.length === 0) {
      return NextResponse.json({
        error: 'Customer not found',
        email: customerEmail,
      })
    }

    const customer = customers.data[0]

    // Get subscriptions for this customer
    const subscriptions = await stripe.subscriptions.list({
      customer: customer.id,
      limit: 10,
    })

    return NextResponse.json({
      customer: {
        id: customer.id,
        email: customer.email,
      },
      subscriptions: subscriptions.data.map(sub => ({
        id: sub.id,
        status: sub.status,
        plan: sub.items.data[0]?.price?.nickname || sub.items.data[0]?.price?.id,
        priceId: sub.items.data[0]?.price?.id,
        metadata: sub.metadata,
        current_period_end: new Date(sub.current_period_end * 1000).toISOString(),
      })),
    })
  } catch (error) {
    console.error('Error listing subscriptions:', error)
    return NextResponse.json(
      {
        error: 'Failed to list subscriptions',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

