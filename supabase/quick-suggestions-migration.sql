-- Quick Suggestions Migration for AI Settings
-- Run this in your Supabase SQL Editor

-- Add the new column
ALTER TABLE ai_settings 
ADD COLUMN IF NOT EXISTS quick_suggestions TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Update existing rows to have empty arrays instead of NULL
UPDATE ai_settings 
SET quick_suggestions = ARRAY[]::TEXT[] 
WHERE quick_suggestions IS NULL;

-- Make the column NOT NULL after setting default values
ALTER TABLE ai_settings 
ALTER COLUMN quick_suggestions SET NOT NULL;

-- Insert default quick suggestions for each tab type
-- Scripts tab
UPDATE ai_settings 
SET quick_suggestions = ARRAY[
  'Make this dialogue more natural and conversational',
  'Add more emotional depth to this scene',
  'Make this action description more cinematic',
  'Improve the pacing and rhythm of this section',
  'Add more visual details and atmosphere'
]::TEXT[]
WHERE tab_type = 'scripts' AND array_length(quick_suggestions, 1) = 0;

-- Images tab
UPDATE ai_settings 
SET quick_suggestions = ARRAY[
  'Make this more cinematic and dramatic',
  'Add more atmospheric lighting',
  'Improve the composition and framing',
  'Make this more stylized and artistic',
  'Add more detail and texture'
]::TEXT[]
WHERE tab_type = 'images' AND array_length(quick_suggestions, 1) = 0;

-- Videos tab
UPDATE ai_settings 
SET quick_suggestions = ARRAY[
  'Make this more dynamic and engaging',
  'Improve the pacing and timing',
  'Add more visual effects and transitions',
  'Make this more cinematic and professional',
  'Enhance the mood and atmosphere'
]::TEXT[]
WHERE tab_type = 'videos' AND array_length(quick_suggestions, 1) = 0;

-- Audio tab
UPDATE ai_settings 
SET quick_suggestions = ARRAY[
  'Make this more emotional and expressive',
  'Improve the rhythm and flow',
  'Add more depth and layering',
  'Make this more atmospheric and immersive',
  'Enhance the mood and tone'
]::TEXT[]
WHERE tab_type = 'audio' AND array_length(quick_suggestions, 1) = 0;

-- Verify the migration
SELECT 
  tab_type,
  array_length(quick_suggestions, 1) as suggestion_count,
  quick_suggestions
FROM ai_settings 
ORDER BY tab_type;
