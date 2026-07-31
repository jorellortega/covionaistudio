-- Add story_object_id column to storyboards table
ALTER TABLE public.storyboards
ADD COLUMN IF NOT EXISTS story_object_id UUID REFERENCES public.story_objects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_storyboards_story_object_id ON public.storyboards(story_object_id);

COMMENT ON COLUMN public.storyboards.story_object_id IS 'Optional reference to a story object (vehicle, prop, etc.). When set, object details can be included in AI image generation prompts.';
