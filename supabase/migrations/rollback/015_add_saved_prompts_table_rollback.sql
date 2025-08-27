-- Rollback: Remove saved_prompts table
DROP TRIGGER IF EXISTS update_saved_prompts_updated_at ON public.saved_prompts;
DROP FUNCTION IF EXISTS update_updated_at_column();
DROP TABLE IF EXISTS public.saved_prompts;
