-- Make synopsis nullable in treatments table
-- This allows creating treatments without a synopsis

ALTER TABLE public.treatments 
ALTER COLUMN synopsis DROP NOT NULL;

-- Update the comment to reflect that synopsis is optional
COMMENT ON COLUMN public.treatments.synopsis IS 'Brief summary of the story (optional)';

