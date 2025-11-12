import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY!, {
  apiVersion: '2024-12-18.acacia',
})

const CREDIT_RATE = 500 // $1 = 500 credits

export async function POST(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      )
    }

    const { userId, customerId, paymentMethodId, amount, credits } = await request.json()

    if (!userId || !customerId || !paymentMethodId || !amount || !credits) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      )
    }

    const amountInCents = Math.round(parseFloat(amount) * 100)

    // Create payment intent
    const paymentIntent = await stripe.paymentIntents.create({
      amount: amountInCents,
      currency: 'usd',
      customer: customerId,
      payment_method: paymentMethodId,
      confirm: true,
      return_url: `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/settings/plans-credits?success=true&type=credits`,
      metadata: {
        userId,
        type: 'credits',
        credits: credits.toString(),
        amount: amount.toString(),
        quickBuy: 'true',
      },
    })

    if (paymentIntent.status === 'succeeded') {
      // TODO: Add credits to user account in database
      // await addCreditsToUser(userId, parseInt(credits))

      return NextResponse.json({
        success: true,
        paymentIntentId: paymentIntent.id,
        message: 'Payment successful',
      })
    } else {
      return NextResponse.json(
        { error: 'Payment failed', status: paymentIntent.status },
        { status: 400 }
      )
    }
  } catch (error) {
    console.error('Error processing quick buy:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to process payment'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

