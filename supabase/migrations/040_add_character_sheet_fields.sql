-- Migration: 040_add_character_sheet_fields.sql
-- Description: Add comprehensive character sheet fields to characters table
-- Date: 2024-12-XX

-- ============================================
-- 1. CORE IDENTITY
-- ============================================
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS full_name TEXT,
  ADD COLUMN IF NOT EXISTS nicknames TEXT[], -- Array of nicknames/aliases
  ADD COLUMN IF NOT EXISTS birthdate DATE,
  ADD COLUMN IF NOT EXISTS nationality TEXT,
  ADD COLUMN IF NOT EXISTS ethnicity TEXT,
  ADD COLUMN IF NOT EXISTS place_of_birth TEXT,
  ADD COLUMN IF NOT EXISTS current_residence TEXT,
  ADD COLUMN IF NOT EXISTS occupation TEXT,
  ADD COLUMN IF NOT EXISTS education_level TEXT,
  ADD COLUMN IF NOT EXISTS socio_economic_status_past TEXT,
  ADD COLUMN IF NOT EXISTS socio_economic_status_present TEXT,
  ADD COLUMN IF NOT EXISTS languages_spoken JSONB DEFAULT '[]'; -- Array of {language: string, fluency: string}

-- ============================================
-- 2. VISUAL BIBLE
-- ============================================
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS height TEXT, -- e.g., "5'10"", "175cm"
  ADD COLUMN IF NOT EXISTS build TEXT, -- thin/athletic/average/stocky/etc.
  ADD COLUMN IF NOT EXISTS skin_tone TEXT,
  ADD COLUMN IF NOT EXISTS eye_color TEXT,
  ADD COLUMN IF NOT EXISTS eye_shape TEXT,
  ADD COLUMN IF NOT EXISTS eye_expression TEXT,
  ADD COLUMN IF NOT EXISTS hair_color_natural TEXT,
  ADD COLUMN IF NOT EXISTS hair_color_current TEXT,
  ADD COLUMN IF NOT EXISTS hair_length TEXT,
  ADD COLUMN IF NOT EXISTS hair_texture TEXT,
  ADD COLUMN IF NOT EXISTS usual_hairstyle TEXT,
  ADD COLUMN IF NOT EXISTS face_shape TEXT,
  ADD COLUMN IF NOT EXISTS distinguishing_marks TEXT, -- tattoos, scars, birthmarks, etc.
  ADD COLUMN IF NOT EXISTS usual_clothing_style TEXT,
  ADD COLUMN IF NOT EXISTS typical_color_palette TEXT[], -- Array of colors
  ADD COLUMN IF NOT EXISTS accessories TEXT, -- jewelry, glasses, piercings, hats, etc.
  ADD COLUMN IF NOT EXISTS posture TEXT,
  ADD COLUMN IF NOT EXISTS body_language TEXT,
  ADD COLUMN IF NOT EXISTS voice_pitch TEXT,
  ADD COLUMN IF NOT EXISTS voice_speed TEXT,
  ADD COLUMN IF NOT EXISTS voice_accent TEXT,
  ADD COLUMN IF NOT EXISTS voice_tone TEXT,
  ADD COLUMN IF NOT EXISTS reference_images TEXT[]; -- Array of image URLs/file names

-- ============================================
-- 3. PSYCHOLOGY
-- ============================================
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS core_values TEXT[], -- Array of 3-5 core values
  ADD COLUMN IF NOT EXISTS main_external_goal TEXT,
  ADD COLUMN IF NOT EXISTS deep_internal_need TEXT,
  ADD COLUMN IF NOT EXISTS greatest_fear TEXT,
  ADD COLUMN IF NOT EXISTS fatal_flaw TEXT,
  ADD COLUMN IF NOT EXISTS key_strengths TEXT[], -- Array of 3-5 strengths
  ADD COLUMN IF NOT EXISTS coping_style_stress TEXT, -- fight/flight/freeze/fawn/joke/etc.
  ADD COLUMN IF NOT EXISTS baseline_personality TEXT, -- introvert/extravert, calm/impulsive, etc.
  ADD COLUMN IF NOT EXISTS sense_of_humor TEXT, -- dark, dry, sarcastic, childish, none
  ADD COLUMN IF NOT EXISTS treats_authority TEXT,
  ADD COLUMN IF NOT EXISTS treats_subordinates TEXT,
  ADD COLUMN IF NOT EXISTS treats_loved_ones TEXT;

-- ============================================
-- 4. BACKSTORY & TIMELINE
-- ============================================
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS childhood_situation TEXT,
  ADD COLUMN IF NOT EXISTS important_childhood_event_1 TEXT,
  ADD COLUMN IF NOT EXISTS important_teen_event TEXT,
  ADD COLUMN IF NOT EXISTS important_adulthood_event TEXT,
  ADD COLUMN IF NOT EXISTS major_trauma_or_loss TEXT,
  ADD COLUMN IF NOT EXISTS biggest_victory_or_success TEXT,
  ADD COLUMN IF NOT EXISTS what_changed_before_story TEXT,
  ADD COLUMN IF NOT EXISTS personal_secrets TEXT, -- Secrets they hide from others
  ADD COLUMN IF NOT EXISTS truth_hidden_from_self TEXT;

-- ============================================
-- 5. RELATIONSHIPS (Enhanced)
-- ============================================
-- Note: relationships JSONB already exists, but we'll add structured fields
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS parents_info TEXT, -- Names, status, relationship notes
  ADD COLUMN IF NOT EXISTS siblings_info TEXT, -- Names, status, relationship notes
  ADD COLUMN IF NOT EXISTS other_family_info TEXT, -- Uncles, grandparents, etc.
  ADD COLUMN IF NOT EXISTS best_friends TEXT[], -- Array of names/descriptions
  ADD COLUMN IF NOT EXISTS other_friends_allies TEXT[], -- Array of names/descriptions
  ADD COLUMN IF NOT EXISTS romantic_status TEXT, -- single, partner, ex, etc.
  ADD COLUMN IF NOT EXISTS important_exes TEXT, -- Names and why they broke up
  ADD COLUMN IF NOT EXISTS enemies_rivals TEXT[], -- Array of names/descriptions
  ADD COLUMN IF NOT EXISTS mentors TEXT[], -- Array of names/descriptions
  ADD COLUMN IF NOT EXISTS people_responsible_for TEXT[]; -- Kids, students, crew, etc.

-- ============================================
-- 6. STORY ROLE & ARC
-- ============================================
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS role_in_story TEXT, -- One sentence description
  ADD COLUMN IF NOT EXISTS character_logline TEXT, -- "A [adjective] [role] who wants [goal] but is held back by [flaw/fear]."
  ADD COLUMN IF NOT EXISTS starting_state TEXT, -- Beliefs, attitude, life situation at beginning
  ADD COLUMN IF NOT EXISTS midpoint_change TEXT, -- Event that shakes their worldview
  ADD COLUMN IF NOT EXISTS end_state TEXT, -- How they change by the end
  ADD COLUMN IF NOT EXISTS key_decisions TEXT[]; -- 3-5 key decisions that drive the plot

-- ============================================
-- 7. PRACTICAL DETAILS / CONTINUITY
-- ============================================
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS vehicle_type TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_model TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_color TEXT,
  ADD COLUMN IF NOT EXISTS vehicle_condition TEXT,
  ADD COLUMN IF NOT EXISTS phone_tech_level TEXT, -- old, latest, doesn't care, obsessed
  ADD COLUMN IF NOT EXISTS home_type TEXT, -- house/apartment
  ADD COLUMN IF NOT EXISTS home_neighborhood TEXT,
  ADD COLUMN IF NOT EXISTS home_condition TEXT, -- neat/messy
  ADD COLUMN IF NOT EXISTS home_key_objects TEXT,
  ADD COLUMN IF NOT EXISTS daily_routine TEXT,
  ADD COLUMN IF NOT EXISTS job_schedule TEXT, -- shifts, side hustles, illegal work, etc.
  ADD COLUMN IF NOT EXISTS pets TEXT[],
  ADD COLUMN IF NOT EXISTS hobbies TEXT[],
  ADD COLUMN IF NOT EXISTS addictions_habits TEXT[], -- coffee, smoking, gym, gambling, scrolling, etc.
  ADD COLUMN IF NOT EXISTS health_issues TEXT, -- injuries, allergies, can't swim, etc.
  ADD COLUMN IF NOT EXISTS religion_spirituality TEXT,
  ADD COLUMN IF NOT EXISTS political_social_views TEXT;

-- ============================================
-- 8. DIALOGUE NOTES
-- ============================================
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS common_phrases TEXT[], -- Array of common phrases or slang
  ADD COLUMN IF NOT EXISTS swearing_level TEXT, -- none/light/heavy
  ADD COLUMN IF NOT EXISTS speaking_style TEXT, -- short and direct / long and poetic / rambly / formal
  ADD COLUMN IF NOT EXISTS language_switches JSONB DEFAULT '[]'; -- Array of {language: string, when: string}

-- ============================================
-- 9. EXTRA NOTES
-- ============================================
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS visual_motifs TEXT[], -- Objects, colors, symbols tied to them
  ADD COLUMN IF NOT EXISTS theme_they_represent TEXT,
  ADD COLUMN IF NOT EXISTS foreshadowing_notes TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.characters.full_name IS 'Full legal name of the character';
COMMENT ON COLUMN public.characters.nicknames IS 'Array of nicknames and aliases';
COMMENT ON COLUMN public.characters.languages_spoken IS 'JSON array of {language: string, fluency: string}';
COMMENT ON COLUMN public.characters.typical_color_palette IS 'Array of colors typically associated with this character';
COMMENT ON COLUMN public.characters.reference_images IS 'Array of image URLs or file names for visual reference';
COMMENT ON COLUMN public.characters.core_values IS 'Array of 3-5 core values';
COMMENT ON COLUMN public.characters.key_strengths IS 'Array of 3-5 key strengths';
COMMENT ON COLUMN public.characters.key_decisions IS 'Array of 3-5 key decisions that drive the plot';
COMMENT ON COLUMN public.characters.language_switches IS 'JSON array of {language: string, when: string} for when they switch languages/accents';

