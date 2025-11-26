-- Migration: 057_create_collaboration_sessions.sql
-- Description: Create collaboration_sessions table for guest access codes with expiration, revoke, renew functionality
-- Date: 2024-12-XX

-- Create collaboration_sessions table
CREATE TABLE IF NOT EXISTS public.collaboration_sessions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  project_id UUID REFERENCES public.projects(id) ON DELETE CASCADE NOT NULL,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  access_code TEXT NOT NULL UNIQUE,
  title TEXT,
  description TEXT,
  expires_at TIMESTAMP WITH TIME ZONE,
  is_revoked BOOLEAN DEFAULT FALSE,
  revoked_at TIMESTAMP WITH TIME ZONE,
  max_participants INTEGER DEFAULT NULL, -- NULL means unlimited
  allow_guests BOOLEAN DEFAULT TRUE,
  allow_edit BOOLEAN DEFAULT TRUE,
  allow_delete BOOLEAN DEFAULT TRUE,
  allow_add_scenes BOOLEAN DEFAULT TRUE,
  allow_edit_scenes BOOLEAN DEFAULT TRUE,
  metadata JSONB DEFAULT '{}',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_project_id ON public.collaboration_sessions(project_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_user_id ON public.collaboration_sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_access_code ON public.collaboration_sessions(access_code);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_expires_at ON public.collaboration_sessions(expires_at);
CREATE INDEX IF NOT EXISTS idx_collaboration_sessions_is_revoked ON public.collaboration_sessions(is_revoked);

-- Enable RLS
ALTER TABLE public.collaboration_sessions ENABLE ROW LEVEL SECURITY;

-- Create RLS policies
-- Users can view their own collaboration sessions
CREATE POLICY "Users can view own collaboration sessions" ON public.collaboration_sessions
  FOR SELECT USING (auth.uid() = user_id);

-- Users can insert their own collaboration sessions
CREATE POLICY "Users can insert own collaboration sessions" ON public.collaboration_sessions
  FOR INSERT WITH CHECK (auth.uid() = user_id);

-- Users can update their own collaboration sessions
CREATE POLICY "Users can update own collaboration sessions" ON public.collaboration_sessions
  FOR UPDATE USING (auth.uid() = user_id);

-- Users can delete their own collaboration sessions
CREATE POLICY "Users can delete own collaboration sessions" ON public.collaboration_sessions
  FOR DELETE USING (auth.uid() = user_id);

-- Allow anonymous/guest access to read active sessions by access code
-- Note: This will be validated in the application layer for security
-- RLS allows read access to all active sessions, but the app validates the code
CREATE POLICY "Guests can view active collaboration sessions" ON public.collaboration_sessions
  FOR SELECT USING (
    is_revoked = FALSE
    AND (expires_at IS NULL OR expires_at > NOW())
  );

-- Create trigger for updated_at
CREATE TRIGGER update_collaboration_sessions_updated_at
  BEFORE UPDATE ON public.collaboration_sessions
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at_column();

-- Grant permissions
GRANT ALL ON public.collaboration_sessions TO authenticated;
GRANT SELECT ON public.collaboration_sessions TO anon;

-- Create function to generate unique access codes
CREATE OR REPLACE FUNCTION generate_access_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
  exists_check BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 8-character alphanumeric code
    code := upper(
      substr(
        encode(gen_random_bytes(6), 'base64'),
        1, 8
      )
    );
    -- Replace URL-unsafe characters
    code := replace(replace(replace(code, '/', 'A'), '+', 'B'), '=', 'C');
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.collaboration_sessions WHERE access_code = code) INTO exists_check;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT exists_check;
  END LOOP;
  
  RETURN code;
END;
$$ LANGUAGE plpgsql;

