import { NextRequest, NextResponse } from 'next/server'
import { createServerClient } from '@supabase/ssr'
import { cookies } from 'next/headers'
import { sanitizeFilename } from '@/lib/utils'

export async function POST(request: NextRequest) {
  try {
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
            try {
              cookiesToSet.forEach(({ name, value, options }) =>
                cookieStore.set(name, value, options)
              )
            } catch { /* ignore */ }
          },
        }
      }
    )

    // Get user session
    const { data: { user }, error: authError } = await supabase.auth.getUser()
    if (authError || !user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const formData = await request.formData()
    const imageFile = formData.get('image') as File
    const prompt = formData.get('prompt') as string
    const ideaId = formData.get('ideaId') as string

    if (!imageFile) {
      return NextResponse.json({ error: 'No image file provided' }, { status: 400 })
    }

    // Generate unique filename
    const timestamp = Date.now()
    const fileExtension = imageFile.name.split('.').pop()
    
    // Sanitize filename for safe storage
    const sanitizedName = sanitizeFilename(imageFile.name)
    
    const fileName = `${timestamp}-${sanitizedName}.${fileExtension}`
    const filePath = `${user.id}/images/${fileName}`

    // Upload to Supabase storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('cinema_files')
      .upload(filePath, imageFile, {
        cacheControl: '3600',
        upsert: false
      })

    if (uploadError) {
      console.error('Storage upload error:', uploadError)
      return NextResponse.json({ error: 'Failed to upload image' }, { status: 500 })
    }

    // Get public URL
    const { data: { publicUrl } } = supabase.storage
      .from('cinema_files')
      .getPublicUrl(filePath)

    // Save to idea_images table
    const imageData: any = {
      user_id: user.id,
      image_url: publicUrl,
      bucket_path: filePath,
      prompt: prompt || 'Imported image',
      created_at: new Date().toISOString()
    }

    // Only add idea_id if it's provided
    if (ideaId) {
      imageData.idea_id = ideaId
    }

    const { data: savedImage, error: dbError } = await supabase
      .from('idea_images')
      .insert(imageData)
      .select()
      .single()

    if (dbError) {
      console.error('Database insert error:', dbError)
      return NextResponse.json({ error: 'Failed to save image metadata' }, { status: 500 })
    }

    return NextResponse.json({ 
      success: true, 
      image: savedImage,
      url: publicUrl 
    })

  } catch (error) {
    console.error('Image import error:', error)
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 })
  }
}
