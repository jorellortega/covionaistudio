import { NextRequest, NextResponse } from 'next/server'
import { RUNWAY } from '@/lib/runway-config'

export async function POST(request: NextRequest) {
  try {
    const { jobId } = await request.json()
    
    if (!jobId) {
      return NextResponse.json({ error: 'Job ID is required' }, { status: 400 })
    }

    // Clean and validate the API key
    const rawKey = process.env.RUNWAYML_API_SECRET?.trim()
    
    if (!rawKey) {
      return NextResponse.json({ error: 'RUNWAYML_API_SECRET is missing' }, { status: 500 })
    }
    
    // Remove any placeholder text that might be appended
    const cleanKey = rawKey.replace(/nway_ml_api_key_here.*$/, '').trim()
    
    if (!cleanKey.startsWith('key_')) {
      return NextResponse.json({ error: 'RUNWAYML_API_SECRET is invalid' }, { status: 500 })
    }

    console.log('🎬 Checking video job status for:', jobId)
    
    // Try different endpoints for checking job status
    const statusEndpoints = [
      `${RUNWAY.HOST}/v1/jobs/${jobId}`,
      `${RUNWAY.HOST}/v1/inference/${jobId}`,
      `${RUNWAY.HOST}/v1/tasks/${jobId}`,
      `${RUNWAY.HOST}/v1/generations/${jobId}`,
    ]
    
    let statusResponse = null
    let statusResult = null
    
    for (const endpoint of statusEndpoints) {
      try {
        console.log(`🎬 Trying status endpoint: ${endpoint}`)
        statusResponse = await fetch(endpoint, {
          method: 'GET',
          headers: {
            'Authorization': `Bearer ${cleanKey}`,
            'X-Runway-Version': RUNWAY.VERSION,
          },
        })
        
        if (statusResponse.ok) {
          statusResult = await statusResponse.json()
          console.log(`🎬 Success with endpoint: ${endpoint}`)
          break
        } else {
          console.log(`🎬 Endpoint ${endpoint} failed with status: ${statusResponse.status}`)
        }
      } catch (error) {
        console.log(`🎬 Endpoint ${endpoint} error:`, error)
      }
    }
    
    if (!statusResponse || !statusResponse.ok) {
      console.error('🎬 All status endpoints failed')
      return NextResponse.json({ 
        error: 'Could not check job status - all endpoints failed' 
      }, { status: 404 })
    }
    
    console.log('🎬 Job status result:', statusResult)
    
    // Handle Runway ML's specific status format
    let responseData = statusResult
    
    // If status is 'SUCCEEDED' and we have output, extract the URL
    if (statusResult.status === 'SUCCEEDED' && statusResult.output && statusResult.output.length > 0) {
      responseData = {
        ...statusResult,
        status: 'completed',
        url: statusResult.output[0] // Take the first output URL
      }
    }
    
    return NextResponse.json({
      success: true,
      data: responseData,
    })

  } catch (error) {
    console.error('🎬 Error checking video status:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
