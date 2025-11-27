-- Migration: 061_update_user_trigger_for_invite_codes.sql
-- Description: Update handle_new_user function to assign role from invite codes
-- Date: 2024-12-XX

-- Update function to handle new user signup with invite code role assignment
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  invite_role user_role;
BEGIN
  -- Check if user has invite code role in metadata
  invite_role := NULL;
  
  IF NEW.raw_user_meta_data->>'inviteCodeRole' IS NOT NULL THEN
    -- Validate the role from metadata
    BEGIN
      invite_role := (NEW.raw_user_meta_data->>'inviteCodeRole')::user_role;
    EXCEPTION
      WHEN OTHERS THEN
        invite_role := 'user'::user_role; -- Default to user if invalid
    END;
  END IF;

  -- Insert user with role (default to 'user' if no invite code role)
  INSERT INTO public.users (id, email, name, role, created_at)
  VALUES (
    NEW.id, 
    NEW.email, 
    COALESCE(NEW.raw_user_meta_data->>'name', NEW.email),
    COALESCE(invite_role, 'user'::user_role),
    NOW()
  );
  
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

