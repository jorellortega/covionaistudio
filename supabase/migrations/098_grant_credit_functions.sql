-- Allow the API to add, deduct, and read Studio Credits via SECURITY DEFINER RPCs.

GRANT EXECUTE ON FUNCTION public.add_credits(UUID, INTEGER, TEXT, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.deduct_credits(UUID, INTEGER, TEXT, JSONB) TO service_role;
GRANT EXECUTE ON FUNCTION public.get_user_credits(UUID) TO service_role;
GRANT EXECUTE ON FUNCTION public.has_sufficient_credits(UUID, INTEGER) TO service_role;

GRANT EXECUTE ON FUNCTION public.get_user_credits(UUID) TO authenticated;
GRANT EXECUTE ON FUNCTION public.has_sufficient_credits(UUID, INTEGER) TO authenticated;
