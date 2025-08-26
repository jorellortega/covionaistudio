import { NextResponse } from 'next/server'
import { getSupabaseClient } from '@/lib/supabase'

export async function GET() {
  try {
    const supabase = getSupabaseClient()
    
    // Test database connection
    const { data: users, error: usersError } = await supabase
      .from('users')
      .select('count')
      .limit(1)
    
    if (usersError) {
      return NextResponse.json({ 
        status: 'error', 
        message: 'Database connection failed', 
        error: usersError.message 
      }, { status: 500 })
    }
    
    // Test auth service
    const { data: authData, error: authError } = await supabase.auth.admin.listUsers()
    
    if (authError) {
      return NextResponse.json({ 
        status: 'error', 
        message: 'Auth service failed', 
        error: authError.message 
      }, { status: 500 })
    }
    
    return NextResponse.json({ 
      status: 'success', 
      message: 'All services are working',
      database: 'connected',
      auth: 'working',
      userCount: authData.users?.length || 0
    })
    
  } catch (error) {
    return NextResponse.json({ 
      status: 'error', 
      message: 'Test failed', 
      error: error instanceof Error ? error.message : 'Unknown error'
    }, { status: 500 })
  }
}
