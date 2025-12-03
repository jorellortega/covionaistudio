import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'

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
    console.log('🔧 ADD-CREDITS: Starting credit addition...')
    const { userId, credits, paymentIntentId, sessionId, metadata } = await request.json()
    
    console.log('📋 ADD-CREDITS: Request data:', { userId, credits, paymentIntentId, sessionId })
    
    if (!userId || !credits || credits <= 0) {
      return NextResponse.json(
        { error: 'User ID and valid credits amount are required' },
        { status: 400 }
      )
    }
    
    const supabase = getSupabaseAdmin()
    
    console.log('📋 ADD-CREDITS: Calling add_credits function...')
    const { data, error } = await supabase.rpc('add_credits', {
      p_user_id: userId,
      p_amount: credits,
      p_description: `Credit purchase: ${metadata?.packageId || 'custom amount'}`,
      p_stripe_payment_intent_id: paymentIntentId || null,
      p_metadata: {
        packageId: metadata?.packageId,
        amount: metadata?.amount,
        checkout_session_id: sessionId,
      }
    })
    
    if (error) {
      console.error('❌ ADD-CREDITS: Error adding credits:', error)
      return NextResponse.json(
        { 
          error: 'Failed to add credits',
          details: error.message 
        },
        { status: 500 }
      )
    }
    
    console.log('✅ ADD-CREDITS: Credits added successfully! New balance:', data)
    
    return NextResponse.json({
      success: true,
      newBalance: data,
      creditsAdded: credits,
      message: 'Credits added successfully',
    })
  } catch (error) {
    console.error('❌ ADD-CREDITS: Error:', error)
    return NextResponse.json(
      {
        error: 'Failed to add credits',
        details: error instanceof Error ? error.message : 'Unknown error',
      },
      { status: 500 }
    )
  }
}





















