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
    console.log('🔧 SAVE-PM: Starting payment method save...')
    const { sessionId, userId, customerId } = await request.json()
    
    console.log('📋 SAVE-PM: Request data:', { sessionId, userId, customerId })
    
    if (!sessionId || !userId) {
      return NextResponse.json(
        { error: 'Session ID and User ID are required' },
        { status: 400 }
      )
    }
    
    const stripe = getStripe()
    const supabase = getSupabaseAdmin()
    
    // Retrieve the setup session to get the payment method
    console.log('📋 SAVE-PM: Retrieving setup session:', sessionId)
    const session = await stripe.checkout.sessions.retrieve(sessionId, {
      expand: ['setup_intent.payment_method'],
    })
    
    console.log('📋 SAVE-PM: Session retrieved, mode:', session.mode)
    
    if (session.mode !== 'setup') {
      return NextResponse.json(
        { error: 'Session is not a setup session' },
        { status: 400 }
      )
    }
    
    // Get the setup intent and payment method
    const setupIntentId = typeof session.setup_intent === 'string' 
      ? session.setup_intent 
      : session.setup_intent?.id
    
    if (!setupIntentId) {
      return NextResponse.json(
        { error: 'No setup intent found in session' },
        { status: 400 }
      )
    }
    
    console.log('📋 SAVE-PM: Setup intent ID:', setupIntentId)
    
    // Retrieve the setup intent with payment method
    const setupIntent = await stripe.setupIntents.retrieve(setupIntentId, {
      expand: ['payment_method'],
    })
    
    const paymentMethodId = typeof setupIntent.payment_method === 'string'
      ? setupIntent.payment_method
      : setupIntent.payment_method?.id
    
    if (!paymentMethodId) {
      return NextResponse.json(
        { error: 'No payment method found in setup intent' },
        { status: 400 }
      )
    }
    
    console.log('📋 SAVE-PM: Payment method ID:', paymentMethodId)
    
    // Retrieve the payment method to get card details
    const paymentMethod = await stripe.paymentMethods.retrieve(paymentMethodId)
    
    if (paymentMethod.type !== 'card' || !paymentMethod.card) {
      return NextResponse.json(
        { error: 'Only card payment methods are supported' },
        { status: 400 }
      )
    }
    
    const card = paymentMethod.card
    const finalCustomerId = customerId || session.customer as string
    
    console.log('📋 SAVE-PM: Card details:', {
      brand: card.brand,
      last4: card.last4,
      exp_month: card.exp_month,
      exp_year: card.exp_year,
    })
    
    // Save customer ID to user record if not already set
    if (finalCustomerId) {
      console.log('📋 SAVE-PM: Saving customer ID to user record...')
      const { error: updateError } = await supabase
        .from('users')
        .update({ stripe_customer_id: finalCustomerId })
        .eq('id', userId)
      
      if (updateError) {
        console.error('❌ SAVE-PM: Error updating customer ID:', updateError)
      } else {
        console.log('✅ SAVE-PM: Customer ID saved to user record')
      }
    }
    
    // Check if payment method already exists in database
    const { data: existingPM } = await supabase
      .from('payment_methods')
      .select('id')
      .eq('stripe_payment_method_id', paymentMethodId)
      .maybeSingle()
    
    if (existingPM) {
      console.log('📋 SAVE-PM: Payment method already exists, updating...')
      // Update existing payment method
      const { data, error } = await supabase
        .from('payment_methods')
        .update({
          stripe_customer_id: finalCustomerId,
          card_brand: card.brand,
          card_last4: card.last4,
          card_exp_month: card.exp_month,
          card_exp_year: card.exp_year,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_payment_method_id', paymentMethodId)
        .select()
        .single()
      
      if (error) {
        console.error('❌ SAVE-PM: Error updating payment method:', error)
        return NextResponse.json(
          { error: 'Failed to update payment method', details: error.message },
          { status: 500 }
        )
      }
      
      console.log('✅ SAVE-PM: Payment method updated successfully')
      return NextResponse.json({
        success: true,
        paymentMethod: data,
        message: 'Payment method updated successfully',
      })
    } else {
      console.log('📋 SAVE-PM: Creating new payment method record...')
      
      // Check if this is the user's first payment method
      const { data: existingPMs } = await supabase
        .from('payment_methods')
        .select('id')
        .eq('user_id', userId)
        .limit(1)
      
      const isFirstPaymentMethod = !existingPMs || existingPMs.length === 0
      console.log('📋 SAVE-PM: Is first payment method?', isFirstPaymentMethod)
      
      // Insert new payment method (set as default if it's the first one)
      const { data, error } = await supabase
        .from('payment_methods')
        .insert({
          user_id: userId,
          stripe_payment_method_id: paymentMethodId,
          stripe_customer_id: finalCustomerId,
          card_brand: card.brand,
          card_last4: card.last4,
          card_exp_month: card.exp_month,
          card_exp_year: card.exp_year,
          is_default: isFirstPaymentMethod, // Set as default if it's the first payment method
        })
        .select()
        .single()
      
      if (error) {
        console.error('❌ SAVE-PM: Error saving payment method:', error)
        return NextResponse.json(
          { error: 'Failed to save payment method', details: error.message },
          { status: 500 }
        )
      }
      
      console.log('✅ SAVE-PM: Payment method saved successfully')
      return NextResponse.json({
        success: true,
        paymentMethod: data,
        message: 'Payment method saved successfully',
      })
    }
  } catch (error) {
    console.error('❌ SAVE-PM: Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to save payment method',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

