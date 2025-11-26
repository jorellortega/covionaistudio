import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import Stripe from 'stripe'

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
    console.log('🔧 SET-DEFAULT: Starting set/unset default payment method...')
    const { userId, paymentMethodId, customerId, unset } = await request.json()
    
    console.log('📋 SET-DEFAULT: Request data:', { userId, paymentMethodId, customerId, unset })
    
    if (!userId || !paymentMethodId) {
      return NextResponse.json(
        { error: 'User ID and Payment Method ID are required' },
        { status: 400 }
      )
    }
    
    const supabase = getSupabaseAdmin()
    
    // Get the payment method record from database
    const { data: pmData, error: pmError } = await supabase
      .from('payment_methods')
      .select('*')
      .eq('stripe_payment_method_id', paymentMethodId)
      .eq('user_id', userId)
      .single()
    
    if (pmError || !pmData) {
      console.error('❌ SET-DEFAULT: Payment method not found in database:', pmError)
      return NextResponse.json(
        { error: 'Payment method not found' },
        { status: 404 }
      )
    }
    
    console.log('📋 SET-DEFAULT: Found payment method:', pmData.id)
    console.log('📋 SET-DEFAULT: Current is_default:', pmData.is_default)
    console.log('📋 SET-DEFAULT: Unset flag:', unset)
    
    // If unset is true, set is_default to false
    // Otherwise, set it to true (which will trigger the database function to unset others)
    const newDefaultValue = unset ? false : true
    
    // Update database
    const { data: updatedPM, error: updateError } = await supabase
      .from('payment_methods')
      .update({ is_default: newDefaultValue })
      .eq('id', pmData.id)
      .select()
      .single()
    
    if (updateError) {
      console.error('❌ SET-DEFAULT: Error updating database:', updateError)
      return NextResponse.json(
        { error: 'Failed to update default payment method', details: updateError.message },
        { status: 500 }
      )
    }
    
    console.log('✅ SET-DEFAULT: Payment method default status updated in database')
    
    // Also update Stripe customer's default payment method (only if setting as default)
    if (!unset && (customerId || pmData.stripe_customer_id)) {
      const finalCustomerId = customerId || pmData.stripe_customer_id
      try {
        const stripe = getStripe()
        await stripe.customers.update(finalCustomerId, {
          invoice_settings: {
            default_payment_method: paymentMethodId,
          },
        })
        console.log('✅ SET-DEFAULT: Stripe customer default payment method updated')
      } catch (stripeError) {
        console.error('⚠️ SET-DEFAULT: Error updating Stripe customer (non-critical):', stripeError)
        // Don't fail the request if Stripe update fails, database is the source of truth
      }
    } else if (unset && (customerId || pmData.stripe_customer_id)) {
      // If unsetting, remove default from Stripe customer
      const finalCustomerId = customerId || pmData.stripe_customer_id
      try {
        const stripe = getStripe()
        await stripe.customers.update(finalCustomerId, {
          invoice_settings: {
            default_payment_method: null,
          },
        })
        console.log('✅ SET-DEFAULT: Stripe customer default payment method removed')
      } catch (stripeError) {
        console.error('⚠️ SET-DEFAULT: Error updating Stripe customer (non-critical):', stripeError)
      }
    }
    
    return NextResponse.json({
      success: true,
      paymentMethod: updatedPM,
      message: unset 
        ? 'Payment method unset as default successfully' 
        : 'Payment method set as default successfully',
    })
  } catch (error) {
    console.error('❌ SET-DEFAULT: Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to update default payment method',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}

