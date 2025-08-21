-- Run this in your Supabase SQL Editor to confirm your user account
-- This bypasses email verification

-- First, let's see your current user
SELECT id, email, email_confirmed_at, confirmed_at FROM auth.users WHERE email = 'vidaxci@gmail.com';

-- Now let's confirm the user manually
UPDATE auth.users 
SET 
  email_confirmed_at = NOW(),
  confirmed_at = NOW()
WHERE email = 'vidaxci@gmail.com';

-- Verify the update
SELECT id, email, email_confirmed_at, confirmed_at FROM auth.users WHERE email = 'vidaxci@gmail.com';

-- You should now see both email_confirmed_at and confirmed_at are set to the current timestamp
