-- Migration: 044_allow_read_text_enhancer_settings.sql
-- Description: Allow all authenticated users to read text enhancer settings (read-only)
-- Date: 2025-01-XX

-- Create a policy that allows all authenticated users to read text_enhancer settings
-- This is safe because these settings don't contain sensitive information (no API keys)
CREATE POLICY "Authenticated users can read text enhancer settings" ON public.system_ai_config
  FOR SELECT USING (
    auth.role() = 'authenticated' 
    AND (setting_key = 'text_enhancer_model' OR setting_key = 'text_enhancer_prefix')
  );

