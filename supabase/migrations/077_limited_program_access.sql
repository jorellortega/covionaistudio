-- Limited / program access: invite-linked accounts, optional secret signup URL,
-- account expiry, login lockout, and per-user blocked route prefixes.

ALTER TABLE public.users
  ADD COLUMN IF NOT EXISTS login_disabled boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS access_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS blocked_routes jsonb NOT NULL DEFAULT '[]'::jsonb;

ALTER TABLE public.invite_codes
  ADD COLUMN IF NOT EXISTS account_access_expires_at timestamptz,
  ADD COLUMN IF NOT EXISTS initial_blocked_routes jsonb NOT NULL DEFAULT '[]'::jsonb,
  ADD COLUMN IF NOT EXISTS invite_link_token text;

CREATE UNIQUE INDEX IF NOT EXISTS idx_invite_codes_link_token_unique
  ON public.invite_codes (invite_link_token)
  WHERE invite_link_token IS NOT NULL;

COMMENT ON COLUMN public.users.login_disabled IS 'When true, user cannot use the platform (CEO-controlled).';
COMMENT ON COLUMN public.users.access_expires_at IS 'When set and in the past, user cannot access the app.';
COMMENT ON COLUMN public.users.blocked_routes IS 'JSON array of path prefixes this user cannot open (e.g. ["/admin"]).';
COMMENT ON COLUMN public.invite_codes.account_access_expires_at IS 'Copied to users.access_expires_at when someone signs up with this invite.';
COMMENT ON COLUMN public.invite_codes.initial_blocked_routes IS 'Copied to users.blocked_routes at signup.';
COMMENT ON COLUMN public.invite_codes.invite_link_token IS 'If set, signup must include this token (secret link); code alone is not enough.';

-- Validate invite for signup (replaces client-only checks); returns JSON for API.
CREATE OR REPLACE FUNCTION public.validate_invite_for_signup(code_to_use text, link_token text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.invite_codes%ROWTYPE;
  token_ok boolean;
BEGIN
  SELECT * INTO rec
  FROM public.invite_codes
  WHERE code = upper(trim(code_to_use))
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR used_count < max_uses);

  IF NOT FOUND THEN
    RETURN jsonb_build_object('valid', false, 'error', 'Invalid or expired invite code');
  END IF;

  token_ok := rec.invite_link_token IS NULL
    OR (link_token IS NOT NULL AND rec.invite_link_token = link_token);

  IF NOT token_ok THEN
    RETURN jsonb_build_object(
      'valid', false,
      'error',
      'This invite must be opened from the signup link you were sent'
    );
  END IF;

  RETURN jsonb_build_object(
    'valid', true,
    'role', rec.role::text,
    'requires_link_token', (rec.invite_link_token IS NOT NULL),
    'account_access_expires_at', rec.account_access_expires_at,
    'blocked_routes', coalesce(rec.initial_blocked_routes, '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.use_invite_for_signup(code_to_use text, link_token text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  rec public.invite_codes%ROWTYPE;
  token_ok boolean;
BEGIN
  SELECT * INTO rec
  FROM public.invite_codes
  WHERE code = upper(trim(code_to_use))
    AND is_active = true
    AND (expires_at IS NULL OR expires_at > now())
    AND (max_uses IS NULL OR used_count < max_uses)
  FOR UPDATE;

  IF NOT FOUND THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid or expired invite code');
  END IF;

  token_ok := rec.invite_link_token IS NULL
    OR (link_token IS NOT NULL AND rec.invite_link_token = link_token);

  IF NOT token_ok THEN
    RETURN jsonb_build_object('success', false, 'error', 'Invalid signup link');
  END IF;

  UPDATE public.invite_codes
  SET used_count = used_count + 1,
      updated_at = now()
  WHERE id = rec.id;

  RETURN jsonb_build_object('success', true, 'role', rec.role::text);
END;
$$;

GRANT EXECUTE ON FUNCTION public.validate_invite_for_signup(text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.use_invite_for_signup(text, text) TO anon, authenticated;

-- After auth.users insert, copy invite-based access fields from DB (trusted source).
CREATE OR REPLACE FUNCTION public.apply_invite_metadata_to_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF NEW.raw_user_meta_data IS NOT NULL
     AND (NEW.raw_user_meta_data->>'inviteCode') IS NOT NULL
     AND length(trim(NEW.raw_user_meta_data->>'inviteCode')) > 0 THEN
    UPDATE public.users u
    SET
      access_expires_at = ic.account_access_expires_at,
      blocked_routes = coalesce(ic.initial_blocked_routes, '[]'::jsonb)
    FROM public.invite_codes ic
    WHERE u.id = NEW.id
      AND ic.code = upper(trim(NEW.raw_user_meta_data->>'inviteCode'))
      AND ic.is_active = true
      AND (
        ic.invite_link_token IS NULL
        OR ic.invite_link_token = (NEW.raw_user_meta_data->>'inviteLinkToken')
      );
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_invite_profile ON auth.users;
CREATE TRIGGER on_auth_user_invite_profile
  AFTER INSERT ON auth.users
  FOR EACH ROW
  EXECUTE FUNCTION public.apply_invite_metadata_to_user();
