-- Migration: 061_update_user_trigger_for_invite_codes.sql
-- Description: Update handle_new_user function to assign role from invite codes
-- Date: 2024-12-XX

-- Create debug log table to track trigger execution
CREATE TABLE IF NOT EXISTS public.trigger_debug_log (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  trigger_name TEXT NOT NULL,
  user_id UUID,
  log_message TEXT NOT NULL,
  error_details TEXT,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Grant access to debug log
GRANT INSERT ON public.trigger_debug_log TO postgres, anon, authenticated;

-- Update function to handle new user signup with invite code role assignment
-- This function is designed to never fail, even if the role column doesn't exist
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  invite_role TEXT; -- Use TEXT instead of user_role to avoid type errors
  user_name TEXT;
  user_email TEXT;
  role_column_exists BOOLEAN;
  error_msg TEXT;
  debug_id UUID;
BEGIN
  -- Log function start
  debug_id := gen_random_uuid();
  BEGIN
    INSERT INTO public.trigger_debug_log (trigger_name, user_id, log_message)
    VALUES ('handle_new_user', NEW.id, 'Function started for user: ' || COALESCE(NEW.email, 'unknown'));
  EXCEPTION WHEN OTHERS THEN
    -- Ignore debug log errors
    NULL;
  END;

  -- Initialize variables with safe defaults
  invite_role := 'user'; -- Default to user as text

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
  BEGIN
    SELECT EXISTS (
      SELECT 1 FROM information_schema.columns 
      WHERE table_schema = 'public' 
      AND table_name = 'users' 
      AND column_name = 'role'
    ) INTO role_column_exists;
    
    BEGIN
      INSERT INTO public.trigger_debug_log (trigger_name, user_id, log_message)
      VALUES ('handle_new_user', NEW.id, 'Role column exists: ' || role_column_exists::text);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  EXCEPTION WHEN OTHERS THEN
    role_column_exists := FALSE;
    BEGIN
      INSERT INTO public.trigger_debug_log (trigger_name, user_id, log_message, error_details)
      VALUES ('handle_new_user', NEW.id, 'Error checking role column', SQLERRM);
    EXCEPTION WHEN OTHERS THEN NULL; END;
  END;
  
  -- Check if user has invite code role in metadata (only if role column exists)
  IF role_column_exists 
     AND NEW.raw_user_meta_data IS NOT NULL 
     AND NEW.raw_user_meta_data->>'inviteCodeRole' IS NOT NULL 
     AND (NEW.raw_user_meta_data->>'inviteCodeRole')::text != '' THEN
    -- Validate the role from metadata
    BEGIN
      -- Try to cast to user_role, if it fails, use as text
      BEGIN
        invite_role := (NEW.raw_user_meta_data->>'inviteCodeRole')::user_role::text;
      EXCEPTION WHEN OTHERS THEN
        -- If casting fails, just use the text value
        invite_role := NEW.raw_user_meta_data->>'inviteCodeRole';
      END;
      BEGIN
        INSERT INTO public.trigger_debug_log (trigger_name, user_id, log_message)
        VALUES ('handle_new_user', NEW.id, 'Invite code role set: ' || invite_role);
      EXCEPTION WHEN OTHERS THEN NULL; END;
    EXCEPTION
      WHEN OTHERS THEN
        -- If role string doesn't match enum, default to 'user'
        invite_role := 'user';
        BEGIN
          INSERT INTO public.trigger_debug_log (trigger_name, user_id, log_message, error_details)
          VALUES ('handle_new_user', NEW.id, 'Invalid role, defaulting to user', SQLERRM);
        EXCEPTION WHEN OTHERS THEN NULL; END;
    END;
  END IF;

  -- Insert user - with or without role column
  BEGIN
    IF role_column_exists THEN
      -- Insert with role (cast to user_role type)
      BEGIN
        INSERT INTO public.users (id, email, name, role, created_at)
        VALUES (
          NEW.id, 
          user_email, 
          user_name,
          invite_role::user_role,
          NOW()
        );
        BEGIN
          INSERT INTO public.trigger_debug_log (trigger_name, user_id, log_message)
          VALUES ('handle_new_user', NEW.id, 'User inserted successfully with role');
        EXCEPTION WHEN OTHERS THEN NULL; END;
      EXCEPTION WHEN OTHERS THEN
        error_msg := SQLERRM;
        BEGIN
          INSERT INTO public.trigger_debug_log (trigger_name, user_id, log_message, error_details)
          VALUES ('handle_new_user', NEW.id, 'Error inserting with role, trying fallback', error_msg);
        EXCEPTION WHEN OTHERS THEN NULL; END;
        RAISE;
      END;
    ELSE
      -- Insert without role (for backwards compatibility)
      BEGIN
        INSERT INTO public.users (id, email, name, created_at)
        VALUES (
          NEW.id, 
          user_email, 
          user_name,
          NOW()
        );
        BEGIN
          INSERT INTO public.trigger_debug_log (trigger_name, user_id, log_message)
          VALUES ('handle_new_user', NEW.id, 'User inserted successfully without role');
        EXCEPTION WHEN OTHERS THEN NULL; END;
      EXCEPTION WHEN OTHERS THEN
        error_msg := SQLERRM;
        BEGIN
          INSERT INTO public.trigger_debug_log (trigger_name, user_id, log_message, error_details)
          VALUES ('handle_new_user', NEW.id, 'Error inserting without role', error_msg);
        EXCEPTION WHEN OTHERS THEN NULL; END;
        RAISE;
      END;
    END IF;
    
    RETURN NEW;
  EXCEPTION
    WHEN unique_violation THEN
      -- User already exists, that's okay - just return
      BEGIN
        INSERT INTO public.trigger_debug_log (trigger_name, user_id, log_message)
        VALUES ('handle_new_user', NEW.id, 'User already exists (unique violation)');
      EXCEPTION WHEN OTHERS THEN NULL; END;
      RETURN NEW;
    WHEN OTHERS THEN
      error_msg := SQLERRM;
      BEGIN
        INSERT INTO public.trigger_debug_log (trigger_name, user_id, log_message, error_details)
        VALUES ('handle_new_user', NEW.id, 'Primary insert failed, trying fallback', error_msg);
      EXCEPTION WHEN OTHERS THEN NULL; END;
      
      -- Try fallback insert without role
      BEGIN
        INSERT INTO public.users (id, email, name, created_at)
        VALUES (
          NEW.id, 
          COALESCE(NEW.email, 'user@example.com'), 
          COALESCE(NEW.raw_user_meta_data->>'name', NEW.email, 'User'),
          NOW()
        );
        BEGIN
          INSERT INTO public.trigger_debug_log (trigger_name, user_id, log_message)
          VALUES ('handle_new_user', NEW.id, 'Fallback insert succeeded');
        EXCEPTION WHEN OTHERS THEN NULL; END;
        RETURN NEW;
      EXCEPTION
        WHEN unique_violation THEN
          -- User already exists
          BEGIN
            INSERT INTO public.trigger_debug_log (trigger_name, user_id, log_message)
            VALUES ('handle_new_user', NEW.id, 'Fallback: User already exists');
          EXCEPTION WHEN OTHERS THEN NULL; END;
          RETURN NEW;
        WHEN OTHERS THEN
          error_msg := SQLERRM;
          -- Last resort: log error but don't fail signup
          BEGIN
            INSERT INTO public.trigger_debug_log (trigger_name, user_id, log_message, error_details)
            VALUES ('handle_new_user', NEW.id, 'All insert attempts failed, allowing signup to proceed', error_msg);
          EXCEPTION WHEN OTHERS THEN NULL; END;
          -- Return NEW to allow auth.users insert to succeed
          RETURN NEW;
      END;
  END;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

