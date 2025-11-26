import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2025-10-29.clover',
  })
}

function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase credentials not set')
  }
  
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

export async function POST(request: NextRequest) {
  try {
    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: 'Stripe is not configured' },
        { status: 500 }
      )
    }

    const { userId, customerId: providedCustomerId } = await request.json()

    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    // Get customer ID from database if not provided
    let customerId = providedCustomerId
    if (!customerId) {
      console.log('📋 LIST-PM: Getting customer ID from database for user:', userId)
      const supabase = getSupabaseAdmin()
      const { data: userData, error: userError } = await supabase
        .from('users')
        .select('stripe_customer_id')
        .eq('id', userId)
        .single()
      
      if (userError) {
        console.error('❌ LIST-PM: Error fetching user:', userError)
        return NextResponse.json({ paymentMethods: [] })
      }
      
      customerId = userData?.stripe_customer_id
      console.log('📋 LIST-PM: Found customer ID:', customerId)
    }

    // If still no customer ID, return empty
    if (!customerId) {
      console.log('📋 LIST-PM: No customer ID found, returning empty list')
      return NextResponse.json({ paymentMethods: [] })
    }

    // List payment methods for customer from Stripe
    const stripe = getStripe()
    const stripePaymentMethods = await stripe.paymentMethods.list({
      customer: customerId,
      type: 'card',
    })

    // Get payment methods from database to get is_default status
    const supabase = getSupabaseAdmin()
    const { data: dbPaymentMethods } = await supabase
      .from('payment_methods')
      .select('stripe_payment_method_id, is_default')
      .eq('user_id', userId)
      .in('stripe_payment_method_id', stripePaymentMethods.data.map(pm => pm.id))

    // Create a map of payment method ID to is_default
    const defaultMap = new Map<string, boolean>()
    dbPaymentMethods?.forEach(pm => {
      defaultMap.set(pm.stripe_payment_method_id, pm.is_default)
    })

    // Combine Stripe data with database is_default status
    const paymentMethods = stripePaymentMethods.data.map((pm) => ({
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
      is_default: defaultMap.get(pm.id) || false,
    }))

    return NextResponse.json({
      paymentMethods,
    })
  } catch (error) {
    console.error('Error listing payment methods:', error)
    return NextResponse.json(
      { error: 'Failed to list payment methods' },
      { status: 500 }
    )
  }
}

