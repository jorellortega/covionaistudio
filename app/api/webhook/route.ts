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
    [process.env.STRIPE_PRICE_CREATOR_YEARLY || '']: { planId: 'creator', planName: 'Creator' },
    [process.env.STRIPE_PRICE_STUDIO || '']: { planId: 'studio', planName: 'Studio' },
    [process.env.STRIPE_PRICE_STUDIO_YEARLY || '']: { planId: 'studio', planName: 'Studio' },
    [process.env.STRIPE_PRICE_PRODUCTION || '']: { planId: 'production', planName: 'Production House' },
    [process.env.STRIPE_PRICE_PRODUCTION_YEARLY || '']: { planId: 'production', planName: 'Production House' },
  }
  return priceIdToPlan[priceId] || null
}

// This is your Stripe webhook secret for local development
// Get this from: stripe listen --print-secret
const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET!

export async function POST(request: NextRequest) {
  const startTime = Date.now()
  try {
    console.log('📥 ========== WEBHOOK RECEIVED ==========')
    console.log('📥 Timestamp:', new Date().toISOString())
    const body = await request.text()
    const headersList = await headers()
    const signature = headersList.get('stripe-signature')
    console.log('📥 Request headers:', {
      'stripe-signature': signature ? 'Present' : 'Missing',
      'content-type': headersList.get('content-type'),
      'user-agent': headersList.get('user-agent'),
    })

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
    console.log('🔔 Event created:', new Date(event.created * 1000).toISOString())
    console.log('🔔 Event livemode:', event.livemode)

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
        console.log('🔔 Checkout session completed:', session.id)
        console.log('📋 Session metadata:', JSON.stringify(session.metadata, null, 2))
        console.log('📋 Session mode:', session.mode)
        
        // Handle credit purchases
        if (session.metadata?.type === 'credits' && session.metadata?.userId) {
          console.log('🔧 Processing credit purchase...')
          const supabase = getSupabaseAdmin()
          const userId = session.metadata.userId
          const credits = parseInt(session.metadata.credits || '0')
          const paymentIntentId = typeof session.payment_intent === 'string' 
            ? session.payment_intent 
            : session.payment_intent?.id
          
          if (credits > 0) {
            console.log('📋 Adding credits:', credits, 'to user:', userId)
            console.log('📋 Payment intent ID:', paymentIntentId)
            
            // Use the add_credits function to add credits and create transaction
            const { data, error } = await supabase.rpc('add_credits', {
              p_user_id: userId,
              p_amount: credits,
              p_description: `Credit purchase: ${session.metadata.packageId || 'custom amount'}`,
              p_stripe_payment_intent_id: paymentIntentId || null,
              p_metadata: {
                packageId: session.metadata.packageId,
                amount: session.metadata.amount,
                checkout_session_id: session.id,
              }
            })
            
            if (error) {
              console.error('❌ Error adding credits:', error)
            } else {
              console.log('✅ Credits added successfully! New balance:', data)
            }
          }
        }
        // Note: Subscriptions are handled by customer.subscription.created/updated events
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
          console.log('📋 Full subscription metadata:', JSON.stringify(subscription.metadata, null, 2))
          let userId = subscription.metadata?.userId
          console.log('📋 Found userId from subscription metadata:', userId)
          
          // If userId not in metadata, try to get it from customer
          if (!userId) {
            console.warn('⚠️ No userId in subscription metadata, trying to fetch from customer...')
            try {
              const stripe = getStripe()
              const customerId = typeof subscription.customer === 'string' 
                ? subscription.customer 
                : (subscription.customer as Stripe.Customer).id
              
              console.log('📋 Fetching customer:', customerId)
              const customer = await stripe.customers.retrieve(customerId)
              
              if (!customer.deleted && 'metadata' in customer) {
                console.log('📋 Customer metadata:', JSON.stringify(customer.metadata, null, 2))
                userId = customer.metadata?.userId
                if (userId) {
                  console.log('✅ Found userId in customer metadata:', userId)
                } else {
                  // Try to find user by email
                  if (customer.email) {
                    console.log('📋 Attempting to find user by email:', customer.email)
                    const { data: userData } = await supabase
                      .from('users')
                      .select('id')
                      .eq('email', customer.email)
                      .single()
                    
                    if (userData?.id) {
                      userId = userData.id
                      console.log('✅ Found userId by email lookup:', userId)
                    }
                  }
                }
              }
            } catch (customerError) {
              console.error('❌ Error fetching customer:', customerError)
            }
            
            if (!userId) {
              console.error('❌ No userId found in subscription, customer metadata, or by email lookup!')
              console.error('📋 Available subscription metadata keys:', Object.keys(subscription.metadata || {}))
              console.error('📋 Subscription ID:', subscription.id)
              console.error('📋 Customer ID:', subscription.customer)
              console.error('📋 This subscription cannot be linked to a user without userId.')
              console.error('📋 Full subscription object (limited):', JSON.stringify({
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
            console.error('  - STRIPE_PRICE_CREATOR_YEARLY:', process.env.STRIPE_PRICE_CREATOR_YEARLY)
            console.error('  - STRIPE_PRICE_STUDIO:', process.env.STRIPE_PRICE_STUDIO)
            console.error('  - STRIPE_PRICE_STUDIO_YEARLY:', process.env.STRIPE_PRICE_STUDIO_YEARLY)
            console.error('  - STRIPE_PRICE_PRODUCTION:', process.env.STRIPE_PRICE_PRODUCTION)
            console.error('  - STRIPE_PRICE_PRODUCTION_YEARLY:', process.env.STRIPE_PRICE_PRODUCTION_YEARLY)
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

            // Update user role based on subscription plan
            if (status === 'active') {
              console.log('🔧 Step 8: Updating user role based on subscription...')
              console.log('📋 Step 8a: Plan ID from subscription:', planInfo.planId)
              console.log('📋 Step 8b: Plan Name:', planInfo.planName)
              
              const roleMap: Record<string, string> = {
                'creator': 'creator',
                'studio': 'studio',
                'production': 'production',
              }
              
              console.log('📋 Step 8c: Role mapping table:', roleMap)
              const newRole = roleMap[planInfo.planId] || 'user'
              console.log('📋 Step 8d: Mapped plan', planInfo.planId, 'to role', newRole)
              console.log('📋 Step 8e: User ID to update:', userId)
              
              // First, check current user role
              const { data: currentUser, error: fetchError } = await supabase
                .from('users')
                .select('id, role, email')
                .eq('id', userId)
                .single()
              
              if (fetchError) {
                console.error('❌ Error fetching current user:', fetchError)
              } else {
                console.log('📋 Step 8f: Current user role:', currentUser?.role)
                console.log('📋 Step 8g: Current user email:', currentUser?.email)
              }
              
              // Update user role (but preserve CEO role)
              console.log('🔧 Step 8h: Executing role update query...')
              const { data: updatedUser, error: roleError } = await supabase
                .from('users')
                .update({ role: newRole })
                .eq('id', userId)
                .neq('role', 'ceo') // Don't change CEO role
                .select('id, role, email')
              
              if (roleError) {
                console.error('❌ Error updating user role:', roleError)
                console.error('📋 Role error details:', JSON.stringify(roleError, null, 2))
              } else {
                if (updatedUser && updatedUser.length > 0) {
                  console.log('✅ User role updated successfully!')
                  console.log('📋 Updated user data:', JSON.stringify(updatedUser[0], null, 2))
                  console.log('📋 New role:', updatedUser[0].role)
                } else {
                  console.warn('⚠️ Role update query succeeded but no rows were updated')
                  console.warn('📋 This might mean the user already has CEO role or user ID not found')
                }
              }
            } else {
              console.log('⚠️ Subscription status is not active:', status)
              console.log('⚠️ Skipping role update (only update roles for active subscriptions)')
            }
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
          
          // Get user_id from subscription before updating
          const { data: subscriptionData } = await supabase
            .from('subscriptions')
            .select('user_id')
            .eq('stripe_subscription_id', deletedSubscription.id)
            .single()
          
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
            
            // Revert user role to 'user' if they had a subscription-based role
            if (subscriptionData?.user_id) {
              console.log('🔧 Reverting user role to "user"...')
              const { error: roleError } = await supabase
                .from('users')
                .update({ role: 'user' })
                .eq('id', subscriptionData.user_id)
                .in('role', ['creator', 'studio', 'production']) // Only update subscription roles, preserve CEO
              
              if (roleError) {
                console.error('❌ Error reverting user role:', roleError)
              } else {
                console.log('✅ User role reverted to "user"')
              }
            }
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

    const duration = Date.now() - startTime
    console.log('✅ Webhook processed successfully in', duration, 'ms')
    console.log('📥 ========== WEBHOOK COMPLETE ==========')
    return NextResponse.json({ received: true, processed: true, duration })
  } catch (error) {
    const duration = Date.now() - startTime
    console.error('❌ ========== WEBHOOK ERROR ==========')
    console.error('❌ Error processing webhook:', error)
    console.error('❌ Error type:', error instanceof Error ? error.constructor.name : typeof error)
    console.error('❌ Error message:', error instanceof Error ? error.message : String(error))
    console.error('❌ Error stack:', error instanceof Error ? error.stack : 'No stack trace')
    console.error('❌ Duration before error:', duration, 'ms')
    console.error('❌ ====================================')
    return NextResponse.json(
      { error: 'Webhook handler failed', details: error instanceof Error ? error.message : String(error) },
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

