-- Rollback Migration: 001_initial_schema_rollback.sql
-- Description: Rollback initial database schema
-- Date: 2024-01-01

-- Drop triggers first
DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
DROP TRIGGER IF EXISTS update_users_updated_at ON public.users;

-- Drop functions
DROP FUNCTION IF EXISTS public.handle_new_user();
DROP FUNCTION IF EXISTS public.update_updated_at_column();

-- Drop indexes
DROP INDEX IF EXISTS idx_users_email;
DROP INDEX IF EXISTS idx_users_created_at;

-- Drop table
DROP TABLE IF EXISTS public.users;

-- Drop extension if no other tables use it
-- DROP EXTENSION IF EXISTS "uuid-ossp";
