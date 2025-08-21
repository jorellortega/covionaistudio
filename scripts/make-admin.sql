-- Make current user a CEO (admin)
-- Run this after the user roles migration to give yourself CEO access

-- First, run the user roles migration (006_add_user_roles.sql)
-- Then run this to make yourself a CEO

-- Update your user to have CEO role
-- Replace 'vidaxci@gmail.com' with your actual email
UPDATE users 
SET role = 'ceo' 
WHERE email = 'vidaxci@gmail.com';

-- Verify the change
SELECT id, email, name, role, created_at 
FROM users 
WHERE email = 'vidaxci@gmail.com';

-- Now you should be able to run storage operations with CEO privileges
-- Try running the storage setup SQL again
