import { NextRequest, NextResponse } from 'next/server'
import { createClient } from '@supabase/supabase-js'
import { createRouteSupabaseClient, getRouteAuthUser } from '@/lib/supabase-route'
import { CREATIVE_CHAT_SYSTEM_PROMPT } from '@/lib/creative-chat-prompt'
import { detectImageRequest, buildImagePromptInstruction, buildImagePromptText, shouldReuseLastGeneratedImageAsReference, detectSceneImportRequest, extractImportedSceneFromThread, parseSceneFields, detectMultiImageRequest, extractScreenplayLocationSluglines, buildLocationImagePromptsFromSluglines, pickSluglinesForImageBatch, type StoryImageContext } from '@/lib/creative-chat-utils'
import {
  mapDisplayModelToService,
  normalizeDisplayModelToApiId,
  displayModelSupportsReferenceImage,
  DEFAULT_CINEMATIC_IMAGE_WIDTH,
  DEFAULT_CINEMATIC_IMAGE_HEIGHT,
} from '@/lib/image-model-utils'
import type { AIMessage, AISettingsMap } from '@/lib/ai-chat-types'
import {
  CREATIVE_AI_DOCUMENT_TEXT_LIMIT,
  truncateDocumentText,
} from '@/lib/creative-workspace-import'
import { syncSceneTextToProjectAsset, syncSceneTextToScreenplayScene, syncCombinedScreenplayToProjectAsset } from '@/lib/creative-workspace-assets'
import { logApiCostFromRequest } from '@/lib/api-cost-tracker'

export const maxDuration = 120

type RouteContext = { params: Promise<{ id: string }> }

type AIResult = { content: string; model?: string; inputTokens?: number; outputTokens?: number } | { error: string }

function mapSettings(settingsData: { setting_key: string; setting_value: string }[]): AISettingsMap {
  const settings: AISettingsMap = {}
  for (const setting of settingsData || []) {
    settings[setting.setting_key] = setting.setting_value
  }
  return settings
}

type AttachmentContext = {
  imageUrls: string[]
  documentTexts: { name: string; text: string }[]
  unreadableDocuments: string[]
}

function getArtifactDisplayName(artifact: {
  title: string
  metadata: Record<string, unknown>
}): string {
  return typeof artifact.metadata?.originalName === 'string'
    ? artifact.metadata.originalName
    : artifact.title
}

function getArtifactExtractedText(artifact: {
  content: string | null
  metadata: Record<string, unknown>
}): string | null {
  if (typeof artifact.metadata?.extractedText === 'string' && artifact.metadata.extractedText.trim()) {
    return artifact.metadata.extractedText.trim()
  }
  if (artifact.content && !artifact.content.startsWith('http')) {
    return artifact.content.trim()
  }
  return null
}

function buildAttachmentSummary(names: string[]): string {
  if (names.length === 0) return ''
  return `\n\n[Attached: ${names.join(', ')}]`
}

function appendAttachmentContext(content: string, attachments: AttachmentContext): string {
  let enriched = content
  if (attachments.documentTexts.length > 0) {
    const docs = attachments.documentTexts
      .map((doc) => `--- ${doc.name} ---\n${doc.text}`)
      .join('\n\n')
    enriched = `${enriched}\n\nAttached document content:\n${docs}`
  }
  if (attachments.unreadableDocuments.length > 0) {
    enriched = `${enriched}\n\n[Could not read text from: ${attachments.unreadableDocuments.join(', ')}]`
  }
  return enriched
}

function buildAttachmentSystemPrompt(attachments: AttachmentContext): string {
  const lines = [
  'The user attached files to this message.',
  'Use ONLY the attached document text and images provided below.',
  'Do not invent or assume document titles, characters, or plot details that are not in the attached content.',
  'If document text is missing, say you could not read the file and ask the user to try again or paste the text.',
  ]

  if (attachments.documentTexts.length > 0) {
    lines.push('The full extracted document text is included in the user message under "Attached document content".')
  }

  if (attachments.imageUrls.length > 0) {
    lines.push('Attached images are included for visual analysis.')
  }

  return lines.join(' ')
}

async function callOpenAI(
  messages: AIMessage[],
  settings: AISettingsMap,
  attachmentContext?: AttachmentContext,
): Promise<AIResult> {
  const openaiKey = settings['openai_api_key']?.trim()
  const model = settings['openai_model']?.trim() || 'gpt-4o-mini'
  if (!openaiKey) {
    return { error: 'OpenAI API key is not configured' }
  }

  try {
    const imageUrls = attachmentContext?.imageUrls || []
    const formattedMessages = messages.map((msg, index) => {
      const isLastUserMessage =
        index === messages.length - 1 && msg.role === 'user' && imageUrls.length > 0
      if (isLastUserMessage) {
        return {
          role: msg.role,
          content: [
            { type: 'text', text: msg.content },
            ...imageUrls.map((url) => ({
              type: 'image_url',
              image_url: { url },
            })),
          ],
        }
      }
      return { role: msg.role, content: msg.content }
    })

    const isGPT5Model = model.startsWith('gpt-5')
    const requestBody: Record<string, unknown> = {
      model,
      messages: formattedMessages,
    }

    if (isGPT5Model) {
      requestBody.max_completion_tokens = 6000
      requestBody.reasoning_effort = 'none'
      requestBody.verbosity = 'medium'
    } else {
      requestBody.max_tokens = 4000
      requestBody.temperature = 0.7
    }

    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${openaiKey}`,
      },
      body: JSON.stringify(requestBody),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Creative workspace OpenAI error:', response.status, errorText)
      let message = `OpenAI request failed (${response.status})`
      try {
        const parsed = JSON.parse(errorText) as { error?: { message?: string } }
        if (parsed.error?.message) message = parsed.error.message
      } catch {
        // keep default message
      }
      if (imageUrls.length > 0) {
        console.warn('Creative workspace OpenAI vision failed, retrying without attached images:', message)
        return callOpenAI(messages, settings)
      }
      return { error: message }
    }

    const data = await response.json()
    const content = data?.choices?.[0]?.message?.content?.trim()
    if (!content) {
      console.error('Creative workspace OpenAI returned empty content:', JSON.stringify(data).slice(0, 500))
      return { error: 'OpenAI returned an empty response' }
    }

    return {
      content,
      model,
      inputTokens: data?.usage?.prompt_tokens,
      outputTokens: data?.usage?.completion_tokens,
    }
  } catch (error) {
    console.error('Creative workspace OpenAI call failed:', error)
    return { error: error instanceof Error ? error.message : 'OpenAI request failed' }
  }
}

async function callAnthropic(
  messages: AIMessage[],
  settings: AISettingsMap,
  systemPrompt: string,
): Promise<AIResult> {
  const anthropicKey = settings['anthropic_api_key']?.trim()
  const model = settings['anthropic_model']?.trim() || 'claude-3-5-sonnet-20241022'
  if (!anthropicKey) {
    return { error: 'Anthropic API key is not configured' }
  }

  try {
    const anthropicMessages = messages
      .filter((m) => m.role !== 'system')
      .map((m) => ({ role: m.role as 'user' | 'assistant', content: m.content }))

    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': anthropicKey,
        'anthropic-version': '2023-06-01',
      },
      body: JSON.stringify({
        model,
        max_tokens: 4000,
        system: systemPrompt,
        messages: anthropicMessages,
      }),
    })

    if (!response.ok) {
      const errorText = await response.text()
      console.error('Creative workspace Anthropic error:', response.status, errorText)
      let message = `Anthropic request failed (${response.status})`
      try {
        const parsed = JSON.parse(errorText) as { error?: { message?: string } }
        if (parsed.error?.message) message = parsed.error.message
      } catch {
        // keep default message
      }
      return { error: message }
    }

    const data = await response.json()
    const content = data?.content?.[0]?.text?.trim()
    if (!content) {
      return { error: 'Anthropic returned an empty response' }
    }

    return {
      content,
      model,
      inputTokens: data?.usage?.input_tokens,
      outputTokens: data?.usage?.output_tokens,
    }
  } catch (error) {
    console.error('Creative workspace Anthropic call failed:', error)
    return { error: error instanceof Error ? error.message : 'Anthropic request failed' }
  }
}

async function getImageModelSettings(
  serviceSupabase: ReturnType<typeof createClient>,
): Promise<{ displayModel: string; apiModel: string; service: string }> {
  const { data } = await serviceSupabase
    .from('ai_settings')
    .select('locked_model, selected_model, is_locked')
    .eq('tab_type', 'images')
    .is('user_id', null)
    .maybeSingle()

  const displayModel =
    data?.is_locked && data.locked_model
      ? data.locked_model
      : data?.selected_model || data?.locked_model || 'DALL-E 3'

  return {
    displayModel,
    apiModel: normalizeDisplayModelToApiId(displayModel),
    service: mapDisplayModelToService(displayModel),
  }
}

async function generateImageFromConversation(
  request: NextRequest,
  userId: string,
  imagePrompt: string,
  serviceSupabase: ReturnType<typeof createClient>,
  options?: {
    referenceImageUrl?: string
    styleReferenceUrls?: string[]
  },
): Promise<{ url: string | null; error?: string }> {
  const { displayModel, apiModel, service } = await getImageModelSettings(serviceSupabase)
  let resolvedApiModel = apiModel
  let resolvedService = service
  if (
    options?.referenceImageUrl &&
    resolvedService !== 'runway' &&
    !displayModelSupportsReferenceImage(displayModel)
  ) {
    resolvedApiModel = 'gpt-image-2'
    resolvedService = 'dalle'
  }

  const origin = request.nextUrl.origin
  const response = await fetch(`${origin}/api/ai/generate-image`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      cookie: request.headers.get('cookie') || '',
      'x-cost-source': 'workspace',
    },
    body: JSON.stringify({
      prompt: imagePrompt,
      service: resolvedService,
      apiKey: 'configured',
      userId,
      model: resolvedApiModel,
      costSource: 'workspace',
      width: DEFAULT_CINEMATIC_IMAGE_WIDTH,
      height: DEFAULT_CINEMATIC_IMAGE_HEIGHT,
      autoSaveToBucket: true,
      ...(options?.referenceImageUrl
        ? { referenceImageUrl: options.referenceImageUrl }
        : {}),
      ...(options?.styleReferenceUrls?.length
        ? { styleReferenceUrls: options.styleReferenceUrls }
        : {}),
    }),
  })

  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    return { url: null, error: data.error || `Image generation failed (${response.status})` }
  }
  return { url: data.bucketUrl || data.imageUrl || data.url || data.image || null }
}

async function loadStoryContextForImages(
  supabase: Awaited<ReturnType<typeof createRouteSupabaseClient>>,
  workspaceId: string,
  userId: string,
  projectId: string | null,
  attachmentContext: AttachmentContext,
): Promise<StoryImageContext | null> {
  const parts: string[] = []
  const seen = new Set<string>()

  const addText = (label: string, text: string) => {
    const trimmed = text.trim()
    if (!trimmed) return
    const key = trimmed.slice(0, 200)
    if (seen.has(key)) return
    seen.add(key)
    parts.push(`--- ${label} ---\n${truncateDocumentText(trimmed, 10000)}`)
  }

  for (const doc of attachmentContext.documentTexts) {
    addText(doc.name, doc.text)
  }

  const { data: docArtifacts } = await supabase
    .from('creative_artifacts')
    .select('title, content, metadata, artifact_type')
    .eq('workspace_id', workspaceId)
    .eq('user_id', userId)
    .in('artifact_type', ['document', 'scene', 'treatment'])
    .order('created_at', { ascending: false })
    .limit(25)

  for (const artifact of docArtifacts || []) {
    const text = getArtifactExtractedText(artifact)
    if (text) addText(getArtifactDisplayName(artifact), text)
  }

  if (projectId) {
    const { data: scenes } = await supabase
      .from('screenplay_scenes')
      .select('name, content')
      .eq('project_id', projectId)
      .eq('user_id', userId)
      .order('order_index', { ascending: true })
      .order('created_at', { ascending: true })

    const sceneText = (scenes || [])
      .filter((scene) => scene.content?.trim())
      .map((scene) => scene.content!.trim())
      .join('\n\n')

    if (sceneText) addText('Screenplay Scenes', sceneText)
  }

  const combinedText = parts.join('\n\n').trim()
  if (!combinedText) return null

  let projectName = 'Untitled Project'
  if (projectId) {
    const { data: project } = await supabase
      .from('projects')
      .select('name')
      .eq('id', projectId)
      .single()
    if (project?.name) projectName = project.name
  }

  return { combinedText: combinedText.slice(0, 20000), projectName }
}

async function extractCollageImagePrompts(
  userMessage: string,
  attachmentContext: AttachmentContext,
  history: { role: string; content: string }[],
  settings: AISettingsMap,
  storyContext: StoryImageContext | null,
  usedSluglines: string[] = [],
): Promise<{ prompts: string[]; sluglines: (string | null)[] }> {
  const isMoreRequest = /\b(more|additional|another|extra)\b/i.test(userMessage)

  if (storyContext?.combinedText) {
    const sluglines = extractScreenplayLocationSluglines(storyContext.combinedText)
    if (sluglines.length > 0) {
      const batch = pickSluglinesForImageBatch(
        sluglines,
        usedSluglines,
        isMoreRequest ? 4 : 6,
        isMoreRequest || usedSluglines.length > 0,
      )
      const prompts = buildLocationImagePromptsFromSluglines(
        batch,
        storyContext.projectName,
        batch.length,
      )
      return { prompts, sluglines: batch }
    }
  }

  const documentText = [
    ...attachmentContext.documentTexts.map((doc) => `--- ${doc.name} ---\n${doc.text}`),
    storyContext?.combinedText
      ? `--- Story / Screenplay ---\n${storyContext.combinedText.slice(0, 12000)}`
      : '',
  ]
    .filter(Boolean)
    .join('\n\n')

  const conversation = history
    .slice(-6)
    .map((m) => `${m.role === 'user' ? 'User' : 'Assistant'}: ${m.content.slice(0, 1500)}`)
    .join('\n\n')

  const prompt = `The user wants a storyboard collage of separate cinematic location images for their film.

User request: ${userMessage}
${storyContext?.projectName ? `Film title: ${storyContext.projectName}` : ''}

${documentText ? `Screenplay / story source (use ONLY these locations — do NOT invent unrelated places):\n${documentText}` : 'WARNING: No screenplay text available. Ask user to attach their script.'}

${conversation ? `Recent conversation:\n${conversation}` : ''}

List 4 to 6 DISTINCT location establishing shots from the story. Each MUST come from an INT./EXT. slugline or explicit location in the screenplay above.

Output ONLY a JSON array of strings. Each string is one complete image prompt starting with "Cinematic film still," — empty establishing shots with NO people. Max 400 chars each.

Example: ["Cinematic film still, snowy mountain highway...", "Cinematic film still, rural gas station at dusk..."]`

  const result = await callOpenAI(
    [
      { role: 'system', content: 'You output only valid JSON arrays of image prompt strings.' },
      { role: 'user', content: prompt },
    ],
    settings,
  )

  if (!('content' in result) || !result.content) return { prompts: [], sluglines: [] }

  try {
    const match = result.content.match(/\[[\s\S]*\]/)
    const parsed = JSON.parse(match?.[0] || result.content)
    if (!Array.isArray(parsed)) return { prompts: [], sluglines: [] }
    const prompts = parsed
      .filter((item): item is string => typeof item === 'string' && item.trim().length > 20)
      .map((item) => item.trim().slice(0, 500))
      .slice(0, 6)
    return { prompts, sluglines: prompts.map(() => null) }
  } catch {
    return { prompts: [], sluglines: [] }
  }
}

export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const { id } = await context.params
    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: workspace } = await supabase
      .from('creative_workspaces')
      .select('id')
      .eq('id', id)
      .eq('user_id', user.id)
      .single()

    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const { data, error } = await supabase
      .from('creative_messages')
      .select('*')
      .eq('workspace_id', id)
      .order('created_at', { ascending: true })

    if (error) return NextResponse.json({ error: error.message }, { status: 500 })
    return NextResponse.json({ messages: data || [] })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const { id: workspaceId } = await context.params
    const supabase = await createRouteSupabaseClient()
    const user = await getRouteAuthUser(supabase, request)
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

    const { data: workspace } = await supabase
      .from('creative_workspaces')
      .select('*')
      .eq('id', workspaceId)
      .eq('user_id', user.id)
      .single()

    if (!workspace) return NextResponse.json({ error: 'Workspace not found' }, { status: 404 })

    const body = await request.json()
    const { message, artifactIds, projectId: bodyProjectId } = body
    const trimmedMessage = typeof message === 'string' ? message.trim() : ''
    const resolvedProjectId =
      (typeof bodyProjectId === 'string' && bodyProjectId.trim()) ||
      workspace.project_id ||
      null
    const attachmentIds = Array.isArray(artifactIds)
      ? artifactIds.filter((id): id is string => typeof id === 'string' && id.length > 0)
      : []

    if (!trimmedMessage && attachmentIds.length === 0) {
      return NextResponse.json({ error: 'Message or attachments are required' }, { status: 400 })
    }

    let attachmentArtifacts: Array<{
      id: string
      artifact_type: string
      title: string
      content: string | null
      metadata: Record<string, unknown>
      message_id?: string | null
    }> = []

    if (attachmentIds.length > 0) {
      const { data: artifacts, error: artifactsError } = await supabase
        .from('creative_artifacts')
        .select('id, artifact_type, title, content, metadata')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .in('id', attachmentIds)

      if (artifactsError) {
        return NextResponse.json({ error: artifactsError.message }, { status: 500 })
      }

      attachmentArtifacts = artifacts || []
      if (attachmentArtifacts.length !== attachmentIds.length) {
        return NextResponse.json({ error: 'One or more attachments were not found' }, { status: 400 })
      }
    }

    const attachmentContext: AttachmentContext = {
      imageUrls: attachmentArtifacts
        .filter((a) => a.artifact_type === 'image' && a.content?.startsWith('http'))
        .map((a) => a.content as string),
      documentTexts: attachmentArtifacts
        .filter((a) => a.artifact_type === 'document')
        .map((a) => {
          const extracted = getArtifactExtractedText(a)
          return extracted
            ? {
                name: getArtifactDisplayName(a),
                text: truncateDocumentText(extracted, CREATIVE_AI_DOCUMENT_TEXT_LIMIT),
              }
            : null
        })
        .filter((doc): doc is { name: string; text: string } => !!doc),
      unreadableDocuments: attachmentArtifacts
        .filter((a) => a.artifact_type === 'document' && !getArtifactExtractedText(a))
        .map((a) => getArtifactDisplayName(a)),
    }

    const attachmentNames = attachmentArtifacts.map((a) => getArtifactDisplayName(a))
    const displayMessage = `${trimmedMessage || 'Review my attached files.'}${buildAttachmentSummary(attachmentNames)}`

    const { data: userMessage, error: userMsgError } = await supabase
      .from('creative_messages')
      .insert([{ workspace_id: workspaceId, role: 'user', content: displayMessage }])
      .select()
      .single()

    if (userMsgError) return NextResponse.json({ error: userMsgError.message }, { status: 500 })

    if (attachmentArtifacts.length > 0) {
      const { error: linkError } = await supabase
        .from('creative_artifacts')
        .update({ message_id: userMessage.id })
        .in('id', attachmentArtifacts.map((a) => a.id))

      if (linkError) return NextResponse.json({ error: linkError.message }, { status: 500 })

      attachmentArtifacts = attachmentArtifacts.map((artifact) => ({
        ...artifact,
        message_id: userMessage.id,
      }))
    }

    const { data: history } = await supabase
      .from('creative_messages')
      .select('role, content')
      .eq('workspace_id', workspaceId)
      .order('created_at', { ascending: true })

    const historyForAi =
      attachmentArtifacts.length > 0 ? (history || []).slice(-4) : (history || [])

    if (!process.env.NEXT_PUBLIC_SUPABASE_URL || !process.env.SUPABASE_SERVICE_ROLE_KEY) {
      return NextResponse.json({ error: 'Server configuration error' }, { status: 500 })
    }

    const serviceSupabase = createClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL,
      process.env.SUPABASE_SERVICE_ROLE_KEY,
    )

    const { data: settingsData, error: settingsError } = await serviceSupabase.rpc('get_system_ai_config')
    if (settingsError) return NextResponse.json({ error: 'Failed to load AI configuration' }, { status: 500 })

    const settings = mapSettings(settingsData || [])
    const wantsImage = detectImageRequest(trimmedMessage, historyForAi)
    const isSceneImport = detectSceneImportRequest(trimmedMessage)
    const hasAttachments = attachmentArtifacts.length > 0

    let assistantContent: string | null = null
    let aiError: string | null = null
    let sceneImported = false
    let sceneImportArtifact = null
    let sceneImportDebug = null

    if (isSceneImport) {
      const priorHistory = (history || []).slice(0, -1)
      const imported = extractImportedSceneFromThread(priorHistory, trimmedMessage, { collectDebug: true })

      sceneImportDebug = {
        extraction: imported.debug,
        priorHistoryCount: priorHistory.length,
        trimmedMessageChars: trimmedMessage.length,
        displayMessageChars: displayMessage.length,
        resolvedProjectId,
      }

      console.log('[scene-import] Starting import', {
        title: imported.title,
        sceneNumber: imported.sceneNumber,
        finalChars: imported.content.length,
        priorHistoryCount: priorHistory.length,
        debug: imported.debug,
      })

      const { data: sceneArtifact, error: sceneError } = await supabase
        .from('creative_artifacts')
        .insert([{
          user_id: user.id,
          workspace_id: workspaceId,
          project_id: resolvedProjectId,
          message_id: userMessage.id,
          artifact_type: 'scene',
          title: imported.title,
          content: imported.content,
          label: imported.sceneNumber ? `Scene ${imported.sceneNumber}` : 'Scene',
          metadata: {
            imported: true,
            import_source: 'chat_paste',
            scene_number: imported.sceneNumber,
            verbatim: true,
            character_count: imported.content.length,
          },
        }])
        .select()
        .single()

      if (sceneError) {
        return NextResponse.json({ error: sceneError.message }, { status: 500 })
      }

      const { data: verifyArtifact } = await supabase
        .from('creative_artifacts')
        .select('content')
        .eq('id', sceneArtifact.id)
        .single()

      sceneImportDebug = {
        ...sceneImportDebug,
        artifactStoredChars: verifyArtifact?.content?.length ?? null,
        artifactMatchesExtracted:
          verifyArtifact?.content?.length === imported.content.length,
      }

      console.log('[scene-import] Artifact stored', {
        extractedChars: imported.content.length,
        storedChars: verifyArtifact?.content?.length,
        matches: verifyArtifact?.content === imported.content,
      })

      sceneImportArtifact = sceneArtifact
      sceneImported = true

      if (resolvedProjectId && sceneArtifact) {
        const parsedScene = parseSceneFields(imported.content, imported.title)
        const screenplaySync = await syncSceneTextToScreenplayScene({
          supabase,
          userId: user.id,
          projectId: resolvedProjectId,
          workspaceId,
          artifactId: sceneArtifact.id,
          title: imported.title,
          content: imported.content,
          sceneNumber: imported.sceneNumber,
          location: parsedScene.location,
          characters: parsedScene.characters,
        })
        const screenplaySceneId = screenplaySync.sceneId

        sceneImportDebug = {
          ...sceneImportDebug,
          screenplaySync: screenplaySync.debug,
        }

        console.log('[scene-import] Screenplay sync', screenplaySync.debug)

        const assetId = await syncSceneTextToProjectAsset({
          supabase,
          userId: user.id,
          projectId: resolvedProjectId,
          workspaceId,
          artifactId: sceneArtifact.id,
          title: imported.title,
          content: imported.content,
          sceneNumber: imported.sceneNumber,
        })

        const combinedAssetId = await syncCombinedScreenplayToProjectAsset({
          supabase,
          userId: user.id,
          projectId: resolvedProjectId,
          workspaceId,
        })

        sceneImportDebug = {
          ...sceneImportDebug,
          combinedAssetId,
          combinedAssetChars: combinedAssetId
            ? (await supabase
                .from('assets')
                .select('content')
                .eq('id', combinedAssetId)
                .single()).data?.content?.length ?? null
            : null,
        }

        if (assetId || screenplaySceneId) {
          const metadata = {
            ...(sceneArtifact.metadata || {}),
            ...(assetId ? { asset_id: assetId, synced_to_project: true } : {}),
            ...(screenplaySceneId ? { screenplay_scene_id: screenplaySceneId } : {}),
            ...(sceneImportDebug ? { import_debug: sceneImportDebug } : {}),
          }
          await supabase
            .from('creative_artifacts')
            .update({ metadata })
            .eq('id', sceneArtifact.id)
          sceneImportArtifact = { ...sceneArtifact, metadata }
        }
      }

      const savedWhere = resolvedProjectId
        ? 'Scenes tab, Assets tab, and your movie screenplay'
        : 'workspace — link a movie project to also save it to movie scenes and assets'
      assistantContent =
        `Imported your full scene verbatim (${imported.content.length.toLocaleString()} characters) as "${imported.title}". ` +
        `Every line of dialogue and action was saved exactly as you pasted it — nothing was shortened or rewritten. ` +
        `Open the ${savedWhere} to view the complete scene text.`
    } else {
      const systemPrompt = wantsImage
        ? `${CREATIVE_CHAT_SYSTEM_PROMPT}\n\nThe user is asking for an image right now. Keep your reply brief (1-2 sentences). Confirm what you're visualizing and that the image will appear in the Images panel. Do not explain how to find images elsewhere or say you cannot create images.`
        : hasAttachments
          ? `${CREATIVE_CHAT_SYSTEM_PROMPT}\n\n${buildAttachmentSystemPrompt(attachmentContext)}`
          : CREATIVE_CHAT_SYSTEM_PROMPT

      const historyMessages = historyForAi.map((m) => ({
        role: m.role as AIMessage['role'],
        content:
          m.role === 'user' && m.content === displayMessage
            ? appendAttachmentContext(trimmedMessage || 'Review my attached files.', attachmentContext)
            : m.content,
      }))

      const aiMessages: AIMessage[] = [
        { role: 'system', content: systemPrompt },
        ...historyMessages,
      ]

      const openaiResult = await callOpenAI(
        aiMessages,
        settings,
        wantsImage ? undefined : attachmentContext,
      )
      if ('content' in openaiResult) {
        assistantContent = openaiResult.content
        await logApiCostFromRequest({
          request,
          userId: user.id,
          fallbackSource: 'workspace',
          generationType: 'chat',
          provider: 'openai',
          model: openaiResult.model || settings['openai_model'] || 'gpt-4o-mini',
          prompt: trimmedMessage,
          inputTokens: openaiResult.inputTokens,
          outputTokens: openaiResult.outputTokens,
          inputText: trimmedMessage,
          outputText: openaiResult.content,
        })
      } else {
        aiError = openaiResult.error
        const anthropicResult = await callAnthropic(aiMessages, settings, systemPrompt)
        if ('content' in anthropicResult) {
          assistantContent = anthropicResult.content
          aiError = null
          await logApiCostFromRequest({
            request,
            userId: user.id,
            fallbackSource: 'workspace',
            generationType: 'chat',
            provider: 'anthropic',
            model: anthropicResult.model || settings['anthropic_model'] || 'claude-3-5-sonnet-20241022',
            prompt: trimmedMessage,
            inputTokens: anthropicResult.inputTokens,
            outputTokens: anthropicResult.outputTokens,
            inputText: trimmedMessage,
            outputText: anthropicResult.content,
          })
        } else {
          aiError = anthropicResult.error || aiError
        }
      }

      if (!assistantContent) {
        if (wantsImage) {
          assistantContent = attachmentContext.imageUrls.length > 0
            ? "I'll generate that from your attached photo. It will appear in the Images panel."
            : "I'll generate that image now. It will appear in the Images panel."
        } else {
          await supabase.from('creative_messages').delete().eq('id', userMessage.id)
          if (attachmentArtifacts.length > 0) {
            await supabase
              .from('creative_artifacts')
              .update({ message_id: null })
              .in('id', attachmentArtifacts.map((a) => a.id))
          }

          return NextResponse.json(
            {
              error: aiError || 'AI service unavailable. Try a shorter document or send your request in smaller parts.',
            },
            { status: 503 },
          )
        }
      }
    }

    assistantContent = assistantContent!.replace(/\*\*(.*?)\*\*/g, '$1')

    const { data: assistantMessage, error: assistantError } = await supabase
      .from('creative_messages')
      .insert([{ workspace_id: workspaceId, role: 'assistant', content: assistantContent }])
      .select()
      .single()

    if (assistantError) return NextResponse.json({ error: assistantError.message }, { status: 500 })

    let imageGenerated = false
    let artifact = null
    let imageArtifacts: Array<Record<string, unknown>> = []
    let imageGenerationError: string | null = null
    let imageContextUsed = false

    if (wantsImage) {
      const wantsMultiImage = detectMultiImageRequest(trimmedMessage, historyForAi)
      const storyContext = await loadStoryContextForImages(
        supabase,
        workspaceId,
        user.id,
        resolvedProjectId,
        attachmentContext,
      )
      imageContextUsed = !!storyContext?.combinedText

      const { data: existingImageArtifacts } = await supabase
        .from('creative_artifacts')
        .select('content, metadata, created_at')
        .eq('workspace_id', workspaceId)
        .eq('user_id', user.id)
        .eq('artifact_type', 'image')
        .order('created_at', { ascending: false })

      const usedSluglines = (existingImageArtifacts || [])
        .map((artifact) =>
          typeof artifact.metadata?.slugline === 'string' ? artifact.metadata.slugline : null,
        )
        .filter((slugline): slugline is string => !!slugline)

      let imagePrompts: string[] = []
      let promptSluglines: (string | null)[] = []

      if (wantsMultiImage) {
        const collage = await extractCollageImagePrompts(
          trimmedMessage,
          attachmentContext,
          historyForAi,
          settings,
          storyContext,
          usedSluglines,
        )
        imagePrompts = collage.prompts
        promptSluglines = collage.sluglines
      }

      if (imagePrompts.length === 0) {
        let promptInstruction = buildImagePromptInstruction(historyForAi, trimmedMessage, storyContext ?? undefined)
        if (attachmentContext.imageUrls.length > 0) {
          promptInstruction += `\n\nThe user attached a reference photo. Write the prompt so the generated image uses that person's likeness. If they asked for parents, family, or related people, those people should clearly resemble the person in the photo.`
        } else if (shouldReuseLastGeneratedImageAsReference(trimmedMessage, historyForAi)) {
          promptInstruction += `\n\nThe previous generated image will be attached as the reference. Keep that exact art style and the same character identity. If the previous image was 3D, stylized, or animated, do NOT convert it to photoreal live-action. Isolate only the requested person.`
        }
        const imagePromptMessages: AIMessage[] = [
          { role: 'system', content: 'You write cinematic image prompts grounded in the screenplay. Output only the prompt text.' },
          { role: 'user', content: promptInstruction },
        ]

        let imagePrompt: string | null = null
        const imagePromptOpenAI = await callOpenAI(imagePromptMessages, settings)
        if ('content' in imagePromptOpenAI) {
          imagePrompt = imagePromptOpenAI.content
        } else {
          const imagePromptAnthropic = await callAnthropic(
            imagePromptMessages,
            settings,
            'You write cinematic image prompts grounded in the screenplay. Output only the prompt text.',
          )
          if ('content' in imagePromptAnthropic) {
            imagePrompt = imagePromptAnthropic.content
          }
        }

        if (!imagePrompt) {
          imagePrompt = buildImagePromptText(historyForAi, trimmedMessage, storyContext ?? undefined)
        }
        imagePrompts = [imagePrompt]
        promptSluglines = [null]
      }

      const lastGeneratedImageUrl = (existingImageArtifacts || []).find(
        (artifact) => typeof artifact.content === 'string' && /^https?:\/\//.test(artifact.content),
      )?.content as string | undefined
      const reusePreviousImage =
        attachmentContext.imageUrls.length === 0 &&
        !!lastGeneratedImageUrl &&
        shouldReuseLastGeneratedImageAsReference(trimmedMessage, historyForAi)
      const referenceImageUrl = attachmentContext.imageUrls[0] || (reusePreviousImage ? lastGeneratedImageUrl : undefined)
      const styleReferenceUrls = attachmentContext.imageUrls.slice(1)

      for (let i = 0; i < imagePrompts.length; i++) {
        const basePrompt = imagePrompts[i]
        const imagePrompt = referenceImageUrl
          ? reusePreviousImage
            ? `${basePrompt} Edit the attached previous image. Keep the exact same art style and the same character. If it was 3D or stylized animation, keep it 3D/stylized — do not make it photoreal or live-action. Isolate only the requested person.`.slice(0, 990)
            : `${basePrompt} Use the attached reference photo for likeness. Keep recognizable facial features, ethnicity, and coloring from the reference.`.slice(0, 990)
          : basePrompt
        const slugline = promptSluglines[i] ?? null
        const generated = await generateImageFromConversation(
          request,
          user.id,
          imagePrompt,
          serviceSupabase,
          {
            referenceImageUrl,
            styleReferenceUrls,
          },
        )

        if (!generated.url) {
          imageGenerationError = generated.error || 'Image generation failed'
          continue
        }

        const { data: newArtifact } = await supabase
          .from('creative_artifacts')
          .insert([{
            user_id: user.id,
            workspace_id: workspaceId,
            artifact_type: 'image',
            title: imagePrompts.length > 1
              ? `Storyboard ${i + 1} - ${new Date().toLocaleDateString()}`
              : `Image - ${new Date().toLocaleDateString()}`,
            content: generated.url,
            message_id: assistantMessage.id,
            label: imagePrompts.length > 1 ? `Location ${i + 1}` : null,
            metadata: {
              prompt: imagePrompt.slice(0, 500),
              slugline: slugline ?? undefined,
              collageIndex: imagePrompts.length > 1 ? i + 1 : undefined,
              auto_generated: true,
              collage_index: imagePrompts.length > 1 ? i + 1 : null,
              collage_total: imagePrompts.length > 1 ? imagePrompts.length : null,
            },
          }])
          .select()
          .single()

        if (newArtifact) {
          imageArtifacts.push(newArtifact)
          artifact = newArtifact
          imageGenerated = true
        }
      }
    }

    await supabase
      .from('creative_workspaces')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', workspaceId)

    return NextResponse.json({
      userMessage,
      assistantMessage,
      imageGenerated,
      artifact,
      imageArtifacts,
      imageGenerationError,
      wantsImage,
      imageContextUsed,
      attachmentArtifacts,
      sceneImported,
      sceneImportArtifact,
      sceneImportDebug,
    })
  } catch (error) {
    return NextResponse.json(
      { error: error instanceof Error ? error.message : 'Internal server error' },
      { status: 500 },
    )
  }
}
