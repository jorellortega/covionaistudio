-- Add password protection columns to users table if they don't exist
-- This allows users to protect their AI settings with a password

-- Add the new columns if they don't exist
DO $$ 
BEGIN
    -- Add settings_password_hash column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'settings_password_hash'
    ) THEN
        ALTER TABLE public.users ADD COLUMN settings_password_hash TEXT;
    END IF;

    -- Add settings_password_enabled column if it doesn't exist
    IF NOT EXISTS (
        SELECT 1 FROM information_schema.columns 
        WHERE table_name = 'users' 
        AND column_name = 'settings_password_enabled'
    ) THEN
        ALTER TABLE public.users ADD COLUMN settings_password_enabled BOOLEAN DEFAULT false;
    END IF;
END $$;

-- Create an index for faster password checks
CREATE INDEX IF NOT EXISTS idx_users_settings_password_enabled 
ON public.users(settings_password_enabled) 
WHERE settings_password_enabled = true;

-- Add comments explaining the purpose
COMMENT ON COLUMN public.users.settings_password_hash IS 'Hash of the password used to protect AI settings';
COMMENT ON COLUMN public.users.settings_password_enabled IS 'Whether password protection is enabled for AI settings';

-- Update RLS policies to allow users to manage their own password protection
-- Users can read and update their own password protection settings
CREATE POLICY IF NOT EXISTS "Users can manage their own password protection" 
ON public.users 
FOR UPDATE 
USING (auth.uid() = id) 
WITH CHECK (auth.uid() = id);

-- Grant necessary permissions
GRANT SELECT, UPDATE ON public.users TO authenticated;
