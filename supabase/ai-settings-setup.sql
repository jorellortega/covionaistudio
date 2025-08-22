-- Create AI Settings table for user preferences
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

-- Enable RLS
ALTER TABLE ai_settings ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
CREATE POLICY "Users can view their own AI settings" ON ai_settings
  FOR SELECT USING (auth.uid() = user_id);

CREATE POLICY "Users can insert their own AI settings" ON ai_settings
  FOR INSERT WITH CHECK (auth.uid() = user_id);

CREATE POLICY "Users can update their own AI settings" ON ai_settings
  FOR UPDATE USING (auth.uid() = user_id);

CREATE POLICY "Users can delete their own AI settings" ON ai_settings
  FOR DELETE USING (auth.uid() = user_id);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_ai_settings_user_tab ON ai_settings(user_id, tab_type);

-- Insert default settings for existing users (optional)
-- This will be handled by the application when users first visit the settings page
