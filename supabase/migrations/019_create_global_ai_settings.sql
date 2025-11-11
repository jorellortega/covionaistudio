-- Migration: 019_create_system_ai_config.sql
-- Description: Create system AI config table for system-wide AI configuration (CEO-only)
-- Date: 2025-01-XX
--
-- IMPORTANT: This table is SEPARATE from the existing 'ai_settings' table.
-- - 'ai_settings' = user-specific settings (user_id, tab_type, locked_model, etc.)
-- - 'system_ai_config' = system-wide settings (API keys, models, system prompt)
-- These tables serve different purposes and will NOT conflict with each other.

-- Create system_ai_config table (different from user-specific ai_settings)
CREATE TABLE IF NOT EXISTS public.system_ai_config (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  setting_key TEXT NOT NULL UNIQUE,
  setting_value TEXT NOT NULL,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Create index on setting_key for faster lookups
CREATE INDEX IF NOT EXISTS idx_system_ai_config_setting_key ON public.system_ai_config(setting_key);

-- Create updated_at trigger function if it doesn't exist
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = timezone('utc'::text, now());
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at timestamp (safe to run multiple times)
DO $$ 
BEGIN
  -- Check if trigger exists, create if not
  IF NOT EXISTS (
    SELECT 1 FROM pg_trigger t
    JOIN pg_class c ON t.tgrelid = c.oid
    WHERE c.relname = 'system_ai_config'
    AND t.tgname = 'update_system_ai_config_updated_at'
  ) THEN
    CREATE TRIGGER update_system_ai_config_updated_at
      BEFORE UPDATE ON public.system_ai_config
      FOR EACH ROW
      EXECUTE FUNCTION public.handle_updated_at();
  END IF;
END $$;

-- Enable RLS
ALTER TABLE public.system_ai_config ENABLE ROW LEVEL SECURITY;

-- Create RLS Policies (safe to run multiple times)
-- Note: Policies allow both 'ceo' and 'admin' roles
DO $$ 
BEGIN
  -- Policy: Only CEOs/Admins can view settings
  BEGIN
    CREATE POLICY "Only CEOs can view system AI config" ON public.system_ai_config
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.users 
          WHERE id = auth.uid()
          AND (role::text = 'ceo' OR role::text = 'admin')
        )
      );
  EXCEPTION WHEN duplicate_object THEN
    -- Policy already exists, drop and recreate to update
    DROP POLICY IF EXISTS "Only CEOs can view system AI config" ON public.system_ai_config;
    CREATE POLICY "Only CEOs can view system AI config" ON public.system_ai_config
      FOR SELECT USING (
        EXISTS (
          SELECT 1 FROM public.users 
          WHERE id = auth.uid()
          AND (role::text = 'ceo' OR role::text = 'admin')
        )
      );
  END;

  -- Policy: Only CEOs/Admins can insert settings
  BEGIN
    CREATE POLICY "Only CEOs can insert system AI config" ON public.system_ai_config
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.users 
          WHERE id = auth.uid()
          AND (role::text = 'ceo' OR role::text = 'admin')
        )
      );
  EXCEPTION WHEN duplicate_object THEN
    -- Policy already exists, drop and recreate to update
    DROP POLICY IF EXISTS "Only CEOs can insert system AI config" ON public.system_ai_config;
    CREATE POLICY "Only CEOs can insert system AI config" ON public.system_ai_config
      FOR INSERT WITH CHECK (
        EXISTS (
          SELECT 1 FROM public.users 
          WHERE id = auth.uid()
          AND (role::text = 'ceo' OR role::text = 'admin')
        )
      );
  END;

  -- Policy: Only CEOs/Admins can update settings
  BEGIN
    CREATE POLICY "Only CEOs can update system AI config" ON public.system_ai_config
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.users 
          WHERE id = auth.uid()
          AND (role::text = 'ceo' OR role::text = 'admin')
        )
      );
  EXCEPTION WHEN duplicate_object THEN
    -- Policy already exists, drop and recreate to update
    DROP POLICY IF EXISTS "Only CEOs can update system AI config" ON public.system_ai_config;
    CREATE POLICY "Only CEOs can update system AI config" ON public.system_ai_config
      FOR UPDATE USING (
        EXISTS (
          SELECT 1 FROM public.users 
          WHERE id = auth.uid()
          AND (role::text = 'ceo' OR role::text = 'admin')
        )
      );
  END;

  -- Policy: Only CEOs/Admins can delete settings
  BEGIN
    CREATE POLICY "Only CEOs can delete system AI config" ON public.system_ai_config
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.users 
          WHERE id = auth.uid()
          AND (role::text = 'ceo' OR role::text = 'admin')
        )
      );
  EXCEPTION WHEN duplicate_object THEN
    -- Policy already exists, drop and recreate to update
    DROP POLICY IF EXISTS "Only CEOs can delete system AI config" ON public.system_ai_config;
    CREATE POLICY "Only CEOs can delete system AI config" ON public.system_ai_config
      FOR DELETE USING (
        EXISTS (
          SELECT 1 FROM public.users 
          WHERE id = auth.uid()
          AND (role::text = 'ceo' OR role::text = 'admin')
        )
      );
  END;
END $$;

-- Create RPC function to get all system AI config (used by server routes with service role)
CREATE OR REPLACE FUNCTION public.get_system_ai_config()
RETURNS TABLE (
  setting_key TEXT,
  setting_value TEXT,
  description TEXT,
  created_at TIMESTAMP WITH TIME ZONE,
  updated_at TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.setting_key,
    s.setting_value,
    s.description,
    s.created_at,
    s.updated_at
  FROM public.system_ai_config s
  ORDER BY s.setting_key;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permission to authenticated users and service role
GRANT EXECUTE ON FUNCTION public.get_system_ai_config() TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_system_ai_config() TO service_role;

-- Insert default settings
INSERT INTO public.system_ai_config (setting_key, setting_value, description)
VALUES
  ('openai_api_key', '', 'OpenAI API key used for the Infinito AI assistant.'),
  ('openai_model', 'gpt-4o-mini', 'Default OpenAI model for the Infinito AI assistant.'),
  ('anthropic_api_key', '', 'Anthropic API key for optional fallback use.'),
  ('anthropic_model', 'claude-3-5-sonnet-20241022', 'Default Anthropic model when configured.'),
  ('system_prompt', $$### Role
You are Infinito AI, an advanced AI assistant designed to help users with their creative and professional tasks.

### Core Principles
- Be helpful, accurate, and concise
- Provide clear, actionable advice
- Maintain a professional yet friendly tone
- Respect user privacy and data security

### Capabilities
- Answer questions and provide information
- Help with creative projects
- Assist with technical tasks
- Provide suggestions and recommendations

### Guidelines
- Always prioritize user needs
- Be transparent about limitations
- Provide accurate information
- Respect user preferences and boundaries$$, 'The system prompt that defines how Infinito AI behaves.')
ON CONFLICT (setting_key) DO NOTHING;

-- Add comments
COMMENT ON TABLE public.system_ai_config IS 'System AI configuration for system-wide settings (CEO-only access)';
COMMENT ON FUNCTION public.get_system_ai_config() IS 'RPC function to retrieve system AI configuration (used by server routes with service role)';

