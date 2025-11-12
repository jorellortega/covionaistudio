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

    const { paymentMethodId } = await request.json()

    if (!paymentMethodId) {
      return NextResponse.json(
        { error: 'Payment Method ID is required' },
        { status: 400 }
      )
    }

    // Detach payment method from customer
    const stripe = getStripe()
    await stripe.paymentMethods.detach(paymentMethodId)

    return NextResponse.json({
      success: true,
      message: 'Payment method removed successfully',
    })
  } catch (error) {
    console.error('Error deleting payment method:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to delete payment method'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

