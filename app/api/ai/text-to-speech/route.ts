import { NextRequest, NextResponse } from 'next/server'
import { ElevenLabsService } from '@/lib/ai-services'

export async function POST(request: NextRequest) {
  try {
    const { text, voiceId, apiKey } = await request.json()

    if (!text || !apiKey) {
      return NextResponse.json(
        { error: 'Text and API key are required' },
        { status: 400 }
      )
    }

    // Generate audio using ElevenLabs
    const result = await ElevenLabsService.generateAudio({
      prompt: text,
      voiceId: voiceId || "21m00Tcm4TlvDq8ikWAM", // Default to Rachel voice
      apiKey: apiKey,
      type: 'audio'
    })

    if (!result.success) {
      return NextResponse.json(
        { error: result.error || 'Failed to generate audio' },
        { status: 500 }
      )
    }

    // Return the audio blob as a response
    const audioBlob = result.data.audio_blob
    const response = new NextResponse(audioBlob, {
      headers: {
        'Content-Type': 'audio/mpeg',
        'Content-Length': audioBlob.size.toString(),
      },
    })

    return response
  } catch (error) {
    console.error('Text-to-speech error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
