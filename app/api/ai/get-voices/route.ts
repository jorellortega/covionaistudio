import { NextRequest, NextResponse } from 'next/server'
import { ElevenLabsService } from '@/lib/ai-services'

export async function POST(request: NextRequest) {
  try {
    const { apiKey } = await request.json()

    if (!apiKey) {
      return NextResponse.json(
        { error: 'API key is required' },
        { status: 400 }
      )
    }

    // Get available voices from ElevenLabs
    const result = await ElevenLabsService.getAvailableVoices(apiKey)

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to fetch voices' },
        { status: 500 }
      )
    }

    return NextResponse.json(result.data)
  } catch (error) {
    console.error('Get voices error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
