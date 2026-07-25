import { NextRequest, NextResponse } from 'next/server'
import { createClient, type SupabaseClient } from '@supabase/supabase-js'
import { createRouteSupabaseClient, getRouteAuthUser } from '@/lib/supabase-route'

async function resolveStoryboardImageAuth(
  request: NextRequest,
  userIdFromClient?: string,
): Promise<{ supabase: SupabaseClient; userId: string } | null> {
  const supabase = await createRouteSupabaseClient()
  const user = await getRouteAuthUser(supabase, request)
  if (user) {
    return { supabase, userId: user.id }
  }

  if (!userIdFromClient || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
    return null
  }

  const admin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    { auth: { autoRefreshToken: false, persistSession: false } },
  )

  const { data: profile } = await admin
    .from('users')
    .select('id')
    .eq('id', userIdFromClient)
    .maybeSingle()

  if (!profile) return null

  return { supabase: admin, userId: userIdFromClient }
}

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
      userId: userIdFromClient,
    } = await request.json()

    console.log("[storyboard-images] POST", {
      storyboardId,
      imageUrl: imageUrl?.slice?.(0, 80),
      isDefault,
      generationModel,
      hasPrompt: Boolean(generationPrompt),
    })

    if (!storyboardId || !imageUrl) {
      console.error("[storyboard-images] Missing required fields", {
        storyboardId: Boolean(storyboardId),
        imageUrl: Boolean(imageUrl),
      })
      return NextResponse.json(
        { error: 'Missing required fields: storyboardId, imageUrl' },
        { status: 400 },
      )
    }

    const auth = await resolveStoryboardImageAuth(request, userIdFromClient)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { supabase, userId } = auth

    const { data: storyboard, error: storyboardError } = await supabase
      .from('storyboards')
      .select('id, user_id')
      .eq('id', storyboardId)
      .eq('user_id', userId)
      .maybeSingle()

    if (storyboardError || !storyboard) {
      return NextResponse.json({ error: 'Storyboard not found or unauthorized' }, { status: 404 })
    }

    if (isDefault) {
      await supabase
        .from('storyboard_images')
        .update({ is_default: false })
        .eq('storyboard_id', storyboardId)
        .eq('user_id', userId)
    }

    const { data, error } = await supabase
      .from('storyboard_images')
      .insert({
        storyboard_id: storyboardId,
        user_id: userId,
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
      console.error('[storyboard-images] insert error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    console.log("[storyboard-images] saved", {
      storyboardId,
      imageId: data?.id,
      isDefault: isDefault ?? false,
    })

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
    const userIdFromClient = searchParams.get('userId') ?? undefined

    if (!storyboardId) {
      return NextResponse.json(
        { error: 'Missing storyboardId parameter' },
        { status: 400 },
      )
    }

    const auth = await resolveStoryboardImageAuth(request, userIdFromClient)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { supabase, userId } = auth

    const { data, error } = await supabase
      .from('storyboard_images')
      .select('*')
      .eq('storyboard_id', storyboardId)
      .eq('user_id', userId)
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
    const { imageId, isDefault, userId: userIdFromClient } = await request.json()

    if (!imageId || typeof isDefault !== 'boolean') {
      return NextResponse.json(
        { error: 'Missing required fields: imageId, isDefault' },
        { status: 400 },
      )
    }

    const auth = await resolveStoryboardImageAuth(request, userIdFromClient)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { supabase, userId } = auth

    const { data: image, error: fetchError } = await supabase
      .from('storyboard_images')
      .select('storyboard_id, image_url')
      .eq('id', imageId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    if (isDefault) {
      await supabase
        .from('storyboard_images')
        .update({ is_default: false })
        .eq('storyboard_id', image.storyboard_id)
        .eq('user_id', userId)
        .neq('id', imageId)
    }

    const { data, error } = await supabase
      .from('storyboard_images')
      .update({ is_default: isDefault })
      .eq('id', imageId)
      .eq('user_id', userId)
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
    const userIdFromClient = searchParams.get('userId') ?? undefined

    if (!imageId) {
      return NextResponse.json({ error: 'Missing imageId parameter' }, { status: 400 })
    }

    const auth = await resolveStoryboardImageAuth(request, userIdFromClient)
    if (!auth) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { supabase, userId } = auth

    const { data: image, error: fetchError } = await supabase
      .from('storyboard_images')
      .select('storyboard_id, image_url, is_default')
      .eq('id', imageId)
      .eq('user_id', userId)
      .single()

    if (fetchError || !image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    const { error } = await supabase
      .from('storyboard_images')
      .delete()
      .eq('id', imageId)
      .eq('user_id', userId)

    if (error) {
      console.error('Error deleting storyboard image:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }

    if (image.is_default) {
      const { data: remaining } = await supabase
        .from('storyboard_images')
        .select('id, image_url')
        .eq('storyboard_id', image.storyboard_id)
        .eq('user_id', userId)
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
