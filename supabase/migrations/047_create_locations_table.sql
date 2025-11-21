-- Migration: 047_create_locations_table.sql
-- Description: Create locations table for storing location profiles linked to projects
-- Date: 2025-01-XX

-- Create locations table
CREATE TABLE IF NOT EXISTS public.locations (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  name TEXT NOT NULL,
  description TEXT,
  type TEXT CHECK (type IN ('interior', 'exterior', 'both')),
  address TEXT,
  city TEXT,
  state TEXT,
  country TEXT,
  time_of_day TEXT[],
  atmosphere TEXT,
  mood TEXT,
  visual_description TEXT,
  lighting_notes TEXT,
  sound_notes TEXT,
  key_features TEXT[],
  props TEXT[],
  restrictions TEXT,
  access_notes TEXT,
  shooting_notes TEXT,
  image_url TEXT,
  reference_images TEXT[],
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_locations_user_id ON public.locations(user_id);
CREATE INDEX IF NOT EXISTS idx_locations_project_id ON public.locations(project_id);
CREATE INDEX IF NOT EXISTS idx_locations_name ON public.locations(name);
CREATE INDEX IF NOT EXISTS idx_locations_type ON public.locations(type);
CREATE INDEX IF NOT EXISTS idx_locations_created_at ON public.locations(created_at);

-- Enable Row Level Security
ALTER TABLE public.locations ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own locations" ON public.locations
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own locations" ON public.locations
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own locations" ON public.locations
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own locations" ON public.locations
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_locations_updated_at
  BEFORE UPDATE ON public.locations
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.locations IS 'Location profiles linked to movie projects';
COMMENT ON COLUMN public.locations.type IS 'Location type: interior, exterior, or both';
COMMENT ON COLUMN public.locations.time_of_day IS 'Array of time of day variants (e.g., ["day", "night", "dawn", "dusk"])';
COMMENT ON COLUMN public.locations.key_features IS 'Array of key features or landmarks';
COMMENT ON COLUMN public.locations.reference_images IS 'Array of reference image URLs';
COMMENT ON COLUMN public.locations.metadata IS 'JSON object containing additional location metadata';

