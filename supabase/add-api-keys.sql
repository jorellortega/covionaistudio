-- Add API Keys to Users Table
-- Run this to add your OpenAI and Anthropic API keys

-- First, check if you have API keys stored
SELECT 
  id,
  email,
  openai_api_key IS NOT NULL as has_openai_key,
  anthropic_api_key IS NOT NULL as has_anthropic_key
FROM users 
WHERE id = auth.uid();

-- To add your API keys, run these commands (replace with your actual keys):
-- UPDATE users 
-- SET 
--   openai_api_key = 'sk-your-openai-api-key-here',
--   anthropic_api_key = 'sk-ant-your-anthropic-api-key-here'
-- WHERE id = auth.uid();

-- Or if you want to add them one at a time:
-- UPDATE users SET openai_api_key = 'sk-your-openai-api-key-here' WHERE id = auth.uid();
-- UPDATE users SET anthropic_api_key = 'sk-ant-your-anthropic-api-key-here' WHERE id = auth.uid();

-- Verify the keys were added:
-- SELECT 
--   id,
--   email,
--   CASE 
--     WHEN openai_api_key IS NOT NULL THEN CONCAT('sk-', LEFT(openai_api_key, 10), '...')
--     ELSE 'Not set'
--   END as openai_key_preview,
--   CASE 
--     WHEN anthropic_api_key IS NOT NULL THEN CONCAT('sk-ant-', LEFT(anthropic_api_key, 10), '...')
--     ELSE 'Not set'
--   END as anthropic_key_preview
-- FROM users 
-- WHERE id = auth.uid();
