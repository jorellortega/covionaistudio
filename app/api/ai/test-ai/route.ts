import { NextRequest, NextResponse } from 'next/server'

export async function GET(request: NextRequest) {
  try {
    // Check if environment variables are set
    const openaiKey = process.env.OPENAI_API_KEY
    const anthropicKey = process.env.ANTHROPIC_API_KEY
    
    // Check if keys are valid format
    const openaiValid = openaiKey && openaiKey.startsWith('sk-')
    const anthropicValid = anthropicKey && anthropicKey.startsWith('sk-ant-')
    
    return NextResponse.json({
      success: true,
      message: 'AI test endpoint working',
      environment: {
        hasOpenAIKey: !!openaiKey,
        hasAnthropicKey: !!anthropicKey,
        openaiKeyLength: openaiKey ? openaiKey.length : 0,
        anthropicKeyLength: anthropicKey ? anthropicKey.length : 0,
        openaiValid,
        anthropicValid
      },
      timestamp: new Date().toISOString()
    })
  } catch (error) {
    return NextResponse.json({
      success: false,
      error: error instanceof Error ? error.message : 'Unknown error',
      timestamp: new Date().toISOString()
    }, { status: 500 })
  }
}
