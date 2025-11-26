-- Migration 058: Make AI Settings System-Wide
-- Description: Convert ai_settings from per-user to system-wide settings
-- Date: 2025-01-XX

-- Step 1: Drop existing unique constraint on (user_id, tab_type)
ALTER TABLE public.ai_settings 
DROP CONSTRAINT IF EXISTS ai_settings_user_id_tab_type_key;

-- Step 2: Make user_id nullable to support system-wide settings
ALTER TABLE public.ai_settings 
ALTER COLUMN user_id DROP NOT NULL;

-- Step 3: Drop existing index that requires user_id
DROP INDEX IF EXISTS idx_ai_settings_user_tab;

-- Step 4: Delete all existing user-specific settings
-- (We'll recreate them as system-wide settings)
DELETE FROM public.ai_settings;

-- Step 5: Create new unique constraint for system-wide settings (one per tab_type when user_id is NULL)
-- This ensures only one system-wide setting exists per tab_type
CREATE UNIQUE INDEX IF NOT EXISTS ai_settings_system_wide_unique 
ON public.ai_settings(tab_type) 
WHERE user_id IS NULL;

-- Step 6: Create index for faster lookups of system-wide settings
CREATE INDEX IF NOT EXISTS idx_ai_settings_system_wide 
ON public.ai_settings(tab_type) 
WHERE user_id IS NULL;

-- Step 7: Insert default system-wide settings for all tab types
INSERT INTO public.ai_settings (user_id, tab_type, locked_model, selected_model, is_locked, quick_suggestions, created_at, updated_at)
VALUES
  (NULL, 'scripts', 'ChatGPT', 'gpt-4o-mini', false, ARRAY[
    'Make this dialogue more natural and conversational',
    'Add more emotional depth to this scene',
    'Make this action description more cinematic',
    'Improve the pacing and rhythm of this section',
    'Add more visual details and atmosphere'
  ]::TEXT[], NOW(), NOW()),
  (NULL, 'images', 'DALL-E 3', NULL, false, ARRAY[
    'Make this more cinematic and dramatic',
    'Add more atmospheric lighting',
    'Improve the composition and framing',
    'Make this more stylized and artistic',
    'Add more detail and texture'
  ]::TEXT[], NOW(), NOW()),
  (NULL, 'videos', 'Runway ML', NULL, false, ARRAY[
    'Make this more dynamic and engaging',
    'Improve the pacing and timing',
    'Add more visual effects and transitions',
    'Make this more cinematic and professional',
    'Enhance the mood and atmosphere'
  ]::TEXT[], NOW(), NOW()),
  (NULL, 'audio', 'ElevenLabs', NULL, false, ARRAY[
    'Make this more emotional and expressive',
    'Improve the rhythm and flow',
    'Add more depth and layering',
    'Make this more atmospheric and immersive',
    'Enhance the mood and tone'
  ]::TEXT[], NOW(), NOW()),
  (NULL, 'timeline', 'DALL-E 3', NULL, false, ARRAY[
    'Make this more cinematic and dramatic',
    'Add more atmospheric lighting',
    'Improve the composition and framing',
    'Make this more stylized and artistic',
    'Add more detail and texture'
  ]::TEXT[], NOW(), NOW())
ON CONFLICT (tab_type) WHERE user_id IS NULL DO NOTHING;

-- Step 8: Drop all existing RLS policies
DROP POLICY IF EXISTS "Users can view their own AI settings" ON public.ai_settings;
DROP POLICY IF EXISTS "Users can insert their own AI settings" ON public.ai_settings;
DROP POLICY IF EXISTS "Users can update their own AI settings" ON public.ai_settings;
DROP POLICY IF EXISTS "Users can delete their own AI settings" ON public.ai_settings;

-- Step 9: Create new RLS policies for system-wide settings
-- All authenticated users can view system-wide settings
CREATE POLICY "All users can view system AI settings" ON public.ai_settings
  FOR SELECT 
  USING (user_id IS NULL AND auth.uid() IS NOT NULL);

-- All authenticated users can update system-wide settings
CREATE POLICY "All users can update system AI settings" ON public.ai_settings
  FOR UPDATE 
  USING (user_id IS NULL AND auth.uid() IS NOT NULL)
  WITH CHECK (user_id IS NULL AND auth.uid() IS NOT NULL);

-- Only allow inserts for system-wide settings (user_id must be NULL)
CREATE POLICY "All users can insert system AI settings" ON public.ai_settings
  FOR INSERT 
  WITH CHECK (user_id IS NULL AND auth.uid() IS NOT NULL);

-- All authenticated users can delete system-wide settings (if needed for admin purposes)
CREATE POLICY "All users can delete system AI settings" ON public.ai_settings
  FOR DELETE 
  USING (user_id IS NULL AND auth.uid() IS NOT NULL);

-- Step 10: Add comments for documentation
COMMENT ON TABLE public.ai_settings IS 'System-wide AI settings for all users. user_id is NULL for system-wide settings.';
COMMENT ON COLUMN public.ai_settings.user_id IS 'NULL for system-wide settings. Non-NULL values are deprecated and not used.';

