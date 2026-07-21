-- Avatar Studio: dedicated storage for turnaround/reference shots
-- Separate from general assets so avatar images can be queried on their own,
-- while still optionally linking to characters and project assets.

CREATE TABLE IF NOT EXISTS public.avatar_sets (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  character_name TEXT,
  description TEXT,
  style TEXT,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS public.avatar_images (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
  avatar_set_id UUID NOT NULL REFERENCES public.avatar_sets(id) ON DELETE CASCADE,
  project_id UUID NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
  character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  asset_id UUID REFERENCES public.assets(id) ON DELETE SET NULL,
  angle_id TEXT NOT NULL,
  angle_label TEXT NOT NULL,
  image_url TEXT NOT NULL,
  prompt TEXT,
  source TEXT NOT NULL DEFAULT 'generated' CHECK (
    source IN ('generated', 'from_reference', 'existing')
  ),
  sort_order INTEGER NOT NULL DEFAULT 0,
  metadata JSONB NOT NULL DEFAULT '{}',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_avatar_sets_user_id ON public.avatar_sets(user_id);
CREATE INDEX IF NOT EXISTS idx_avatar_sets_project_id ON public.avatar_sets(project_id);
CREATE INDEX IF NOT EXISTS idx_avatar_sets_character_id ON public.avatar_sets(character_id);
CREATE UNIQUE INDEX IF NOT EXISTS idx_avatar_sets_project_character
  ON public.avatar_sets(project_id, character_id)
  WHERE character_id IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_avatar_sets_project_no_character
  ON public.avatar_sets(project_id)
  WHERE character_id IS NULL;

CREATE INDEX IF NOT EXISTS idx_avatar_images_user_id ON public.avatar_images(user_id);
CREATE INDEX IF NOT EXISTS idx_avatar_images_avatar_set_id ON public.avatar_images(avatar_set_id);
CREATE INDEX IF NOT EXISTS idx_avatar_images_project_id ON public.avatar_images(project_id);
CREATE INDEX IF NOT EXISTS idx_avatar_images_character_id ON public.avatar_images(character_id);
CREATE INDEX IF NOT EXISTS idx_avatar_images_angle_id ON public.avatar_images(angle_id);
CREATE INDEX IF NOT EXISTS idx_avatar_images_asset_id ON public.avatar_images(asset_id);
CREATE INDEX IF NOT EXISTS idx_avatar_images_created_at ON public.avatar_images(created_at DESC);

ALTER TABLE public.avatar_sets ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.avatar_images ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own avatar sets" ON public.avatar_sets
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own avatar sets" ON public.avatar_sets
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own avatar sets" ON public.avatar_sets
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own avatar sets" ON public.avatar_sets
  FOR DELETE USING (auth.uid() = user_id);

CREATE POLICY "Users can view own avatar images" ON public.avatar_images
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own avatar images" ON public.avatar_images
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own avatar images" ON public.avatar_images
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own avatar images" ON public.avatar_images
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_avatar_sets_updated_at
  BEFORE UPDATE ON public.avatar_sets
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

CREATE TRIGGER update_avatar_images_updated_at
  BEFORE UPDATE ON public.avatar_images
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

GRANT ALL ON public.avatar_sets TO authenticated;
GRANT ALL ON public.avatar_images TO authenticated;
