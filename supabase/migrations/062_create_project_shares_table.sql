-- Migration: 062_create_project_shares_table.sql
-- Description: Create project_shares table for permanent project sharing with granular permissions
-- Date: 2024-12-XX

-- Create project_shares table
CREATE TABLE IF NOT EXISTS public.project_shares (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  owner_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  shared_with_user_id UUID REFERENCES public.users(id) ON DELETE CASCADE,
  shared_with_email TEXT,
  share_key TEXT UNIQUE, -- Optional access key for sharing
  deadline TIMESTAMP WITH TIME ZONE, -- Optional deadline for access
  requires_approval BOOLEAN DEFAULT FALSE, -- Require approval for major changes
  is_revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  -- Granular permissions per page/feature (JSONB)
  permissions JSONB DEFAULT '{
    "screenplay": {"view": true, "edit": false, "delete": false, "add_scenes": false, "edit_scenes": false},
    "timeline": {"view": true, "edit": false, "delete": false, "add_scenes": false, "edit_scenes": false},
    "characters": {"view": true, "edit": false, "delete": false, "add": false},
    "assets": {"view": true, "edit": false, "delete": false, "upload": false},
    "storyboards": {"view": true, "edit": false, "delete": false, "add": false},
    "treatments": {"view": true, "edit": false, "delete": false, "add": false},
    "locations": {"view": true, "edit": false, "delete": false, "add": false},
    "crew": {"view": true, "edit": false, "delete": false, "add": false},
    "equipment": {"view": true, "edit": false, "delete": false, "add": false},
    "props": {"view": true, "edit": false, "delete": false, "add": false},
    "call_sheets": {"view": true, "edit": false, "delete": false, "add": false},
    "lighting_plots": {"view": true, "edit": false, "delete": false, "add": false}
  }'::jsonb,
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  -- Ensure either user_id or email is provided
  CONSTRAINT check_user_or_email CHECK (
    (shared_with_user_id IS NOT NULL) OR (shared_with_email IS NOT NULL)
  )
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_project_shares_project_id ON public.project_shares(project_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_owner_id ON public.project_shares(owner_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_shared_with_user_id ON public.project_shares(shared_with_user_id);
CREATE INDEX IF NOT EXISTS idx_project_shares_shared_with_email ON public.project_shares(shared_with_email);
CREATE INDEX IF NOT EXISTS idx_project_shares_share_key ON public.project_shares(share_key);
CREATE INDEX IF NOT EXISTS idx_project_shares_is_revoked ON public.project_shares(is_revoked);
CREATE INDEX IF NOT EXISTS idx_project_shares_deadline ON public.project_shares(deadline);

-- Enable RLS
ALTER TABLE public.project_shares ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Project owners can view all shares for their projects
CREATE POLICY "Owners can view own project shares" ON public.project_shares
  FOR SELECT USING (auth.uid() = owner_id);

-- Project owners can create shares for their projects
CREATE POLICY "Owners can create own project shares" ON public.project_shares
  FOR INSERT WITH CHECK (auth.uid() = owner_id);

-- Project owners can update shares for their projects
CREATE POLICY "Owners can update own project shares" ON public.project_shares
  FOR UPDATE USING (auth.uid() = owner_id);

-- Project owners can delete shares for their projects
CREATE POLICY "Owners can delete own project shares" ON public.project_shares
  FOR DELETE USING (auth.uid() = owner_id);

-- Shared users can view shares they have access to
CREATE POLICY "Shared users can view their shares" ON public.project_shares
  FOR SELECT USING (
    auth.uid() = shared_with_user_id
    AND is_revoked = FALSE
    AND (deadline IS NULL OR deadline > NOW())
  );

-- Create trigger for updated_at
CREATE TRIGGER update_project_shares_updated_at
  BEFORE UPDATE ON public.project_shares
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.project_shares TO authenticated;

-- Create function to generate unique share keys
CREATE OR REPLACE FUNCTION generate_share_key()
RETURNS TEXT AS $$
DECLARE
  key TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 12-character alphanumeric key
    key := upper(
      substr(
        encode(gen_random_bytes(9), 'base64'),
        1, 12
      )
    );
    -- Replace URL-unsafe characters
    key := replace(replace(replace(key, '/', 'A'), '+', 'B'), '=', 'C');
    
    -- Check if key already exists
    SELECT EXISTS(SELECT 1 FROM public.project_shares WHERE share_key = key) INTO exists_check;
    
    -- Exit loop if key is unique
    EXIT WHEN NOT exists_check;
  END LOOP;
  
  RETURN key;
END;
$$ LANGUAGE plpgsql;

