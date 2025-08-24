import { NextRequest, NextResponse } from 'next/server'

export async function GET() {
  console.log('🧪 TEST ROUTE: GET endpoint called!')
  return NextResponse.json({ message: 'Test route working!' })
}

export async function POST(request: NextRequest) {
  console.log('🧪 TEST ROUTE: POST endpoint called!')
  try {
    const body = await request.json()
    console.log('🧪 TEST ROUTE: Request body:', body)
    return NextResponse.json({ 
      message: 'Test route working!', 
      received: body,
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    console.error('🧪 TEST ROUTE: Error:', error)
    return NextResponse.json({ error: 'Test route error' }, { status: 500 })
  }
}
