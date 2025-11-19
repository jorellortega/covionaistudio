import { NextRequest, NextResponse } from 'next/server'
import Stripe from 'stripe'
import { headers } from 'next/headers'
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
  console.log('🔧 Checking Supabase credentials...')
  console.log('📋 NEXT_PUBLIC_SUPABASE_URL:', process.env.NEXT_PUBLIC_SUPABASE_URL ? '✅ Set' : '❌ Missing')
  console.log('📋 SUPABASE_SERVICE_ROLE_KEY:', process.env.SUPABASE_SERVICE_ROLE_KEY ? '✅ Set (length: ' + process.env.SUPABASE_SERVICE_ROLE_KEY.length + ')' : '❌ Missing')
  
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    const missing = []
    if (!process.env.NEXT_PUBLIC_SUPABASE_URL) missing.push('NEXT_PUBLIC_SUPABASE_URL')
    if (!process.env.SUPABASE_SERVICE_ROLE_KEY) missing.push('SUPABASE_SERVICE_ROLE_KEY')
    throw new Error(`Supabase credentials not set: ${missing.join(', ')}`)
  }
  
  console.log('✅ Creating Supabase admin client...')
  const client = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  )
  console.log('✅ Supabase admin client created')
  return client
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

// This is your Stripe webhook secret for local development
// Get this from: stripe listen --print-secret
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  try {
    console.log('📥 Webhook received!')
    const body = await request.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')

    if (!signature) {
      console.error('❌ Missing stripe-signature header')
      return NextResponse.json(
        { error: 'Missing stripe-signature header' },
        { status: 400 }
      )
    }

    if (!webhookSecret) {
      console.error('❌ STRIPE_WEBHOOK_SECRET is not set in environment variables')
      return NextResponse.json(
        { error: 'Webhook secret not configured' },
        { status: 500 }
      )
    }

    let event: Stripe.Event

    try {
      // Verify the webhook signature
      const stripe = getStripe()
      event = stripe.webhooks.constructEvent(
        body,
        signature,
        webhookSecret
      )
    } catch (err) {
      const error = err as Error
      console.error('❌ Webhook signature verification failed:', error.message)
      console.error('Make sure STRIPE_WEBHOOK_SECRET matches the secret from: stripe listen --print-secret')
      return NextResponse.json(
        { error: `Webhook Error: ${error.message}` },
        { status: 400 }
      )
    }

    // Handle the event
    console.log('🔔 Received Stripe webhook event:', event.type, event.id)

    switch (event.type) {
      case 'payment_intent.succeeded':
        const paymentIntent = event.data.object as Stripe.PaymentIntent
        console.log('PaymentIntent succeeded:', paymentIntent.id)
        // TODO: Update user's credits or subscription in database
        // Example: await updateUserCredits(paymentIntent.metadata.userId, paymentIntent.amount)
        break

      case 'payment_intent.payment_failed':
        const failedPayment = event.data.object as Stripe.PaymentIntent
        console.log('PaymentIntent failed:', failedPayment.id)
        // TODO: Handle failed payment
        break

      case 'checkout.session.completed':
        const session = event.data.object as Stripe.Checkout.Session
        console.log('Checkout session completed:', session.id)
        // TODO: Handle successful checkout
        // Example: await activateSubscription(session.customer, session.metadata.planId)
        break

      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        const subscription = event.data.object as Stripe.Subscription
        console.log('📋 Processing subscription event:', subscription.id)
        console.log('📋 Subscription status:', subscription.status)
        console.log('📋 Subscription metadata:', JSON.stringify(subscription.metadata, null, 2))
        
        try {
          console.log('🔧 Step 1: Getting Supabase admin client...')
          const supabase = getSupabaseAdmin()
          console.log('✅ Supabase client created')
          
          // Get user_id from subscription metadata (set during checkout)
          console.log('🔧 Step 2: Extracting userId from metadata...')
          const userId = subscription.metadata?.userId
          console.log('📋 Found userId:', userId)
          if (!userId) {
            console.error('❌ No userId in subscription metadata!')
            console.error('📋 Available metadata keys:', Object.keys(subscription.metadata || {}))
            console.error('📋 Full subscription object:', JSON.stringify({
              id: subscription.id,
              customer: subscription.customer,
              metadata: subscription.metadata,
              items: subscription.items.data.map(item => ({
                price: item.price.id,
                product: item.price.product
              }))
            }, null, 2))
            break
          }

          // Get plan info from the first price item
          console.log('🔧 Step 3: Getting price ID from subscription items...')
          const priceId = subscription.items.data[0]?.price?.id
          console.log('📋 Found priceId:', priceId)
          if (!priceId) {
            console.error('❌ No price ID in subscription!')
            console.error('📋 Subscription items:', JSON.stringify(subscription.items.data, null, 2))
            break
          }

          console.log('🔧 Step 4: Mapping price ID to plan...')
          const planInfo = getPlanIdFromPriceId(priceId)
          console.log('📋 Plan info:', planInfo)
          if (!planInfo) {
            console.error('❌ Unknown price ID:', priceId)
            console.error('📋 Available price IDs in env:')
            console.error('  - STRIPE_PRICE_CREATOR:', process.env.STRIPE_PRICE_CREATOR)
            console.error('  - STRIPE_PRICE_STUDIO:', process.env.STRIPE_PRICE_STUDIO)
            console.error('  - STRIPE_PRICE_PRODUCTION:', process.env.STRIPE_PRICE_PRODUCTION)
            break
          }

          // Map Stripe status to our status
          console.log('🔧 Step 5: Mapping subscription status...')
          const status = subscription.status === 'active' ? 'active' :
                        subscription.status === 'canceled' ? 'canceled' :
                        subscription.status === 'past_due' ? 'past_due' :
                        subscription.status === 'unpaid' ? 'unpaid' :
                        subscription.status === 'trialing' ? 'trialing' :
                        subscription.status === 'paused' ? 'paused' : 'active'
          console.log('📋 Mapped status:', status, '(from Stripe status:', subscription.status, ')')

          // Prepare subscription data
          console.log('🔧 Step 6: Preparing subscription data...')
          const subscriptionData = {
            user_id: userId,
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
          console.log('📋 Subscription data to save:', JSON.stringify(subscriptionData, null, 2))

          // Upsert subscription
          console.log('🔧 Step 7: Saving to database...')
          const { data: savedData, error: subError } = await supabase
            .from('subscriptions')
            .upsert(subscriptionData, {
              onConflict: 'stripe_subscription_id',
            })
            .select()

          if (subError) {
            console.error('❌ Error saving subscription to database!')
            console.error('📋 Error details:', JSON.stringify(subError, null, 2))
            console.error('📋 Error code:', subError.code)
            console.error('📋 Error message:', subError.message)
            console.error('📋 Error hint:', subError.hint)
            console.error('📋 Error details:', subError.details)
          } else {
            console.log('✅ Subscription saved to database successfully!')
            console.log('📋 Saved data:', JSON.stringify(savedData, null, 2))
            console.log('📋 Subscription ID:', subscription.id)
            console.log('📋 User ID:', userId)
            console.log('📋 Plan:', planInfo.planName)
          }
        } catch (error) {
          console.error('❌ Exception caught while processing subscription!')
          console.error('📋 Error type:', error instanceof Error ? error.constructor.name : typeof error)
          console.error('📋 Error message:', error instanceof Error ? error.message : String(error))
          console.error('📋 Error stack:', error instanceof Error ? error.stack : 'No stack trace')
          console.error('📋 Full error:', JSON.stringify(error, Object.getOwnPropertyNames(error), 2))
        }
        break

      case 'customer.subscription.deleted':
        const deletedSubscription = event.data.object as Stripe.Subscription
        console.log('Subscription deleted:', deletedSubscription.id)
        
        try {
          const supabase = getSupabaseAdmin()
          
          // Update subscription status to canceled
          const { error } = await supabase
            .from('subscriptions')
            .update({
              status: 'canceled',
              canceled_at: new Date().toISOString(),
              updated_at: new Date().toISOString(),
            })
            .eq('stripe_subscription_id', deletedSubscription.id)

          if (error) {
            console.error('Error updating canceled subscription:', error)
          } else {
            console.log('Subscription marked as canceled:', deletedSubscription.id)
          }
        } catch (error) {
          console.error('Error processing subscription deletion:', error)
        }
        break

      case 'invoice.payment_succeeded':
        const invoice = event.data.object as Stripe.Invoice
        console.log('Invoice payment succeeded:', invoice.id)
        // TODO: Handle successful invoice payment
        break

      case 'invoice.payment_failed':
        const failedInvoice = event.data.object as Stripe.Invoice
        console.log('Invoice payment failed:', failedInvoice.id)
        // TODO: Handle failed invoice payment
        break

      default:
        console.log(`Unhandled event type: ${event.type}`)
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    console.error('Error processing webhook:', error)
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 500 }
    )
  }
}

// Test endpoint to verify webhook route is accessible
export async function GET() {
  return NextResponse.json({
    message: 'Webhook endpoint is accessible',
    timestamp: new Date().toISOString(),
    env: {
      hasWebhookSecret: !!process.env.STRIPE_WEBHOOK_SECRET,
      hasStripeKey: !!process.env.STRIPE_SECRET_KEY,
      hasSupabaseUrl: !!process.env.NEXT_PUBLIC_SUPABASE_URL,
      hasServiceRoleKey: !!process.env.SUPABASE_SERVICE_ROLE_KEY,
    }
  })
}

