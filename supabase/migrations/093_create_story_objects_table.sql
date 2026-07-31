-- Creative development objects: cars, props, weapons, items, etc.
CREATE TABLE IF NOT EXISTS public.story_objects (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  category TEXT NOT NULL DEFAULT 'other' CHECK (
    category IN (
      'vehicle',
      'prop',
      'weapon',
      'furniture',
      'technology',
      'food',
      'document',
      'artwork',
      'clothing',
      'other'
    )
  ),
  description TEXT,
  visual_description TEXT,
  material TEXT,
  color TEXT,
  era TEXT,
  notes TEXT,
  image_url TEXT,
  reference_images TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_story_objects_user_id ON public.story_objects(user_id);
CREATE INDEX IF NOT EXISTS idx_story_objects_project_id ON public.story_objects(project_id);
CREATE INDEX IF NOT EXISTS idx_story_objects_category ON public.story_objects(category);
CREATE INDEX IF NOT EXISTS idx_story_objects_name ON public.story_objects(name);

ALTER TABLE public.story_objects ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own story objects" ON public.story_objects
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own story objects" ON public.story_objects
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own story objects" ON public.story_objects
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own story objects" ON public.story_objects
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_story_objects_updated_at
  BEFORE UPDATE ON public.story_objects
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.story_objects IS 'Creative development objects: vehicles, props, weapons, and other story items';
