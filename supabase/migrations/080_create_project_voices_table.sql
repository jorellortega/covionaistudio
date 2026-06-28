-- Migration: 080_create_project_voices_table.sql
-- Description: Store ElevenLabs voices scoped to user + project

CREATE TABLE IF NOT EXISTS public.project_voices (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  character_id UUID REFERENCES public.characters(id) ON DELETE SET NULL,
  elevenlabs_voice_id TEXT NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  category TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  UNIQUE(user_id, project_id, elevenlabs_voice_id)
);

CREATE INDEX IF NOT EXISTS idx_project_voices_user_id ON public.project_voices(user_id);
CREATE INDEX IF NOT EXISTS idx_project_voices_project_id ON public.project_voices(project_id);
CREATE INDEX IF NOT EXISTS idx_project_voices_character_id ON public.project_voices(character_id);

ALTER TABLE public.project_voices ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view own project voices" ON public.project_voices
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own project voices" ON public.project_voices
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own project voices" ON public.project_voices
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own project voices" ON public.project_voices
  FOR DELETE USING (auth.uid() = user_id);

CREATE TRIGGER update_project_voices_updated_at
  BEFORE UPDATE ON public.project_voices
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

COMMENT ON TABLE public.project_voices IS 'ElevenLabs voices created or imported for a specific user and movie project';
