-- Add timeline tab type to AI Settings table
-- Run this script in your Supabase SQL Editor

-- Step 1: Update the CHECK constraint to include 'timeline'
ALTER TABLE ai_settings 
DROP CONSTRAINT IF EXISTS ai_settings_tab_type_check;

ALTER TABLE ai_settings 
ADD CONSTRAINT ai_settings_tab_type_check 
CHECK (tab_type IN ('scripts', 'images', 'videos', 'audio', 'timeline'));

-- Step 2: Verify the constraint was updated
SELECT 
  conname,
  consrc
FROM pg_constraint 
WHERE conname = 'ai_settings_tab_type_check';

-- Step 3: Test inserting a timeline setting (optional - this will be handled by the app)
-- INSERT INTO ai_settings (user_id, tab_type, locked_model, is_locked)
-- VALUES ('your-user-id-here', 'timeline', 'DALL-E 3', false)
-- ON CONFLICT (user_id, tab_type) DO NOTHING;

-- Step 4: Verify the table structure
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'ai_settings'
ORDER BY ordinal_position;
