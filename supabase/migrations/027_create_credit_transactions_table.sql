-- Migration 027: Create credit transactions table
-- Tracks all credit purchases, usage, and adjustments

CREATE TABLE IF NOT EXISTS public.credit_transactions (
  id UUID DEFAULT uuid_generate_v4() PRIMARY KEY,
  user_id UUID REFERENCES public.users(id) ON DELETE CASCADE NOT NULL,
  transaction_type TEXT NOT NULL CHECK (transaction_type IN ('purchase', 'usage', 'refund', 'adjustment', 'subscription_bonus')),
  amount INTEGER NOT NULL, -- Positive for credits added, negative for credits used
  balance_after INTEGER NOT NULL, -- Credit balance after this transaction
  description TEXT,
  stripe_payment_intent_id TEXT, -- For purchases
  stripe_invoice_id TEXT, -- For subscription-related transactions
  metadata JSONB, -- Additional data (package info, usage details, etc.)
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW() NOT NULL
);

-- Create indexes
CREATE INDEX IF NOT EXISTS idx_credit_transactions_user_id ON public.credit_transactions(user_id);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_type ON public.credit_transactions(transaction_type);
CREATE INDEX IF NOT EXISTS idx_credit_transactions_stripe_payment_intent_id ON public.credit_transactions(stripe_payment_intent_id) 
WHERE stripe_payment_intent_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_credit_transactions_created_at ON public.credit_transactions(created_at DESC);

-- Enable Row Level Security
ALTER TABLE public.credit_transactions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
CREATE POLICY "Users can view own credit transactions" ON public.credit_transactions
  FOR SELECT USING (auth.uid() = user_id);

-- Comments
COMMENT ON TABLE public.credit_transactions IS 'Tracks all credit purchases, usage, and adjustments';
COMMENT ON COLUMN public.credit_transactions.transaction_type IS 'Type: purchase, usage, refund, adjustment, subscription_bonus';
COMMENT ON COLUMN public.credit_transactions.amount IS 'Credit amount: positive for added, negative for used';
COMMENT ON COLUMN public.credit_transactions.balance_after IS 'Credit balance after this transaction';

