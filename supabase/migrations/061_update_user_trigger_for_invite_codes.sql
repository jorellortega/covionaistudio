-- Migration: 061_update_user_trigger_for_invite_codes.sql
-- Description: Update handle_new_user function to assign role from invite codes
-- Date: 2024-12-XX

-- Update function to handle new user signup with invite code role assignment
-- This function is designed to never fail, even if the role column doesn't exist
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  invite_role user_role;
  user_name TEXT;
  user_email TEXT;
  role_column_exists BOOLEAN;
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
  
  -- Check if role column exists
  SELECT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' 
    AND table_name = 'users' 
    AND column_name = 'role'
  ) INTO role_column_exists;
  
  -- Check if user has invite code role in metadata (only if role column exists)
  IF role_column_exists 
     AND NEW.raw_user_meta_data IS NOT NULL 
     AND NEW.raw_user_meta_data->>'inviteCodeRole' IS NOT NULL 
     AND (NEW.raw_user_meta_data->>'inviteCodeRole')::text != '' THEN
    -- Validate the role from metadata
    BEGIN
      invite_role := (NEW.raw_user_meta_data->>'inviteCodeRole')::user_role;
    EXCEPTION
      WHEN invalid_text_representation OR OTHERS THEN
        -- If role string doesn't match enum, default to 'user'
        invite_role := 'user'::user_role;
    END;
  END IF;

  -- Insert user - with or without role column
  BEGIN
    IF role_column_exists THEN
      -- Insert with role
      INSERT INTO public.users (id, email, name, role, created_at)
      VALUES (
        NEW.id, 
        user_email, 
        user_name,
        invite_role,
        NOW()
      );
    ELSE
      -- Insert without role (for backwards compatibility)
      INSERT INTO public.users (id, email, name, created_at)
      VALUES (
        NEW.id, 
        user_email, 
        user_name,
        NOW()
      );
    END IF;
    
    RETURN NEW;
  EXCEPTION
    WHEN unique_violation THEN
      -- User already exists, that's okay - just return
      RETURN NEW;
    WHEN OTHERS THEN
      -- Try fallback insert without role
      BEGIN
        INSERT INTO public.users (id, email, name, created_at)
        VALUES (
          NEW.id, 
          COALESCE(NEW.email, 'user@example.com'), 
          COALESCE(NEW.raw_user_meta_data->>'name', NEW.email, 'User'),
          NOW()
        );
        RETURN NEW;
      EXCEPTION
        WHEN unique_violation THEN
          -- User already exists
          RETURN NEW;
        WHEN OTHERS THEN
          -- Last resort: log warning but don't fail signup
          -- The auth.users record will be created, public.users can be fixed later
          RAISE WARNING 'Failed to create user record in public.users for user %: %', NEW.id, SQLERRM;
          RETURN NEW;
      END;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

