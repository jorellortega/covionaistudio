-- Add quick_suggestions column to ai_settings table
-- This allows users to save custom quick suggestions for each AI tab type

-- Add the new column
ALTER TABLE ai_settings 
ADD COLUMN IF NOT EXISTS quick_suggestions TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Add comment for documentation
COMMENT ON COLUMN ai_settings.quick_suggestions IS 'Array of custom quick suggestions for the AI tab type';

-- Update existing rows to have empty arrays instead of NULL
UPDATE ai_settings 
SET quick_suggestions = ARRAY[]::TEXT[] 
WHERE quick_suggestions IS NULL;

-- Make the column NOT NULL after setting default values
ALTER TABLE ai_settings 
ALTER COLUMN quick_suggestions SET NOT NULL;

-- Create a function to validate quick suggestions array
CREATE OR REPLACE FUNCTION validate_quick_suggestions()
RETURNS TRIGGER AS $$
BEGIN
  -- Ensure quick_suggestions is not NULL and is an array
  IF NEW.quick_suggestions IS NULL THEN
    RAISE EXCEPTION 'quick_suggestions cannot be NULL';
  END IF;
  
  -- Ensure each suggestion is not empty
  IF EXISTS (SELECT 1 FROM unnest(NEW.quick_suggestions) AS suggestion WHERE suggestion = '' OR suggestion IS NULL) THEN
    RAISE EXCEPTION 'quick_suggestions cannot contain empty or NULL values';
  END IF;
  
  -- Limit the number of suggestions to prevent abuse
  IF array_length(NEW.quick_suggestions, 1) > 20 THEN
    RAISE EXCEPTION 'quick_suggestions cannot exceed 20 items';
  END IF;
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to validate quick suggestions
DROP TRIGGER IF EXISTS validate_quick_suggestions_trigger ON ai_settings;
CREATE TRIGGER validate_quick_suggestions_trigger
  BEFORE INSERT OR UPDATE ON ai_settings
  FOR EACH ROW
  EXECUTE FUNCTION validate_quick_suggestions();

-- Insert some default quick suggestions for each tab type
-- These will be used as fallbacks when users don't have custom ones

-- Default suggestions for scripts tab
UPDATE ai_settings 
SET quick_suggestions = ARRAY[
  'Make this dialogue more natural and conversational',
  'Add more emotional depth to this scene',
  'Make this action description more cinematic',
  'Improve the pacing and rhythm of this section',
  'Add more visual details and atmosphere'
]::TEXT[]
WHERE tab_type = 'scripts' AND array_length(quick_suggestions, 1) = 0;

-- Default suggestions for images tab
UPDATE ai_settings 
SET quick_suggestions = ARRAY[
  'Make this more cinematic and dramatic',
  'Add more atmospheric lighting',
  'Improve the composition and framing',
  'Make this more stylized and artistic',
  'Add more detail and texture'
]::TEXT[]
WHERE tab_type = 'images' AND array_length(quick_suggestions, 1) = 0;

-- Default suggestions for videos tab
UPDATE ai_settings 
SET quick_suggestions = ARRAY[
  'Make this more dynamic and engaging',
  'Improve the pacing and timing',
  'Add more visual effects and transitions',
  'Make this more cinematic and professional',
  'Enhance the mood and atmosphere'
]::TEXT[]
WHERE tab_type = 'videos' AND array_length(quick_suggestions, 1) = 0;

-- Default suggestions for audio tab
UPDATE ai_settings 
SET quick_suggestions = ARRAY[
  'Make this more emotional and expressive',
  'Improve the rhythm and flow',
  'Add more depth and layering',
  'Make this more atmospheric and immersive',
  'Enhance the mood and tone'
]::TEXT[]
WHERE tab_type = 'audio' AND array_length(quick_suggestions, 1) = 0;
