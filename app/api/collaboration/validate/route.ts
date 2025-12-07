import { NextRequest, NextResponse } from 'next/server'
import { CollaborationService } from '@/lib/collaboration-service'

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { access_code } = body

    if (!access_code) {
      return NextResponse.json(
        { error: 'access_code is required' },
        { status: 400 }
      )
    }

    const validation = await CollaborationService.validateAccessCode(access_code)

    if (!validation.valid) {
      return NextResponse.json(
        { 
          valid: false, 
          reason: validation.reason || 'Invalid access code' 
        },
        { status: 200 }
      )
    }

    return NextResponse.json({
      valid: true,
      session: validation.session,
    })
  } catch (error: any) {
    console.error('Error validating access code:', error)
    return NextResponse.json(
      { error: error.message || 'Failed to validate access code' },
      { status: 500 }
    )
  }
}



























