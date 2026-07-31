ALTER TABLE public.assets
  ADD COLUMN IF NOT EXISTS story_object_id UUID REFERENCES public.story_objects(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_assets_story_object_id ON public.assets(story_object_id);

COMMENT ON COLUMN public.assets.story_object_id IS 'Optional link to a creative story object (vehicle, prop, etc.)';
