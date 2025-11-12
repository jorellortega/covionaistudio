import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

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

    // TODO: Get customer ID from database
    // const customer = await getCustomerByUserId(userId)
    // if (!customer?.stripeCustomerId) {
    //   return NextResponse.json({ paymentMethods: [] })
    // }

    // For now, use provided customerId or return empty
    if (!customerId) {
      return NextResponse.json({ paymentMethods: [] })
    }

    // List payment methods for customer
    const paymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    })

    return NextResponse.json({
      paymentMethods: paymentMethods.data.map((pm) => ({
        id: pm.id,
        type: pm.type,
        card: pm.card
          ? {
              brand: pm.card.brand,
              last4: pm.card.last4,
              exp_month: pm.card.exp_month,
              exp_year: pm.card.exp_year,
            }
          : null,
        created: pm.created,
      })),
    })
  } catch (error) {
    console.error('Error listing payment methods:', error)
    return NextResponse.json(
      { error: 'Failed to list payment methods' },
      { status: 500 }
    )
  }
}

