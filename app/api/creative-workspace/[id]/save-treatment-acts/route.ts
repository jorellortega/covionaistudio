import { NextRequest, NextResponse } from 'next/server'
import { createRouteSupabaseClient, getRouteAuthUser } from '@/lib/supabase-route'
import { parseTreatmentActs, parseTreatmentFields } from '@/lib/creative-chat-utils'
import { syncTreatmentActs } from '@/lib/sync-treatment-acts'

type RouteContext = { params: Promise<{ id: string }> }

function stripWrappingQuotes(value: string): string {
  return value.trim().replace(/^["'“”‘’«»]+|["'“”‘’«»]+$/g, '').trim()
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: workspaceId } = await context.params
    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: workspace } = await supabase
      .from('creative_workspaces')
      .select('id, title, project_id')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const body = await request.json()
    const { prompt, projectId, messageId, title } = body

    if (!prompt || typeof prompt !== 'string') {
      return NextResponse.json({ error: 'Act content is required' }, { status: 400 })
    }

    const parsedActs = parseTreatmentActs(prompt)
    if (parsedActs.length === 0) {
      return NextResponse.json(
        { error: 'No acts found. Use headers like "Act 1:", "Act 2:", "Act 3:" on separate lines.' },
        { status: 400 },
      )
    }

    const resolvedProjectId = projectId || workspace.project_id || null
    const parsed = parseTreatmentFields(prompt, workspace.title)
    const treatmentTitle = stripWrappingQuotes(title?.trim() || parsed.title || workspace.title || 'Untitled Treatment')

    let treatmentId: string | null = null
    let actArtifacts: Array<Record<string, unknown>> = []

    if (resolvedProjectId) {
      const { data: existingTreatment } = await supabase
        .from('treatments')
        .select('id')
        .eq('project_id', resolvedProjectId)
        .eq('user_id', user.id)
        .order('updated_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      let treatment
      if (existingTreatment) {
        treatment = existingTreatment
      } else {
        const { data, error } = await supabase
          .from('treatments')
          .insert([{
            user_id: user.id,
            title: treatmentTitle,
            genre: stripWrappingQuotes(parsed.genre || 'Unspecified'),
            logline: stripWrappingQuotes(parsed.logline || '') || null,
            synopsis: stripWrappingQuotes(parsed.synopsis || '') || null,
            prompt: prompt.trim(),
            project_id: resolvedProjectId,
            status: 'draft',
          }])
          .select('id')
          .single()

        if (error) return NextResponse.json({ error: error.message }, { status: 500 })
        treatment = data
      }

      treatmentId = treatment.id

      try {
        const syncResult = await syncTreatmentActs({
          supabase,
          userId: user.id,
          workspaceId,
          treatmentId,
          projectId: resolvedProjectId,
          treatmentTitle,
          prompt: prompt.trim(),
          messageId: messageId || null,
        })
        actArtifacts = syncResult.actArtifacts
      } catch (syncError) {
        const message = syncError instanceof Error ? syncError.message : 'Failed to sync acts'
        if (!message.includes('treatment_acts')) {
          return NextResponse.json({ error: message }, { status: 500 })
        }

        actArtifacts = await saveWorkspaceActArtifactsOnly({
          supabase,
          userId: user.id,
          workspaceId,
          messageId: messageId || null,
          projectId: resolvedProjectId,
          treatmentId,
          treatmentTitle,
          parsedActs,
        })
      }

      await supabase
        .from('creative_workspaces')
        .update({ project_id: resolvedProjectId, updated_at: new Date().toISOString() })
        .eq('id', workspaceId)
    } else {
      actArtifacts = await saveWorkspaceActArtifactsOnly({
        supabase,
        userId: user.id,
        workspaceId,
        messageId: messageId || null,
        projectId: null,
        treatmentId: null,
        treatmentTitle,
        parsedActs,
      })
    }

    return NextResponse.json({
      success: true,
      acts: parsedActs,
      actArtifacts,
      treatmentId,
      projectId: resolvedProjectId,
      count: parsedActs.length,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

async function saveWorkspaceActArtifactsOnly({
  supabase,
  userId,
  workspaceId,
  messageId,
  projectId,
  treatmentId,
  treatmentTitle,
  parsedActs,
}: {
  supabase: Awaited<ReturnType<typeof createRouteSupabaseClient>>
  userId: string
  workspaceId: string
  messageId: string | null
  projectId: string | null
  treatmentId: string | null
  treatmentTitle: string
  parsedActs: ReturnType<typeof parseTreatmentActs>
}) {
  if (messageId) {
    await supabase
      .from('creative_artifacts')
      .delete()
      .eq('workspace_id', workspaceId)
      .eq('message_id', messageId)
      .eq('artifact_type', 'treatment_act')
  }

  const actArtifacts: Array<Record<string, unknown>> = []

  for (const act of parsedActs) {
    const { data: actArtifact, error } = await supabase
      .from('creative_artifacts')
      .insert({
        user_id: userId,
        workspace_id: workspaceId,
        message_id: messageId,
        artifact_type: 'treatment_act',
        title: `${treatmentTitle} — ${act.title}`,
        label: act.title,
        content: act.content,
        project_id: projectId,
        metadata: {
          ...(treatmentId ? { treatment_id: treatmentId } : {}),
          act_number: act.actNumber,
          workspace_only: !treatmentId,
        },
      })
      .select()
      .single()

    if (error || !actArtifact) {
      throw new Error(error?.message || 'Failed to save act to workspace')
    }
    actArtifacts.push(actArtifact)
  }

  return actArtifacts
}
