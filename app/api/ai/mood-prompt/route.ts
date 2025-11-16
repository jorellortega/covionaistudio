import { NextRequest, NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'

type Scope = 'movie' | 'scene' | 'shot' | 'treatment'

function buildPromptFromProject(project: any) {
  const parts: string[] = []
  if (project?.name) parts.push(`Film: ${project.name}`)
  if (project?.genre) parts.push(`Genre: ${project.genre}`)
  if (project?.description) parts.push(`Premise: ${project.description}`)
  return `Cinematic mood board image reflecting the project's core tone. ${parts.join('. ')}. Rich film look, cohesive color palette, lighting-driven composition, production design cues.`
}

function buildPromptFromScene(scene: any) {
  const md = scene?.metadata || {}
  const parts: string[] = []
  if (scene?.name) parts.push(`Scene: ${scene.name}`)
  if (scene?.description) parts.push(`Description: ${scene.description}`)
  if (md.sceneNumber) parts.push(`Scene Number: ${md.sceneNumber}`)
  if (md.location) parts.push(`Location: ${md.location}`)
  if (md.mood) parts.push(`Mood: ${md.mood}`)
  if (md.shotType) parts.push(`Shot Type: ${md.shotType}`)
  if (Array.isArray(md.characters) && md.characters.length) parts.push(`Characters: ${md.characters.join(', ')}`)
  return `Cinematic mood image for this scene. ${parts.join('. ')}. Emphasize lighting, color grading, lensing, production design and atmosphere.`
}

function buildPromptFromShot(storyboard: any) {
  const parts: string[] = []
  if (storyboard?.title) parts.push(`Shot: ${storyboard.title}`)
  if (storyboard?.description) parts.push(`Description: ${storyboard.description}`)
  if (storyboard?.shot_type) parts.push(`Shot Type: ${storyboard.shot_type}`)
  if (storyboard?.camera_angle) parts.push(`Angle: ${storyboard.camera_angle}`)
  if (storyboard?.movement) parts.push(`Camera Movement: ${storyboard.movement}`)
  if (storyboard?.visual_notes) parts.push(`Visual Notes: ${storyboard.visual_notes}`)
  return `Cinematic mood frame for this shot. ${parts.join('. ')}. Strong composition, realistic lighting, coherent palette, cinematic depth.`
}

function buildPromptFromTreatment(treatment: any) {
  const parts: string[] = []
  if (treatment?.name) parts.push(`Treatment: ${treatment.name}`)
  if (treatment?.genre) parts.push(`Genre: ${treatment.genre}`)
  if (treatment?.synopsis) parts.push(`Synopsis: ${treatment.synopsis}`)
  if (treatment?.prompt) parts.push(`Highlights: ${String(treatment.prompt).slice(0, 240)}...`)
  return `Cinematic mood image aligned with the treatment's tone. ${parts.join('. ')}. Emphasize cohesive palette, lighting, production design motifs.`
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { scope, id } = body as { scope: Scope; id: string }
    if (!scope || !id) {
      return NextResponse.json({ error: 'Missing scope or id' }, { status: 400 })
    }

    // Use a cookies adapter compatible with Next.js dynamic cookies API
    const cookieStore = await cookies()
    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          get(name: string) {
            return cookieStore.get(name)?.value
          },
          set(name: string, value: string, options?: any) {
            try {
              cookieStore.set(name, value, options)
            } catch {
              // In API routes, set may be unsupported during streaming; ignore
            }
          },
          remove(name: string, options?: any) {
            try {
              cookieStore.set(name, '', { ...options, maxAge: 0 })
            } catch {
              // Ignore
            }
          },
        },
      }
    )

    let prompt = ''

    if (scope === 'movie') {
      const { data, error } = await supabase
        .from('projects')
        .select('id, name, description, genre, project_type')
        .eq('id', id)
        .eq('project_type', 'movie')
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 400 })
      prompt = buildPromptFromProject(data)
    } else if (scope === 'scene') {
      const { data, error } = await supabase
        .from('scenes')
        .select('id, name, description, metadata')
        .eq('id', id)
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 400 })
      prompt = buildPromptFromScene(data)
    } else if (scope === 'shot') {
      const { data, error } = await supabase
        .from('storyboards')
        .select('id, title, description, shot_type, camera_angle, movement, visual_notes')
        .eq('id', id)
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 400 })
      prompt = buildPromptFromShot(data)
    } else if (scope === 'treatment') {
      const { data, error } = await supabase
        .from('treatments')
        .select('id, name, genre, synopsis, prompt')
        .eq('id', id)
        .single()
      if (error) return NextResponse.json({ error: error.message }, { status: error.code === 'PGRST116' ? 404 : 400 })
      prompt = buildPromptFromTreatment(data)
    }

    return NextResponse.json({ success: true, prompt })
  } catch (e: any) {
    console.error('mood-prompt error:', e)
    return NextResponse.json({ error: e?.message || 'Failed to generate mood prompt' }, { status: 500 })
  }
}


