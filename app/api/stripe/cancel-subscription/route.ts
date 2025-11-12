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
    const { userId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // TODO: Get customer ID from your database using userId
    // For now, this is a placeholder
    // const customer = await getCustomerByUserId(userId)
    // if (!customer || !customer.stripeCustomerId) {
    //   return NextResponse.json(
    //     { error: 'No subscription found' },
    //     { status: 404 }
    //   )
    // }

    // Get active subscriptions for the customer
    // const subscriptions = await stripe.subscriptions.list({
    //   customer: customer.stripeCustomerId,
    //   status: 'active',
    // })

    // if (subscriptions.data.length === 0) {
    //   return NextResponse.json(
    //     { error: 'No active subscription found' },
    //     { status: 404 }
    //   )

    // Cancel the subscription at period end
    // const subscription = subscriptions.data[0]
    // const canceledSubscription = await stripe.subscriptions.update(
    //   subscription.id,
    //   {
    //     cancel_at_period_end: true,
    //   }
    // )

    // TODO: Update your database to reflect the cancellation
    // await updateSubscriptionStatus(userId, 'canceled')

    // For now, return success (you'll need to implement the actual logic)
    return NextResponse.json({ 
      success: true,
      message: 'Subscription will be canceled at the end of the billing period'
    })
  } catch (error) {
    console.error('Error canceling subscription:', error)
    return NextResponse.json(
      { error: 'Failed to cancel subscription' },
      { status: 500 }
    )
  }
}

