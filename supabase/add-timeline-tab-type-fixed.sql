-- Add timeline tab type to AI Settings table
-- Run this script in your Supabase SQL Editor

-- Step 1: Update the CHECK constraint to include 'timeline'
ALTER TABLE ai_settings 
DROP CONSTRAINT IF EXISTS ai_settings_tab_type_check;

ALTER TABLE ai_settings 
ADD CONSTRAINT ai_settings_tab_type_check 
CHECK (tab_type IN ('scripts', 'images', 'videos', 'audio', 'timeline'));

-- Step 2: Verify the constraint was updated (corrected for newer PostgreSQL)
SELECT 
  conname,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conname = 'ai_settings_tab_type_check';

-- Step 3: Verify the table structure
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'ai_settings'
ORDER BY ordinal_position;

-- Step 4: Show all constraints on the ai_settings table
SELECT 
  conname as constraint_name,
  contype as constraint_type,
  pg_get_constraintdef(oid) as constraint_definition
FROM pg_constraint 
WHERE conrelid = 'ai_settings'::regclass;
