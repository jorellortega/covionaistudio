-- Migration: 049_create_lighting_plots_table.sql
-- Description: Create lighting_plots table for storing lighting setup configurations for cinema
-- Date: 2025-01-XX

-- Create lighting_plots table
CREATE TABLE IF NOT EXISTS public.lighting_plots (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  location_id UUID REFERENCES public.locations(id) ON DELETE SET NULL,
  scene_id UUID REFERENCES public.scenes(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  description TEXT,
  lighting_type TEXT CHECK (lighting_type IN ('key', 'fill', 'back', 'rim', 'practical', 'ambient', 'special')),
  fixture_type TEXT,
  position_x DECIMAL(10, 2),
  position_y DECIMAL(10, 2),
  position_z DECIMAL(10, 2),
  angle_horizontal DECIMAL(5, 2),
  angle_vertical DECIMAL(5, 2),
  intensity INTEGER CHECK (intensity >= 0 AND intensity <= 100),
  color_temperature INTEGER,
  color_gel TEXT,
  diffusion TEXT,
  barn_doors BOOLEAN DEFAULT FALSE,
  flags BOOLEAN DEFAULT FALSE,
  scrims TEXT,
  notes TEXT,
  diagram_data JSONB DEFAULT '{}',
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_lighting_plots_user_id ON public.lighting_plots(user_id);
CREATE INDEX IF NOT EXISTS idx_lighting_plots_project_id ON public.lighting_plots(project_id);
CREATE INDEX IF NOT EXISTS idx_lighting_plots_location_id ON public.lighting_plots(location_id);
CREATE INDEX IF NOT EXISTS idx_lighting_plots_scene_id ON public.lighting_plots(scene_id);
CREATE INDEX IF NOT EXISTS idx_lighting_plots_name ON public.lighting_plots(name);
CREATE INDEX IF NOT EXISTS idx_lighting_plots_lighting_type ON public.lighting_plots(lighting_type);
CREATE INDEX IF NOT EXISTS idx_lighting_plots_created_at ON public.lighting_plots(created_at);

-- Enable Row Level Security
ALTER TABLE public.lighting_plots ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own lighting plots" ON public.lighting_plots
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own lighting plots" ON public.lighting_plots
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own lighting plots" ON public.lighting_plots
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own lighting plots" ON public.lighting_plots
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_lighting_plots_updated_at
  BEFORE UPDATE ON public.lighting_plots
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comments
COMMENT ON TABLE public.lighting_plots IS 'Lighting plot configurations for cinema production';
COMMENT ON COLUMN public.lighting_plots.lighting_type IS 'Type of lighting: key, fill, back, rim, practical, ambient, special';
COMMENT ON COLUMN public.lighting_plots.position_x IS 'X position coordinate (horizontal)';
COMMENT ON COLUMN public.lighting_plots.position_y IS 'Y position coordinate (vertical)';
COMMENT ON COLUMN public.lighting_plots.position_z IS 'Z position coordinate (depth)';
COMMENT ON COLUMN public.lighting_plots.angle_horizontal IS 'Horizontal angle in degrees';
COMMENT ON COLUMN public.lighting_plots.angle_vertical IS 'Vertical angle in degrees';
COMMENT ON COLUMN public.lighting_plots.intensity IS 'Light intensity from 0 to 100';
COMMENT ON COLUMN public.lighting_plots.color_temperature IS 'Color temperature in Kelvin';
COMMENT ON COLUMN public.lighting_plots.diagram_data IS 'JSON object containing diagram/layout data';
COMMENT ON COLUMN public.lighting_plots.metadata IS 'JSON object containing additional lighting metadata';

