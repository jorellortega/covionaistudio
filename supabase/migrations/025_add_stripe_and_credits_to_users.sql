-- Migration 025: Add Stripe customer ID and credits to users table
-- This adds support for Stripe payments and credit management

-- Add Stripe customer ID column
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS stripe_customer_id TEXT;

-- Add credits column (stored as integer, represents total credits)
ALTER TABLE users 
ADD COLUMN IF NOT EXISTS credits INTEGER DEFAULT 0 NOT NULL;

-- Add index for Stripe customer ID lookups
CREATE INDEX IF NOT EXISTS idx_users_stripe_customer_id ON users(stripe_customer_id) 
WHERE stripe_customer_id IS NOT NULL;

-- Add index for credits (useful for queries)
CREATE INDEX IF NOT EXISTS idx_users_credits ON users(credits);

-- Add comment
COMMENT ON COLUMN users.stripe_customer_id IS 'Stripe customer ID for payment processing';
COMMENT ON COLUMN users.credits IS 'Current credit balance for the user';

