-- Default blocked routes for every new user (admin, AI & keys, cinema-production).
-- Keep JSON array in sync with lib/blockable-routes.ts DEFAULT_BLOCKED_ROUTES_FOR_NEW_USERS.

ALTER TABLE public.users
  ALTER COLUMN blocked_routes SET DEFAULT
  '[
    "/admin/users-invites",
    "/ai-settings-admin",
    "/share-control",
    "/settings-ai",
    "/setup-ai",
    "/ai-studio",
    "/ai-info",
    "/cinema-production"
  ]'::jsonb;

COMMENT ON COLUMN public.users.blocked_routes IS
  'Path prefixes denied in the app. New users get a default deny-list (admin, AI keys, cinema-production); invite initial_blocked_routes are merged on top.';

-- Invite signups: merge platform defaults with invite-specific blocks (do not replace with []).
CREATE OR REPLACE FUNCTION public.apply_invite_metadata_to_user()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  base_blocked jsonb := '[
    "/admin/users-invites",
    "/ai-settings-admin",
    "/share-control",
    "/settings-ai",
    "/setup-ai",
    "/ai-studio",
    "/ai-info",
    "/cinema-production"
  ]'::jsonb;
BEGIN
  IF NEW.raw_user_meta_data IS NOT NULL
     AND (NEW.raw_user_meta_data->>'inviteCode') IS NOT NULL
     AND length(trim(NEW.raw_user_meta_data->>'inviteCode')) > 0 THEN
    UPDATE public.users u
    SET
      access_expires_at = ic.account_access_expires_at,
      blocked_routes = base_blocked || coalesce(ic.initial_blocked_routes, '[]'::jsonb)
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
