-- Migration: Add text range fields to storyboards table
-- Description: Add fields to track which parts of the script have been used for shots
-- Date: 2024-01-01

-- Add new columns to track script text ranges
ALTER TABLE public.storyboards 
ADD COLUMN IF NOT EXISTS script_text_start INTEGER,
ADD COLUMN IF NOT EXISTS script_text_end INTEGER,
ADD COLUMN IF NOT EXISTS script_text_snippet TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.storyboards.script_text_start IS 'Starting character position of the script text used for this shot';
COMMENT ON COLUMN public.storyboards.script_text_end IS 'Ending character position of the script text used for this shot';
COMMENT ON COLUMN public.storyboards.script_text_snippet IS 'The actual text snippet from the script used for this shot';

-- Create index for better performance when querying by text ranges
CREATE INDEX IF NOT EXISTS idx_storyboards_text_range 
ON public.storyboards(scene_id, script_text_start, script_text_end);

-- Create a function to check for overlapping text ranges
CREATE OR REPLACE FUNCTION check_text_range_overlap(
  p_scene_id UUID,
  p_start INTEGER,
  p_end INTEGER,
  p_exclude_id UUID DEFAULT NULL
)
RETURNS BOOLEAN AS $$
BEGIN
  -- Check if there are any existing shots that overlap with the new range
  -- Exclude the current storyboard if updating
  RETURN EXISTS (
    SELECT 1 FROM public.storyboards 
    WHERE scene_id = p_scene_id
      AND script_text_start IS NOT NULL
      AND script_text_end IS NOT NULL
      AND (
        (script_text_start <= p_start AND script_text_end > p_start) OR
        (script_text_start < p_end AND script_text_end >= p_end) OR
        (script_text_start >= p_start AND script_text_end <= p_end)
      )
      AND (p_exclude_id IS NULL OR id != p_exclude_id)
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create a trigger to validate text ranges don't overlap
CREATE OR REPLACE FUNCTION validate_text_range()
RETURNS TRIGGER AS $$
BEGIN
  -- Only validate if text range fields are provided
  IF NEW.script_text_start IS NOT NULL AND NEW.script_text_end IS NOT NULL THEN
    -- Ensure start is less than end
    IF NEW.script_text_start >= NEW.script_text_end THEN
      RAISE EXCEPTION 'script_text_start must be less than script_text_end';
    END IF;
    
    -- Check for overlaps with existing shots
    IF check_text_range_overlap(NEW.scene_id, NEW.script_text_start, NEW.script_text_end, NEW.id) THEN
      RAISE EXCEPTION 'Text range overlaps with existing shot in this scene';
    END IF;
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for text range validation
DROP TRIGGER IF EXISTS validate_text_range_trigger ON public.storyboards;
CREATE TRIGGER validate_text_range_trigger
  BEFORE INSERT OR UPDATE ON public.storyboards
  FOR EACH ROW EXECUTE FUNCTION validate_text_range();

-- Grant permissions
GRANT EXECUTE ON FUNCTION check_text_range_overlap(UUID, INTEGER, INTEGER, UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION validate_text_range() TO authenticated;










