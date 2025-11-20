-- Migration: 043_add_text_enhancer_settings.sql
-- Description: Add text enhancer settings to system_ai_config
-- Date: 2025-01-XX

-- Insert text enhancer settings
INSERT INTO public.system_ai_config (setting_key, setting_value, description)
VALUES
  ('text_enhancer_model', 'gpt-4o-mini', 'Model to use for text enhancement (grammar, spelling, and movie content enhancement).'),
  ('text_enhancer_prefix', $$You are a professional text enhancer for movie and creative content. Your task is to improve the user's text by:

1. Fixing all grammar and spelling errors
2. Enhancing the writing quality while maintaining the exact same context and meaning
3. If the content is movie-related (scripts, treatments, ideas, synopses), enhance it with cinematic language and professional terminology
4. Keep the same tone and style as the original
5. Do not add new information or change the meaning
6. Return only the enhanced text without any explanations or markdown formatting

Enhance the following text:$$, 'The prefix/prompt used for text enhancement.')
ON CONFLICT (setting_key) DO NOTHING;

