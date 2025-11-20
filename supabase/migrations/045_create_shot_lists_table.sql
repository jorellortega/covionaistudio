-- Migration: 045_create_shot_lists_table.sql
-- Description: Create shot_lists table for breaking down scenes into individual shots
-- Date: 2025-01-XX

-- Create shot_lists table
CREATE TABLE IF NOT EXISTS public.shot_lists (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE,
  
  -- Reference to the source (one of these will be set)
  scene_id UUID REFERENCES public.scenes(id) ON DELETE CASCADE,
  screenplay_scene_id UUID REFERENCES public.screenplay_scenes(id) ON DELETE CASCADE,
  storyboard_id UUID REFERENCES public.storyboards(id) ON DELETE SET NULL,
  
  -- Shot details
  shot_number INTEGER NOT NULL DEFAULT 1,
  shot_type VARCHAR(50) NOT NULL DEFAULT 'wide' CHECK (shot_type IN ('wide', 'medium', 'close', 'extreme-close', 'two-shot', 'over-the-shoulder', 'point-of-view', 'establishing', 'insert', 'cutaway')),
  camera_angle VARCHAR(50) NOT NULL DEFAULT 'eye-level' CHECK (camera_angle IN ('eye-level', 'high-angle', 'low-angle', 'dutch-angle', 'bird-eye', 'worm-eye')),
  movement VARCHAR(50) NOT NULL DEFAULT 'static' CHECK (movement IN ('static', 'panning', 'tilting', 'tracking', 'zooming', 'dolly', 'crane', 'handheld', 'steadicam')),
  lens VARCHAR(50),
  framing VARCHAR(100),
  duration_seconds INTEGER,
  
  -- Content
  description TEXT,
  action TEXT,
  dialogue TEXT,
  visual_notes TEXT,
  audio_notes TEXT,
  props TEXT[],
  characters TEXT[],
  
  -- Technical details
  location TEXT,
  time_of_day VARCHAR(50),
  lighting_notes TEXT,
  camera_notes TEXT,
  
  -- Status and organization
  status VARCHAR(50) DEFAULT 'planned' CHECK (status IN ('planned', 'scheduled', 'shot', 'review', 'approved', 'rejected')),
  sequence_order NUMERIC DEFAULT 0,
  
  -- Metadata
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure at least one source reference is set
  CONSTRAINT shot_list_source_check CHECK (
    (scene_id IS NOT NULL)::int + 
    (screenplay_scene_id IS NOT NULL)::int + 
    (storyboard_id IS NOT NULL)::int >= 1
  )
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_shot_lists_user_id ON public.shot_lists(user_id);
CREATE INDEX IF NOT EXISTS idx_shot_lists_project_id ON public.shot_lists(project_id);
CREATE INDEX IF NOT EXISTS idx_shot_lists_scene_id ON public.shot_lists(scene_id);
CREATE INDEX IF NOT EXISTS idx_shot_lists_screenplay_scene_id ON public.shot_lists(screenplay_scene_id);
CREATE INDEX IF NOT EXISTS idx_shot_lists_storyboard_id ON public.shot_lists(storyboard_id);
CREATE INDEX IF NOT EXISTS idx_shot_lists_shot_number ON public.shot_lists(shot_number);
CREATE INDEX IF NOT EXISTS idx_shot_lists_sequence_order ON public.shot_lists(sequence_order);
CREATE INDEX IF NOT EXISTS idx_shot_lists_status ON public.shot_lists(status);
CREATE INDEX IF NOT EXISTS idx_shot_lists_created_at ON public.shot_lists(created_at);

-- Enable Row Level Security
ALTER TABLE public.shot_lists ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view own shot lists" ON public.shot_lists
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert own shot lists" ON public.shot_lists
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update own shot lists" ON public.shot_lists
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete own shot lists" ON public.shot_lists
  FOR DELETE USING (auth.uid() = user_id);

-- Create trigger for updated_at
CREATE TRIGGER update_shot_lists_updated_at
  BEFORE UPDATE ON public.shot_lists
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.shot_lists TO anon, authenticated;

-- Add comments
COMMENT ON TABLE public.shot_lists IS 'Shot lists for breaking down scenes into individual shots with technical and creative details';
COMMENT ON COLUMN public.shot_lists.scene_id IS 'Reference to timeline scene (scenes table)';
COMMENT ON COLUMN public.shot_lists.screenplay_scene_id IS 'Reference to screenplay scene (screenplay_scenes table)';
COMMENT ON COLUMN public.shot_lists.storyboard_id IS 'Optional reference to storyboard if shot list is created from a storyboard';
COMMENT ON COLUMN public.shot_lists.sequence_order IS 'Numeric order for flexible shot sequencing (allows inserting shots between existing ones)';

