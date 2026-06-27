/** Runway ML API model catalog — sync with https://docs.dev.runwayml.com */

export type RunwayTaskType =
  | "text_to_image"
  | "text_to_video"
  | "image_to_video"
  | "video_to_video"
  | "character_performance"
  | "video_upscale"

export type RunwayModelDef = {
  id: string
  label: string
  task: RunwayTaskType
  description: string
  creditsHint: string
  requiresImage?: boolean
  requiresVideo?: boolean
  requiresReferenceVideo?: boolean
  supportsTextOnly?: boolean
  isNew?: boolean
}

export const RUNWAY_RATIOS = [
  { value: "1280:720", label: "16:9 HD (1280×720)" },
  { value: "1920:1080", label: "16:9 Full HD" },
  { value: "1080:1920", label: "9:16 Vertical" },
  { value: "1024:1024", label: "1:1 Square" },
  { value: "1080:1080", label: "1:1 (1080)" },
  { value: "1440:1080", label: "4:3 Landscape" },
  { value: "1080:1440", label: "4:3 Portrait" },
  { value: "720:1280", label: "9:16 (720p)" },
  { value: "1360:768", label: "16:9 Wide" },
  { value: "2112:912", label: "Cinematic ultra-wide" },
] as const

export const RUNWAY_IMAGE_MODELS: RunwayModelDef[] = [
  {
    id: "gen4_image",
    label: "Gen-4 Image",
    task: "text_to_image",
    description: "High-quality text-to-image. 720p or 1080p.",
    creditsHint: "5–8 credits / image",
    supportsTextOnly: true,
  },
  {
    id: "gen4_image_turbo",
    label: "Gen-4 Image Turbo",
    task: "text_to_image",
    description: "Up to 3 reference images + text. Use @reference, @linked, @extra in prompt.",
    creditsHint: "2 credits / image",
    requiresImage: true,
    supportsTextOnly: false,
  },
  {
    id: "gemini_2.5_flash",
    label: "Gemini 2.5 Flash",
    task: "text_to_image",
    description: "Fast Google-powered image generation via Runway.",
    creditsHint: "5 credits / image",
    supportsTextOnly: true,
  },
  {
    id: "gemini_3_pro",
    label: "Gemini 3 Pro",
    task: "text_to_image",
    description: "Higher-quality Gemini image model on Runway.",
    creditsHint: "5 credits / image",
    supportsTextOnly: true,
    isNew: true,
  },
]

export const RUNWAY_TEXT_TO_VIDEO_MODELS: RunwayModelDef[] = [
  {
    id: "gen4.5",
    label: "Gen-4.5",
    task: "text_to_video",
    description: "Best balance of quality and control. Text and/or optional image.",
    creditsHint: "12 credits / sec",
    supportsTextOnly: true,
    isNew: true,
  },
  {
    id: "veo3.1",
    label: "Veo 3.1",
    task: "text_to_video",
    description: "Google Veo — high fidelity cinematic video.",
    creditsHint: "20–40 credits / sec",
    supportsTextOnly: true,
    isNew: true,
  },
  {
    id: "veo3.1_fast",
    label: "Veo 3.1 Fast",
    task: "text_to_video",
    description: "Faster Veo variant for quick iterations.",
    creditsHint: "10–15 credits / sec",
    supportsTextOnly: true,
    isNew: true,
  },
  {
    id: "veo3",
    label: "Veo 3",
    task: "text_to_video",
    description: "Premium Google video model.",
    creditsHint: "40 credits / sec",
    supportsTextOnly: true,
  },
  {
    id: "seedance2",
    label: "Seedance 2",
    task: "text_to_video",
    description: "Long-form capable; supports text, image, and video references.",
    creditsHint: "36 credits / sec",
    supportsTextOnly: true,
    isNew: true,
  },
]

export const RUNWAY_IMAGE_TO_VIDEO_MODELS: RunwayModelDef[] = [
  {
    id: "gen4_turbo",
    label: "Gen-4 Turbo",
    task: "image_to_video",
    description: "Fast image-to-video — ideal for animating stills.",
    creditsHint: "5 credits / sec",
    requiresImage: true,
  },
  {
    id: "gen4.5",
    label: "Gen-4.5",
    task: "image_to_video",
    description: "Higher quality motion from a keyframe image.",
    creditsHint: "12 credits / sec",
    requiresImage: true,
    isNew: true,
  },
  {
    id: "gen3a_turbo",
    label: "Gen-3 Alpha Turbo",
    task: "image_to_video",
    description: "Legacy fast image-to-video model.",
    creditsHint: "5 credits / sec",
    requiresImage: true,
  },
  {
    id: "veo3.1",
    label: "Veo 3.1",
    task: "image_to_video",
    description: "Animate a frame with Veo quality.",
    creditsHint: "20–40 credits / sec",
    requiresImage: true,
    isNew: true,
  },
  {
    id: "veo3.1_fast",
    label: "Veo 3.1 Fast",
    task: "image_to_video",
    description: "Quick Veo animation from image.",
    creditsHint: "10–15 credits / sec",
    requiresImage: true,
    isNew: true,
  },
  {
    id: "seedance2",
    label: "Seedance 2",
    task: "image_to_video",
    description: "Reference-driven motion; up to 15s.",
    creditsHint: "36 credits / sec",
    requiresImage: true,
    isNew: true,
  },
]

export const RUNWAY_VIDEO_TO_VIDEO_MODELS: RunwayModelDef[] = [
  {
    id: "gen4_aleph",
    label: "Gen-4 Aleph (Aleph 2.0)",
    task: "video_to_video",
    description: "Edit/transform existing video with text prompts.",
    creditsHint: "15 credits / sec",
    requiresVideo: true,
    isNew: true,
  },
  {
    id: "seedance2",
    label: "Seedance 2",
    task: "video_to_video",
    description: "Video reference + prompt for style/motion transfer.",
    creditsHint: "36 credits / sec",
    requiresVideo: true,
    isNew: true,
  },
]

export const RUNWAY_CHARACTER_MODELS: RunwayModelDef[] = [
  {
    id: "act_two",
    label: "Act-Two",
    task: "character_performance",
    description: "Drive a character (image/video) with a reference performance clip.",
    creditsHint: "5 credits / sec",
    requiresImage: true,
    requiresReferenceVideo: true,
  },
]

export const RUNWAY_UPSCALE_MODELS: RunwayModelDef[] = [
  {
    id: "upscale_v1",
    label: "Video Upscale 4×",
    task: "video_upscale",
    description: "Upscale video up to 4K resolution.",
    creditsHint: "Varies by length",
    requiresVideo: true,
  },
]

export const ALL_RUNWAY_MODELS: RunwayModelDef[] = [
  ...RUNWAY_IMAGE_MODELS,
  ...RUNWAY_TEXT_TO_VIDEO_MODELS,
  ...RUNWAY_IMAGE_TO_VIDEO_MODELS,
  ...RUNWAY_VIDEO_TO_VIDEO_MODELS,
  ...RUNWAY_CHARACTER_MODELS,
  ...RUNWAY_UPSCALE_MODELS,
]

export function getModelsForTask(task: RunwayTaskType): RunwayModelDef[] {
  switch (task) {
    case "text_to_image":
      return RUNWAY_IMAGE_MODELS
    case "text_to_video":
      return RUNWAY_TEXT_TO_VIDEO_MODELS
    case "image_to_video":
      return RUNWAY_IMAGE_TO_VIDEO_MODELS
    case "video_to_video":
      return RUNWAY_VIDEO_TO_VIDEO_MODELS
    case "character_performance":
      return RUNWAY_CHARACTER_MODELS
    case "video_upscale":
      return RUNWAY_UPSCALE_MODELS
    default:
      return []
  }
}

export function getTaskEndpoint(task: RunwayTaskType): string {
  const paths: Record<RunwayTaskType, string> = {
    text_to_image: "/v1/text_to_image",
    text_to_video: "/v1/text_to_video",
    image_to_video: "/v1/image_to_video",
    video_to_video: "/v1/video_to_video",
    character_performance: "/v1/character_performance",
    video_upscale: "/v1/video_upscale",
  }
  return paths[task]
}
