import { NextRequest, NextResponse } from 'next/server'

export async function POST(request: NextRequest) {
  try {
    const formData = await request.formData()
    const s3Url = request.headers.get('x-s3-url')
    
    if (!s3Url) {
      return NextResponse.json(
        { error: 'S3 URL is required' },
        { status: 400 }
      )
    }

    // Forward the form data to S3
    const s3Response = await fetch(s3Url, {
      method: 'POST',
      body: formData,
    })

    if (!s3Response.ok) {
      const errorText = await s3Response.text()
      return NextResponse.json(
        { error: `S3 upload failed: ${s3Response.status} - ${errorText}` },
        { status: s3Response.status }
      )
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('S3 upload error:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}




