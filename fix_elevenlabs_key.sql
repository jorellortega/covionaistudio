-- Quick fix: Copy ElevenLabs API key from admin user to system_ai_config
-- Replace 'YOUR_ADMIN_USER_ID' with your actual admin user ID, or use the email below

-- Option 1: Copy from admin user by email (replace with your admin email)
INSERT INTO public.system_ai_config (setting_key, setting_value, description)
SELECT 
  'elevenlabs_api_key',
  elevenlabs_api_key,
  'ElevenLabs API key for text-to-speech generation (system-wide).'
FROM public.users
WHERE email = 'YOUR_ADMIN_EMAIL_HERE'  -- Replace with your admin email
  AND elevenlabs_api_key IS NOT NULL
  AND elevenlabs_api_key != ''
ON CONFLICT (setting_key) 
DO UPDATE SET 
  setting_value = EXCLUDED.setting_value,
  updated_at = NOW();

-- Option 1b: Copy from CEO user (if role is 'ceo')
INSERT INTO public.system_ai_config (setting_key, setting_value, description)
SELECT 
  'elevenlabs_api_key',
  elevenlabs_api_key,
  'ElevenLabs API key for text-to-speech generation (system-wide).'
FROM public.users
WHERE role = 'ceo'
  AND elevenlabs_api_key IS NOT NULL
  AND elevenlabs_api_key != ''
LIMIT 1
ON CONFLICT (setting_key) 
DO UPDATE SET 
  setting_value = EXCLUDED.setting_value,
  updated_at = NOW();

-- Option 2: If you know your admin user ID, use this instead:
-- INSERT INTO public.system_ai_config (setting_key, setting_value, description)
-- SELECT 
--   'elevenlabs_api_key',
--   elevenlabs_api_key,
--   'ElevenLabs API key for text-to-speech generation (system-wide).'
-- FROM public.users
-- WHERE id = 'YOUR_ADMIN_USER_ID_HERE'::uuid
--   AND elevenlabs_api_key IS NOT NULL
--   AND elevenlabs_api_key != ''
-- ON CONFLICT (setting_key) 
-- DO UPDATE SET 
--   setting_value = EXCLUDED.setting_value,
--   updated_at = NOW();

-- Verify it was added:
SELECT setting_key, 
       CASE 
         WHEN setting_value = '' THEN 'EMPTY'
         ELSE LEFT(setting_value, 10) || '...' || RIGHT(setting_value, 4)
       END as key_preview,
       LENGTH(setting_value) as key_length
FROM public.system_ai_config
WHERE setting_key = 'elevenlabs_api_key';

