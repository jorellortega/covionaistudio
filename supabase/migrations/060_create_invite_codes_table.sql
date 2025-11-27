-- Migration: 060_create_invite_codes_table.sql
-- Description: Create invite codes table for free signups with role assignment
-- Date: 2024-12-XX

-- Create invite_codes table
CREATE TABLE IF NOT EXISTS public.invite_codes (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  code TEXT NOT NULL UNIQUE,
  role user_role NOT NULL DEFAULT 'user',
  created_by UUID REFERENCES public.users(id) ON DELETE SET NULL,
  max_uses INTEGER DEFAULT NULL, -- NULL means unlimited
  used_count INTEGER DEFAULT 0 NOT NULL,
  expires_at TIMESTAMP WITH TIME ZONE DEFAULT NULL, -- NULL means never expires
  is_active BOOLEAN DEFAULT true NOT NULL,
  notes TEXT, -- Optional notes about the invite code
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes for better performance
CREATE INDEX IF NOT EXISTS idx_invite_codes_code ON public.invite_codes(code);
CREATE INDEX IF NOT EXISTS idx_invite_codes_created_by ON public.invite_codes(created_by);
CREATE INDEX IF NOT EXISTS idx_invite_codes_is_active ON public.invite_codes(is_active);
CREATE INDEX IF NOT EXISTS idx_invite_codes_expires_at ON public.invite_codes(expires_at);

-- Enable Row Level Security
ALTER TABLE public.invite_codes ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- CEOs can view all invite codes
CREATE POLICY "CEOs can view all invite codes" ON public.invite_codes
  FOR SELECT USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'ceo'
    )
  );

-- CEOs can create invite codes
CREATE POLICY "CEOs can create invite codes" ON public.invite_codes
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'ceo'
    )
  );

-- CEOs can update invite codes
CREATE POLICY "CEOs can update invite codes" ON public.invite_codes
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'ceo'
    )
  );

-- CEOs can delete invite codes
CREATE POLICY "CEOs can delete invite codes" ON public.invite_codes
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.users 
      WHERE id = auth.uid() 
      AND role = 'ceo'
    )
  );

-- Anyone can validate invite codes (for signup flow)
CREATE POLICY "Anyone can validate invite codes" ON public.invite_codes
  FOR SELECT USING (
    is_active = true 
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR used_count < max_uses)
  );

-- Create function to generate unique invite code
CREATE OR REPLACE FUNCTION public.generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  new_code TEXT;
  code_exists BOOLEAN;
BEGIN
  LOOP
    -- Generate a random 8-character alphanumeric code
    new_code := upper(
      substring(
        md5(random()::text || clock_timestamp()::text) 
        from 1 for 8
      )
    );
    
    -- Check if code already exists
    SELECT EXISTS(SELECT 1 FROM public.invite_codes WHERE code = new_code) INTO code_exists;
    
    -- Exit loop if code is unique
    EXIT WHEN NOT code_exists;
  END LOOP;
  
  RETURN new_code;
END;
$$ LANGUAGE plpgsql;

-- Create function to validate invite code (without using it)
CREATE OR REPLACE FUNCTION public.validate_invite_code(code_to_use TEXT)
RETURNS user_role AS $$
DECLARE
  invite_record RECORD;
BEGIN
  -- Find the invite code
  SELECT * INTO invite_record
  FROM public.invite_codes
  WHERE code = code_to_use
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR used_count < max_uses);
  
  -- Check if code was found
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;
  
  -- Return the role (without incrementing used_count)
  RETURN invite_record.role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create function to validate and use invite code
CREATE OR REPLACE FUNCTION public.use_invite_code(code_to_use TEXT)
RETURNS user_role AS $$
DECLARE
  invite_record RECORD;
  assigned_role user_role;
BEGIN
  -- Find the invite code
  SELECT * INTO invite_record
  FROM public.invite_codes
  WHERE code = code_to_use
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > NOW())
    AND (max_uses IS NULL OR used_count < max_uses)
  FOR UPDATE; -- Lock the row for update
  
  -- Check if code was found
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Invalid or expired invite code';
  END IF;
  
  -- Increment used count
  UPDATE public.invite_codes
  SET used_count = used_count + 1,
      updated_at = NOW()
  WHERE id = invite_record.id;
  
  -- Return the role
  RETURN invite_record.role;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Create trigger for updated_at
CREATE TRIGGER update_invite_codes_updated_at
  BEFORE UPDATE ON public.invite_codes
  FOR EACH ROW
  EXECUTE FUNCTION public.update_updated_at_column();

-- Add comment
COMMENT ON TABLE public.invite_codes IS 'Invite codes for free signups with role assignment';
COMMENT ON COLUMN public.invite_codes.code IS 'Unique invite code (8 characters)';
COMMENT ON COLUMN public.invite_codes.role IS 'Role to assign when code is used (user, creator, studio, production)';
COMMENT ON COLUMN public.invite_codes.max_uses IS 'Maximum number of times this code can be used (NULL = unlimited)';
COMMENT ON COLUMN public.invite_codes.used_count IS 'Number of times this code has been used';
COMMENT ON COLUMN public.invite_codes.expires_at IS 'Expiration date (NULL = never expires)';

