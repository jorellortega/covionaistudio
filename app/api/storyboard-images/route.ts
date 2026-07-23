import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'

export async function POST(request: NextRequest) {
  try {
    const {
      storyboardId,
      imageUrl,
      imageName,
      generationModel,
      generationPrompt,
      metadata,
      isDefault,
    } = await request.json()

    if (!storyboardId || !imageUrl) {
      return NextResponse.json(
        { error: 'Missing required fields: storyboardId, imageUrl' },
        { status: 400 },
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
      },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (isDefault) {
      await supabase
        .from('storyboard_images')
        .update({ is_default: false })
        .eq('storyboard_id', storyboardId)
        .eq('user_id', user.id)
    }

    const { data, error } = await supabase
      .from('storyboard_images')
      .insert({
        storyboard_id: storyboardId,
        user_id: user.id,
        image_url: imageUrl,
        image_name: imageName,
        generation_model: generationModel,
        generation_prompt: generationPrompt,
        metadata: metadata || {},
        is_default: isDefault ?? false,
      })
      .select()
      .single()

    if (error) {
      console.error('Error saving storyboard image:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (isDefault) {
      await supabase
        .from('storyboards')
        .update({ image_url: imageUrl, ai_generated: true })
        .eq('id', storyboardId)
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error in POST /api/storyboard-images:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const storyboardId = searchParams.get('storyboardId')

    if (!storyboardId) {
      return NextResponse.json(
        { error: 'Missing storyboardId parameter' },
        { status: 400 },
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
      },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data, error } = await supabase
      .from('storyboard_images')
      .select('*')
      .eq('storyboard_id', storyboardId)
      .eq('user_id', user.id)
      .order('is_default', { ascending: false })
      .order('created_at', { ascending: false })

    if (error) {
      console.error('Error fetching storyboard images:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    return NextResponse.json({ success: true, data: data || [] })
  } catch (error) {
    console.error('Error in GET /api/storyboard-images:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function PATCH(request: NextRequest) {
  try {
    const { imageId, isDefault } = await request.json()

    if (!imageId || typeof isDefault !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: imageId, isDefault' },
        { status: 400 },
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
      },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: image, error: fetchError } = await supabase
      .from('storyboard_images')
      .select('storyboard_id, image_url')
      .eq('id', imageId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    if (isDefault) {
      await supabase
        .from('storyboard_images')
        .update({ is_default: false })
        .eq('storyboard_id', image.storyboard_id)
        .eq('user_id', user.id)
        .neq('id', imageId)
    }

    const { data, error } = await supabase
      .from('storyboard_images')
      .update({ is_default: isDefault })
      .eq('id', imageId)
      .eq('user_id', user.id)
      .select()
      .single()

    if (error) {
      console.error('Error updating storyboard image:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (isDefault) {
      await supabase
        .from('storyboards')
        .update({ image_url: image.image_url })
        .eq('id', image.storyboard_id)
    }

    return NextResponse.json({ success: true, data })
  } catch (error) {
    console.error('Error in PATCH /api/storyboard-images:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function DELETE(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const imageId = searchParams.get('imageId')

    if (!imageId) {
      return NextResponse.json({ error: 'Missing imageId parameter' }, { status: 400 })
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
      },
    )

    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { data: image, error: fetchError } = await supabase
      .from('storyboard_images')
      .select('storyboard_id, image_url, is_default')
      .eq('id', imageId)
      .eq('user_id', user.id)
      .single()

    if (fetchError || !image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('storyboard_images')
      .delete()
      .eq('id', imageId)
      .eq('user_id', user.id)

    if (error) {
      console.error('Error deleting storyboard image:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (image.is_default) {
      const { data: remaining } = await supabase
        .from('storyboard_images')
        .select('id, image_url')
        .eq('storyboard_id', image.storyboard_id)
        .eq('user_id', user.id)
        .order('created_at', { ascending: false })
        .limit(1)

      const next = remaining?.[0]
      if (next) {
        await supabase
          .from('storyboard_images')
          .update({ is_default: true })
          .eq('id', next.id)
        await supabase
          .from('storyboards')
          .update({ image_url: next.image_url })
          .eq('id', image.storyboard_id)
      } else {
        await supabase
          .from('storyboards')
          .update({ image_url: null })
          .eq('id', image.storyboard_id)
      }
    }

    return NextResponse.json({ success: true })
  } catch (error) {
    console.error('Error in DELETE /api/storyboard-images:', error)
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
