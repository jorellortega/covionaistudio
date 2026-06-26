-- Migration: 079_add_elevenlabs_voice_to_characters.sql
-- Description: Store assigned ElevenLabs voice per character

ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS elevenlabs_voice_id TEXT,
  ADD COLUMN IF NOT EXISTS elevenlabs_voice_name TEXT;

COMMENT ON COLUMN public.characters.elevenlabs_voice_id IS 'ElevenLabs voice ID assigned to this character for TTS';
COMMENT ON COLUMN public.characters.elevenlabs_voice_name IS 'Display name of the assigned ElevenLabs voice';
