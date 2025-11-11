-- Update RLS policies for system_ai_config to allow both 'ceo' and 'admin' roles
-- Run this in Supabase SQL Editor if you've already run the migration

-- Drop existing policies
DROP POLICY IF EXISTS "Only CEOs can view system AI config" ON public.system_ai_config;
DROP POLICY IF EXISTS "Only CEOs can insert system AI config" ON public.system_ai_config;
DROP POLICY IF EXISTS "Only CEOs can update system AI config" ON public.system_ai_config;
DROP POLICY IF EXISTS "Only CEOs can delete system AI config" ON public.system_ai_config;

-- Recreate policies to allow both 'ceo' and 'admin' roles
CREATE POLICY "Only CEOs can view system AI config" ON public.system_ai_config
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid()
      AND (role::text = 'ceo' OR role::text = 'admin')
    )
  );

CREATE POLICY "Only CEOs can insert system AI config" ON public.system_ai_config
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid()
      AND (role::text = 'ceo' OR role::text = 'admin')
    )
  );

CREATE POLICY "Only CEOs can update system AI config" ON public.system_ai_config
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid()
      AND (role::text = 'ceo' OR role::text = 'admin')
    )
  );

CREATE POLICY "Only CEOs can delete system AI config" ON public.system_ai_config
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid()
      AND (role::text = 'ceo' OR role::text = 'admin')
    )
  );

