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

    const { userId, paymentMethodId } = await request.json()

    if (!userId || !paymentMethodId) {
      return NextResponse.json(
        { error: 'User ID and Payment Method ID are required' },
        { status: 400 }
      )
    }

    // TODO: Get or create Stripe customer for this user
    // For now, we'll create a customer if they don't have one
    // In production, you should store the customer ID in your database
    let customerId: string

    // Check if user already has a customer ID in database
    // const customer = await getCustomerByUserId(userId)
    // if (customer?.stripeCustomerId) {
    //   customerId = customer.stripeCustomerId
    // } else {
    //   // Create new customer
    //   const newCustomer = await stripe.customers.create({
    //     metadata: { userId },
    //   })
    //   customerId = newCustomer.id
    //   // Save to database
    //   await saveCustomerId(userId, customerId)
    // }

    // For now, create a customer each time (you should implement the above)
    const stripe = getStripe()
    const customer = await stripe.customers.create({
      metadata: { userId },
    })
      customerId = customer.id

    // Attach payment method to customer
    await stripe.paymentMethods.attach(paymentMethodId, {
      customer: customerId,
    })

    // Set as default payment method
    await stripe.customers.update(customerId, {
      invoice_settings: {
        default_payment_method: paymentMethodId,
      },
    })

    return NextResponse.json({
      success: true,
      customerId,
      message: 'Payment method saved successfully',
    })
  } catch (error) {
    console.error('Error saving payment method:', error)
    const errorMessage = error instanceof Error ? error.message : 'Failed to save payment method'
    return NextResponse.json(
      { error: errorMessage },
      { status: 500 }
    )
  }
}

