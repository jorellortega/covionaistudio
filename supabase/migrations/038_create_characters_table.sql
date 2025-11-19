-- Migration: 038_create_characters_table.sql
-- Description: Create characters table for storing character profiles linked to projects
-- Date: 2024-12-XX

-- Create characters table
CREATE TABLE IF NOT EXISTS public.characters (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  archetype TEXT,
  backstory TEXT,
  goals TEXT,
  conflicts TEXT,
  personality JSONB DEFAULT '{}',
  age INTEGER,
  gender TEXT,
  relationships JSONB DEFAULT '{}',
  image_url TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_characters_user_id ON public.characters(user_id);
CREATE INDEX IF NOT EXISTS idx_characters_project_id ON public.characters(project_id);
CREATE INDEX IF NOT EXISTS idx_characters_name ON public.characters(name);
CREATE INDEX IF NOT EXISTS idx_characters_created_at ON public.characters(created_at);

-- Enable Row Level Security
ALTER TABLE public.characters ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own characters" ON public.characters
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own characters" ON public.characters
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own characters" ON public.characters
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own characters" ON public.characters
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_characters_updated_at
  BEFORE UPDATE ON public.characters
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.characters IS 'Character profiles linked to movie projects';
COMMENT ON COLUMN public.characters.personality IS 'JSON object containing personality traits and other personality-related data';
COMMENT ON COLUMN public.characters.relationships IS 'JSON object containing relationship information with other characters';

