-- Migration 031: Add helper functions for subscription management

-- Function to get or create Stripe customer for a user
CREATE OR REPLACE FUNCTION get_or_create_stripe_customer(p_user_id UUID)
RETURNS TEXT AS $$
DECLARE
  v_customer_id TEXT;
BEGIN
  -- Check if user already has a Stripe customer ID
  SELECT stripe_customer_id INTO v_customer_id
  FROM public.users
  WHERE id = p_user_id;

  -- Return existing customer ID if found
  IF v_customer_id IS NOT NULL THEN
    RETURN v_customer_id;
  END IF;

  -- Customer ID will be set by the application after Stripe customer is created
  -- This function is mainly for checking if one exists
  RETURN NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to update user's Stripe customer ID
CREATE OR REPLACE FUNCTION set_stripe_customer_id(
  p_user_id UUID,
  p_customer_id TEXT
)
RETURNS BOOLEAN AS $$
BEGIN
  UPDATE public.users
  SET stripe_customer_id = p_customer_id
  WHERE id = p_user_id;

  RETURN FOUND;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's active subscription
CREATE OR REPLACE FUNCTION get_active_subscription(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  plan_id TEXT,
  plan_name TEXT,
  status TEXT,
  current_period_end TIMESTAMP WITH TIME ZONE
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    s.id,
    s.plan_id,
    s.plan_name,
    s.status,
    s.current_period_end
  FROM public.subscriptions s
  WHERE s.user_id = p_user_id
    AND s.status = 'active'
  ORDER BY s.created_at DESC
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Function to get user's default payment method
CREATE OR REPLACE FUNCTION get_default_payment_method(p_user_id UUID)
RETURNS TABLE (
  id UUID,
  stripe_payment_method_id TEXT,
  card_brand TEXT,
  card_last4 TEXT
) AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pm.id,
    pm.stripe_payment_method_id,
    pm.card_brand,
    pm.card_last4
  FROM public.payment_methods pm
  WHERE pm.user_id = p_user_id
    AND pm.is_default = TRUE
  LIMIT 1;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Comments
COMMENT ON FUNCTION get_or_create_stripe_customer IS 'Gets existing Stripe customer ID or returns NULL if not set';
COMMENT ON FUNCTION set_stripe_customer_id IS 'Updates user''s Stripe customer ID';
COMMENT ON FUNCTION get_active_subscription IS 'Returns the active subscription for a user';
COMMENT ON FUNCTION get_default_payment_method IS 'Returns the default payment method for a user';

