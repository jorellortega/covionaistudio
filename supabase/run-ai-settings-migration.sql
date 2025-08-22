-- Run this script in your Supabase SQL Editor to create the ai_settings table

-- Step 1: Create the table
CREATE TABLE IF NOT EXISTS ai_settings (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  user_id UUID REFERENCES auth.users(id) ON DELETE CASCADE NOT NULL,
  tab_type TEXT NOT NULL CHECK (tab_type IN ('scripts', 'images', 'videos', 'audio')),
  locked_model TEXT NOT NULL,
  is_locked BOOLEAN DEFAULT FALSE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  
  -- Ensure one setting per user per tab
  UNIQUE(user_id, tab_type)
);

-- Step 2: Enable RLS
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

-- Step 3: Create RLS policies
CREATE POLICY "Users can view their own AI settings" ON ai_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI settings" ON ai_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI settings" ON ai_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AI settings" ON ai_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Step 4: Create index
CREATE INDEX IF NOT EXISTS idx_ai_settings_user_tab ON ai_settings(user_id, tab_type);

-- Step 5: Verify the table was created
SELECT 
  table_name,
  column_name,
  data_type,
  is_nullable
FROM information_schema.columns 
WHERE table_name = 'ai_settings'
ORDER BY ordinal_position;

-- Step 6: Check RLS policies
SELECT 
  schemaname,
  tablename,
  policyname,
  permissive,
  roles,
  cmd
FROM pg_policies 
WHERE tablename = 'ai_settings';
