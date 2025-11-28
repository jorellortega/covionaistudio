-- Migration: 061_update_user_trigger_for_invite_codes.sql
-- Description: Update handle_new_user function to assign role from invite codes
-- Date: 2024-12-XX

-- First, ensure the role column exists (in case migration 055 hasn't run)
DO $$ 
BEGIN
  -- Check if role column exists, if not, this migration will fail and that's okay
  -- The migration order should ensure 055 runs before 061
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'role'
  ) THEN
    RAISE EXCEPTION 'Role column does not exist in users table. Please run migration 055 first.';
  END IF;
END $$;

-- Update function to handle new user signup with invite code role assignment
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  invite_role user_role;
  user_name TEXT;
  user_email TEXT;
BEGIN
  -- Initialize variables with safe defaults
  invite_role := 'user'::user_role; -- Default to user
  user_email := COALESCE(NEW.email, '');
  user_name := COALESCE(NEW.raw_user_meta_data->>'name', NULL);
  
  -- If no name in metadata, use email
  IF user_name IS NULL OR user_name = '' THEN
    user_name := user_email;
  END IF;
  
  -- Ensure email is not empty
  IF user_email = '' OR user_email IS NULL THEN
    user_email := COALESCE(NEW.raw_user_meta_data->>'email', 'user@example.com');
  END IF;
  
  -- Check if user has invite code role in metadata
  IF NEW.raw_user_meta_data IS NOT NULL 
     AND NEW.raw_user_meta_data->>'inviteCodeRole' IS NOT NULL 
     AND (NEW.raw_user_meta_data->>'inviteCodeRole')::text != '' THEN
    -- Validate the role from metadata
    BEGIN
      invite_role := (NEW.raw_user_meta_data->>'inviteCodeRole')::user_role;
    EXCEPTION
      WHEN invalid_text_representation THEN
        -- If role string doesn't match enum, default to 'user'
        invite_role := 'user'::user_role;
      WHEN OTHERS THEN
        -- For any other error, default to 'user'
        invite_role := 'user'::user_role;
    END;
  END IF;

  -- Insert user with role
  INSERT INTO public.users (id, email, name, role, created_at)
  VALUES (
    NEW.id, 
    user_email, 
    user_name,
    invite_role,
    NOW()
  );
  
  RETURN NEW;
EXCEPTION
  WHEN OTHERS THEN
    -- If insert fails, try with minimal safe values
    BEGIN
      INSERT INTO public.users (id, email, name, role, created_at)
      VALUES (
        NEW.id, 
        COALESCE(NEW.email, 'user@example.com'), 
        COALESCE(NEW.raw_user_meta_data->>'name', NEW.email, 'User'),
        'user'::user_role,
        NOW()
      );
      RETURN NEW;
    EXCEPTION
      WHEN unique_violation THEN
        -- User already exists, that's okay - just return
        RETURN NEW;
      WHEN OTHERS THEN
        -- Log the error but don't fail the signup
        -- The user record can be created later via a separate process
        -- We return NEW to allow auth.users insert to succeed
        RAISE WARNING 'Failed to create user record in public.users: %', SQLERRM;
        RETURN NEW;
    END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

