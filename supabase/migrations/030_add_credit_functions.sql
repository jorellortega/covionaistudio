-- Migration 030: Add helper functions for credit management
-- Functions to add, deduct, and manage credits safely

-- Function to add credits to a user
CREATE OR REPLACE FUNCTION add_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT DEFAULT NULL,
  p_stripe_payment_intent_id TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_new_balance INTEGER;
BEGIN
  -- Update user credits
  UPDATE public.users
  SET credits = credits + p_amount
  WHERE id = p_user_id
  RETURNING credits INTO v_new_balance;

  -- Create transaction record
  INSERT INTO public.credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    description,
    stripe_payment_intent_id,
    metadata
  )
  VALUES (
    p_user_id,
    'purchase',
    p_amount,
    v_new_balance,
    p_description,
    p_stripe_payment_intent_id,
    p_metadata
  );

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to deduct credits from a user (with balance check)
CREATE OR REPLACE FUNCTION deduct_credits(
  p_user_id UUID,
  p_amount INTEGER,
  p_description TEXT DEFAULT NULL,
  p_metadata JSONB DEFAULT NULL
)
RETURNS INTEGER AS $$
DECLARE
  v_current_balance INTEGER;
  v_new_balance INTEGER;
BEGIN
  -- Get current balance
  SELECT credits INTO v_current_balance
  FROM public.users
  WHERE id = p_user_id;

  -- Check if user has enough credits
  IF v_current_balance < p_amount THEN
    RAISE EXCEPTION 'Insufficient credits. Current balance: %, Required: %', v_current_balance, p_amount;
  END IF;

  -- Update user credits
  UPDATE public.users
  SET credits = credits - p_amount
  WHERE id = p_user_id
  RETURNING credits INTO v_new_balance;

  -- Create transaction record
  INSERT INTO public.credit_transactions (
    user_id,
    transaction_type,
    amount,
    balance_after,
    description,
    metadata
  )
  VALUES (
    p_user_id,
    'usage',
    -p_amount, -- Negative for deduction
    v_new_balance,
    p_description,
    p_metadata
  );

  RETURN v_new_balance;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user credit balance
CREATE OR REPLACE FUNCTION get_user_credits(p_user_id UUID)
RETURNS INTEGER AS $$
DECLARE
  v_credits INTEGER;
BEGIN
  SELECT credits INTO v_credits
  FROM public.users
  WHERE id = p_user_id;

  RETURN COALESCE(v_credits, 0);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to check if user has enough credits
CREATE OR REPLACE FUNCTION has_sufficient_credits(
  p_user_id UUID,
  p_required INTEGER
)
RETURNS BOOLEAN AS $$
DECLARE
  v_balance INTEGER;
BEGIN
  SELECT credits INTO v_balance
  FROM public.users
  WHERE id = p_user_id;

  RETURN COALESCE(v_balance, 0) >= p_required;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON FUNCTION add_credits IS 'Adds credits to a user and creates a transaction record';
COMMENT ON FUNCTION deduct_credits IS 'Deducts credits from a user with balance check and creates a transaction record';
COMMENT ON FUNCTION get_user_credits IS 'Returns the current credit balance for a user';
COMMENT ON FUNCTION has_sufficient_credits IS 'Checks if a user has sufficient credits for a transaction';

