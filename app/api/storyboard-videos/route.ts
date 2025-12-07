import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

// Save video to database
export async function POST(request: NextRequest) {
  try {
    const { storyboardId, videoUrl, videoName, generationModel, generationPrompt, metadata, isDefault } = await request.json()
    
    if (!storyboardId || !videoUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: storyboardId, videoUrl' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // If setting as default, unset other defaults first
    if (isDefault) {
      await supabase
        .from('storyboard_videos')
        .update({ is_default: false })
        .eq('storyboard_id', storyboardId)
        .eq('user_id', user.id)
    }

    // Insert the new video
    const { data, error } = await supabase
      .from('storyboard_videos')
      .insert({
        storyboard_id: storyboardId,
        user_id: user.id,
        video_url: videoUrl,
        video_name: videoName,
        generation_model: generationModel,
        generation_prompt: generationPrompt,
        metadata: metadata || {},
        is_default: isDefault || false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving video to database:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error in POST /api/storyboard-videos:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// Get all videos for a storyboard
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storyboardId = searchParams.get('storyboardId')
    
    if (!storyboardId) {
      return NextResponse.json(
        { error: 'Missing storyboardId parameter' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const { data, error } = await supabase
      .from('storyboard_videos')
      .select('*')
      .eq('storyboard_id', storyboardId)
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching videos:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error) {
    console.error('Error in GET /api/storyboard-videos:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}

// Update video (e.g., set as default)
export async function PATCH(request: NextRequest) {
  try {
    const { videoId, isDefault } = await request.json()
    
    if (!videoId || typeof isDefault !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: videoId, isDefault' },
        { status: 400 }
      )
    }

    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll()
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }) => {
              cookieStore.set(name, value, options)
            })
          },
        },
      }
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    // Get the video to find its storyboard_id
    const { data: video, error: fetchError } = await supabase
      .from('storyboard_videos')
      .select('storyboard_id')
      .eq('id', videoId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !video) {
      return NextResponse.json(
        { error: 'Video not found' },
        { status: 404 }
      )
    }

    // If setting as default, unset other defaults first
    if (isDefault) {
      await supabase
        .from('storyboard_videos')
        .update({ is_default: false })
        .eq('storyboard_id', video.storyboard_id)
        .eq('user_id', user.id)
        .neq('id', videoId)
    }

    // Update the video
    const { data, error } = await supabase
      .from('storyboard_videos')
      .update({ is_default: isDefault })
      .eq('id', videoId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating video:', error)
      return NextResponse.json(
        { error: error.message },
        { status: 500 }
      )
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error in PATCH /api/storyboard-videos:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 }
    )
  }
}




