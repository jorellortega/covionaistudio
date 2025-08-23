-- Fix AI Settings table schema to allow empty locked_model values
-- Run this script in your Supabase SQL Editor

-- Step 1: Drop the existing table (this will lose data, but it's a new feature)
DROP TABLE IF EXISTS ai_settings CASCADE;

-- Step 2: Recreate the table with proper constraints
CREATE TABLE ai_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tab_type TEXT NOT NULL CHECK (tab_type IN ('scripts', 'images', 'videos', 'audio')),
  locked_model TEXT DEFAULT '', -- Allow empty string as default
  is_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one setting per user per tab
  UNIQUE(user_id, tab_type)
);

-- Step 3: Enable RLS
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

-- Step 4: Create RLS policies
CREATE POLICY "Users can view their own AI settings" ON ai_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI settings" ON ai_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI settings" ON ai_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AI settings" ON ai_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Step 5: Create index
CREATE INDEX idx_ai_settings_user_tab ON ai_settings(user_id, tab_type);

-- Step 6: Verify the table was created correctly
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable,
  column_default
FROM information_schema.columns 
WHERE table_name = 'ai_settings'
ORDER BY ordinal_position;

-- Step 7: Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'ai_settings';
