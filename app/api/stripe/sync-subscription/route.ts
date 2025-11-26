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
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
}

// Map Stripe price IDs to plan IDs
function getPlanIdFromPriceId(priceId: string): { planId: string; planName: string } | null {
  const priceIdToPlan: Record<string, { planId: string; planName: string }> = {
    [process.env.STRIPE_PRICE_CREATOR || '']: { planId: 'creator', planName: 'Creator' },
    [process.env.STRIPE_PRICE_STUDIO || '']: { planId: 'studio', planName: 'Studio' },
    [process.env.STRIPE_PRICE_PRODUCTION || '']: { planId: 'production', planName: 'Production House' },
  }
  return priceIdToPlan[priceId] || null
}

export async function POST(request: NextRequest) {
  try {
    console.log('🔄 SYNC: Starting subscription sync...')
    const { subscriptionId, userId } = await request.json()
    console.log('📋 SYNC: Request data:', { subscriptionId, userId })

    if (!subscriptionId) {
      console.error('❌ SYNC: Subscription ID is required')
      return NextResponse.json(
        { error: 'Subscription ID is required' },
        { status: 400 }
      )
    }

    console.log('🔧 SYNC: Step 1: Getting Stripe client...')
    const stripe = getStripe()
    console.log('✅ SYNC: Stripe client created')

    console.log('🔧 SYNC: Step 2: Getting Supabase admin client...')
    const supabase = getSupabaseAdmin()
    console.log('✅ SYNC: Supabase admin client created')

    // Fetch subscription from Stripe
    console.log('🔧 SYNC: Step 3: Fetching subscription from Stripe...')
    console.log('📋 SYNC: Subscription ID:', subscriptionId)
    const subscription = await stripe.subscriptions.retrieve(subscriptionId, {
      expand: ['items.data.price.product'],
    })
    console.log('✅ SYNC: Subscription fetched from Stripe')
    console.log('📋 SYNC: Subscription status:', subscription.status)
    console.log('📋 SYNC: Subscription metadata:', JSON.stringify(subscription.metadata, null, 2))

    // Get user_id from subscription metadata or from request
    console.log('🔧 SYNC: Step 4: Extracting userId...')
    const subUserId = subscription.metadata?.userId || userId
    console.log('📋 SYNC: Found userId:', subUserId)
    if (!subUserId) {
      console.error('❌ SYNC: No userId found!')
      console.error('📋 SYNC: Metadata:', subscription.metadata)
      console.error('📋 SYNC: Provided userId:', userId)
      return NextResponse.json(
        { error: 'User ID not found in subscription metadata. Please provide userId.' },
        { status: 400 }
      )
    }

    // Get plan info from the first price item
    console.log('🔧 SYNC: Step 5: Getting price ID...')
    const priceId = subscription.items.data[0]?.price?.id
    console.log('📋 SYNC: Found priceId:', priceId)
    if (!priceId) {
      console.error('❌ SYNC: No price ID in subscription!')
      console.error('📋 SYNC: Subscription items:', JSON.stringify(subscription.items.data, null, 2))
      return NextResponse.json(
        { error: 'No price ID in subscription' },
        { status: 400 }
      )
    }

    console.log('🔧 SYNC: Step 6: Mapping price ID to plan...')
    const planInfo = getPlanIdFromPriceId(priceId)
    console.log('📋 SYNC: Plan info:', planInfo)
    if (!planInfo) {
      console.error('❌ SYNC: Unknown price ID!')
      console.error('📋 SYNC: Price ID:', priceId)
      console.error('📋 SYNC: Available price IDs in env:')
      console.error('  - STRIPE_PRICE_CREATOR:', process.env.STRIPE_PRICE_CREATOR)
      console.error('  - STRIPE_PRICE_STUDIO:', process.env.STRIPE_PRICE_STUDIO)
      console.error('  - STRIPE_PRICE_PRODUCTION:', process.env.STRIPE_PRICE_PRODUCTION)
      return NextResponse.json(
        { error: `Unknown price ID: ${priceId}. Make sure your STRIPE_PRICE_* environment variables are set.` },
        { status: 400 }
      )
    }

    // Map Stripe status to our status
    console.log('🔧 SYNC: Step 7: Mapping subscription status...')
    const status = subscription.status === 'active' ? 'active' :
                  subscription.status === 'canceled' ? 'canceled' :
                  subscription.status === 'past_due' ? 'past_due' :
                  subscription.status === 'unpaid' ? 'unpaid' :
                  subscription.status === 'trialing' ? 'trialing' :
                  subscription.status === 'paused' ? 'paused' : 'active'
    console.log('📋 SYNC: Mapped status:', status, '(from Stripe status:', subscription.status, ')')

    // Prepare subscription data
    console.log('🔧 SYNC: Step 8: Preparing subscription data...')
    const subscriptionData = {
      user_id: subUserId,
      stripe_subscription_id: subscription.id,
      stripe_customer_id: subscription.customer as string,
      plan_id: planInfo.planId,
      plan_name: planInfo.planName,
      status: status,
      current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
      current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
      cancel_at_period_end: subscription.cancel_at_period_end || false,
      canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
      updated_at: new Date().toISOString(),
    }
    console.log('📋 SYNC: Subscription data to save:', JSON.stringify(subscriptionData, null, 2))

    // Upsert subscription
    console.log('🔧 SYNC: Step 9: Saving to database...')
    const { data, error } = await supabase
      .from('subscriptions')
      .upsert({
        user_id: subUserId,
        stripe_subscription_id: subscription.id,
        stripe_customer_id: subscription.customer as string,
        plan_id: planInfo.planId,
        plan_name: planInfo.planName,
        status: status,
        current_period_start: new Date(subscription.current_period_start * 1000).toISOString(),
        current_period_end: new Date(subscription.current_period_end * 1000).toISOString(),
        cancel_at_period_end: subscription.cancel_at_period_end || false,
        canceled_at: subscription.canceled_at ? new Date(subscription.canceled_at * 1000).toISOString() : null,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'stripe_subscription_id',
      })
      .select()
      .single()

    if (error) {
      console.error('❌ SYNC: Error saving subscription to database!')
      console.error('📋 SYNC: Error details:', JSON.stringify(error, null, 2))
      console.error('📋 SYNC: Error code:', error.code)
      console.error('📋 SYNC: Error message:', error.message)
      console.error('📋 SYNC: Error hint:', error.hint)
      console.error('📋 SYNC: Error details:', error.details)
      return NextResponse.json(
        { error: 'Failed to save subscription', details: error.message },
        { status: 500 }
      )
    }

    console.log('✅ SYNC: Subscription saved to database successfully!')
    console.log('📋 SYNC: Saved data:', JSON.stringify(data, null, 2))
    console.log('📋 SYNC: Subscription ID:', subscription.id)
    console.log('📋 SYNC: User ID:', subUserId)
    console.log('📋 SYNC: Plan:', planInfo.planName)

    // Update user role based on subscription plan
    if (status === 'active') {
      console.log('🔧 SYNC: Step 10: Updating user role based on subscription...')
      const roleMap: Record<string, string> = {
        'creator': 'creator',
        'studio': 'studio',
        'production': 'production',
      }
      
      const newRole = roleMap[planInfo.planId] || 'user'
      console.log('📋 SYNC: Mapping plan', planInfo.planId, 'to role', newRole)
      
      // Update user role (but preserve CEO role)
      const { error: roleError } = await supabase
        .from('users')
        .update({ role: newRole })
        .eq('id', subUserId)
        .neq('role', 'ceo') // Don't change CEO role
      
      if (roleError) {
        console.error('❌ SYNC: Error updating user role:', roleError)
      } else {
        console.log('✅ SYNC: User role updated to:', newRole)
      }
    } else {
      // If subscription is not active, revert role to 'user'
      console.log('🔧 SYNC: Subscription not active, reverting role to "user"...')
      const { error: roleError } = await supabase
        .from('users')
        .update({ role: 'user' })
        .eq('id', subUserId)
        .in('role', ['creator', 'studio', 'production']) // Only update subscription roles, preserve CEO
      
      if (roleError) {
        console.error('❌ SYNC: Error reverting user role:', roleError)
      } else {
        console.log('✅ SYNC: User role reverted to "user"')
      }
    }

    return NextResponse.json({
      success: true,
      subscription: data,
      message: 'Subscription synced successfully',
    })
  } catch (error) {
    console.error('Error syncing subscription:', error)
    return NextResponse.json(
      { 
        error: 'Failed to sync subscription',
        details: error instanceof Error ? error.message : 'Unknown error'
      },
      { status: 500 }
    )
  }
}

