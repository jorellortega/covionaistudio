import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json()

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      )
    }

    console.log('🧪 TEST: Simple ElevenLabs API key check...')
    console.log('🔑 API Key (first 10 chars):', apiKey.substring(0, 10) + '...')

    // Simple direct test to ElevenLabs
    const response = await fetch('https://api.elevenlabs.io/v1/user', {
      headers: { 'xi-api-key': apiKey },
    })

    console.log('📡 Direct response status:', response.status)
    console.log('📡 Response headers:', Object.fromEntries(response.headers.entries()))

    if (!response.ok) {
      const errorText = await response.text()
      console.log('❌ Error response body:', errorText)
      
      return NextResponse.json({
        success: false,
        status: response.status,
        error: errorText,
        message: `ElevenLabs API returned status ${response.status}`
      })
    }

    const userData = await response.json()
    console.log('✅ Success! User data received')

    return NextResponse.json({
      success: true,
      status: response.status,
      message: 'API key is valid',
      user: {
        id: userData.id,
        email: userData.email,
        first_name: userData.first_name,
        last_name: userData.last_name
      }
    })

  } catch (error) {
    console.error('🧪 TEST: ElevenLabs test error:', error)
    return NextResponse.json(
      { 
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        message: 'Failed to test ElevenLabs API'
      },
      { status: 500 }
    )
  }
}
