import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { createClient } from '@supabase/supabase-js'

function getStripe() {
  if (!process.env.STRIPE_SECRET_KEY) {
    throw new Error('STRIPE_SECRET_KEY is not set')
  }
  return new Stripe(process.env.STRIPE_SECRET_KEY, {
    apiVersion: '2024-12-18.acacia',
  })
}

function getSupabaseAdmin() {
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase credentials not set')
  }
  return createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false
      }
    }
  )
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 CANCEL: Starting subscription cancellation...')
    const { userId } = await request.json()

    if (!userId) {
      console.error('❌ CANCEL: User ID is required')
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    console.log('📋 CANCEL: User ID:', userId)

    // Get subscription from database
    console.log('🔧 CANCEL: Step 1: Fetching subscription from database...')
    const supabase = getSupabaseAdmin()
    console.log('📋 CANCEL: Supabase URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing')
    console.log('📋 CANCEL: Service Role Key:', process.env.SUPABASE_SERVICE_ROLE_KEY ? `✅ Set (length: ${process.env.SUPABASE_SERVICE_ROLE_KEY.length})` : '❌ Missing')
    
    const { data: subscription, error: subError } = await supabase
      .from('subscriptions')
      .select('*')
      .eq('user_id', userId)
      .eq('status', 'active')
      .order('created_at', { ascending: false })
      .limit(1)
      .single()

    if (subError || !subscription) {
      console.error('❌ CANCEL: No active subscription found')
      console.error('📋 CANCEL: Error code:', subError?.code)
      console.error('📋 CANCEL: Error message:', subError?.message)
      console.error('📋 CANCEL: Full error:', JSON.stringify(subError, null, 2))
      
      // Try to find any subscription (including canceled ones)
      const { data: anySub, error: anyError } = await supabase
        .from('subscriptions')
        .select('*')
        .eq('user_id', userId)
        .order('created_at', { ascending: false })
        .limit(1)
        .single()
      
      if (anySub) {
        console.log('📋 CANCEL: Found subscription with status:', anySub.status)
        console.log('📋 CANCEL: Using this subscription instead')
        // Use this subscription even if it's not active
      } else {
        return NextResponse.json(
          { error: 'No subscription found', details: anyError },
          { status: 404 }
        )
      }
    }

    if (!subscription) {
      return NextResponse.json(
        { error: 'No subscription found' },
        { status: 404 }
      )
    }

    console.log('✅ CANCEL: Found subscription:', subscription.stripe_subscription_id)
    console.log('📋 CANCEL: Subscription ID (DB):', subscription.id)
    console.log('📋 CANCEL: Current cancel_at_period_end:', subscription.cancel_at_period_end)

    // Cancel the subscription at period end in Stripe
    console.log('🔧 CANCEL: Step 2: Canceling subscription in Stripe...')
    const stripe = getStripe()
    const canceledSubscription = await stripe.subscriptions.update(
      subscription.stripe_subscription_id,
      {
        cancel_at_period_end: true,
      }
    )

    console.log('✅ CANCEL: Subscription canceled in Stripe')
    console.log('📋 CANCEL: Cancel at period end:', canceledSubscription.cancel_at_period_end)
    console.log('📋 CANCEL: Current period end:', new Date(canceledSubscription.current_period_end * 1000).toISOString())

    // Sync from Stripe to update database (this is more reliable than direct update)
    console.log('🔧 CANCEL: Step 3: Syncing subscription from Stripe to database...')
    let updatedSubscription = null
    
    try {
      // Use the sync endpoint which fetches fresh data from Stripe
      const syncUrl = `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/api/stripe/sync-subscription`
      console.log('📋 CANCEL: Calling sync endpoint:', syncUrl)
      
      const syncResponse = await fetch(syncUrl, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          subscriptionId: canceledSubscription.id,
          userId: userId,
        }),
      })
      
      if (!syncResponse.ok) {
        const errorText = await syncResponse.text()
        console.error('❌ CANCEL: Sync endpoint returned error:', syncResponse.status, errorText)
        throw new Error(`Sync failed: ${syncResponse.status}`)
      }
      
      const syncData = await syncResponse.json()
      console.log('✅ CANCEL: Successfully synced subscription from Stripe')
      console.log('📋 CANCEL: Sync response:', JSON.stringify(syncData, null, 2))
      updatedSubscription = syncData.subscription
      
      if (updatedSubscription) {
        console.log('📋 CANCEL: Updated subscription cancel_at_period_end:', updatedSubscription.cancel_at_period_end)
      } else {
        console.warn('⚠️ CANCEL: Sync succeeded but no subscription in response')
      }
    } catch (syncError) {
      console.error('❌ CANCEL: Error syncing subscription from Stripe:', syncError)
      console.error('📋 CANCEL: Error details:', syncError instanceof Error ? syncError.message : String(syncError))
      
      // Fallback: Try direct database update
      console.log('🔧 CANCEL: Attempting direct database update as fallback...')
      const { data: updateData, error: updateErr } = await supabase
        .from('subscriptions')
        .update({
          cancel_at_period_end: true,
          updated_at: new Date().toISOString(),
        })
        .eq('stripe_subscription_id', canceledSubscription.id)
        .select()
        .single()
      
      if (updateErr) {
        console.error('❌ CANCEL: Direct update also failed:', updateErr.message)
      } else {
        console.log('✅ CANCEL: Direct update succeeded')
        updatedSubscription = updateData
      }
    }

    return NextResponse.json({ 
      success: true,
      message: 'Subscription will be canceled at the end of the billing period',
      cancel_at_period_end: canceledSubscription.current_period_end,
      subscription: updatedSubscription || subscription,
      databaseUpdated: !!updatedSubscription,
    })
  } catch (error) {
    console.error('❌ CANCEL: Error canceling subscription:', error)
    console.error('📋 CANCEL: Error details:', error instanceof Error ? error.stack : String(error))
    return NextResponse.json(
      { 
        error: 'Failed to cancel subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

