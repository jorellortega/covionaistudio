-- Migration: 020_add_selected_model_to_ai_settings.sql
-- Description: Add selected_model column to ai_settings table for storing specific LLM models
-- Date: 2025-01-XX

-- Add selected_model column to ai_settings table
ALTER TABLE public.ai_settings 
ADD COLUMN IF NOT EXISTS selected_model TEXT DEFAULT NULL;

-- Add comment to explain the column
COMMENT ON COLUMN public.ai_settings.selected_model IS 'Specific model identifier (e.g., gpt-4o, gpt-4o-mini, claude-3-5-sonnet-20241022) for the selected provider. Used when locked_model is ChatGPT, GPT-4, or Claude.';

-- Update existing records to set default selected_model based on locked_model
-- For ChatGPT/GPT-4, set default to gpt-4o-mini
UPDATE public.ai_settings 
SET selected_model = 'gpt-4o-mini'
WHERE (locked_model = 'ChatGPT' OR locked_model = 'GPT-4') 
  AND selected_model IS NULL
  AND tab_type = 'scripts';

-- For Claude, set default to claude-3-5-sonnet-20241022
UPDATE public.ai_settings 
SET selected_model = 'claude-3-5-sonnet-20241022'
WHERE locked_model = 'Claude' 
  AND selected_model IS NULL
  AND tab_type = 'scripts';

