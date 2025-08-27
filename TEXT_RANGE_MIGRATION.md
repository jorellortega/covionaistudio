# Text Range Migration for Storyboards

This migration adds text range tracking to the storyboards table, allowing the system to visually highlight which parts of the script have already been used for shots.

## What This Migration Adds

### New Database Columns
- `script_text_start` (INTEGER) - Starting character position in the script
- `script_text_end` (INTEGER) - Ending character position in the script  
- `script_text_snippet` (TEXT) - The actual text snippet used for the shot

### Database Features
- **Index**: Performance optimization for text range queries
- **Validation**: Prevents overlapping text ranges in the same scene
- **Triggers**: Automatic validation on insert/update

## How to Run the Migration

### Option 1: Supabase Dashboard (Recommended)
1. Go to your Supabase project dashboard
2. Navigate to **SQL Editor**
3. Copy and paste the contents of `supabase/add-text-range-fields.sql`
4. Click **Run** to execute the migration

### Option 2: Supabase CLI
```bash
supabase db push
```

### Option 3: Direct Database Connection
```bash
psql -h your-db-host -U your-user -d your-db -f supabase/add-text-range-fields.sql
```

## What Happens After Migration

1. **New Columns**: Added to existing storyboards table
2. **Existing Data**: Unaffected (new columns are nullable)
3. **New Shots**: Will automatically include text range data
4. **Visual Highlighting**: System will show used vs. unused script text

## Verification

After running the migration, you can verify it worked by:

```sql
-- Check if columns exist
SELECT column_name, data_type 
FROM information_schema.columns 
WHERE table_name = 'storyboards' 
AND column_name LIKE 'script_text_%';

-- Check if index exists
SELECT indexname, indexdef 
FROM pg_indexes 
WHERE tablename = 'storyboards' 
AND indexname LIKE '%text_range%';
```

## Rollback (If Needed)

If you need to rollback the migration:

```sql
-- Remove the trigger
DROP TRIGGER IF EXISTS validate_text_range_trigger ON public.storyboards;

-- Remove the functions
DROP FUNCTION IF EXISTS validate_text_range();
DROP FUNCTION IF EXISTS check_text_range_overlap(UUID, INTEGER, INTEGER, UUID);

-- Remove the index
DROP INDEX IF EXISTS idx_storyboards_text_range;

-- Remove the columns
ALTER TABLE public.storyboards 
DROP COLUMN IF EXISTS script_text_start,
DROP COLUMN IF EXISTS script_text_end,
DROP COLUMN IF EXISTS script_text_snippet;
```

## Benefits

- **Visual Feedback**: See which script parts are already shot
- **Prevent Duplicates**: System prevents overlapping text ranges
- **Better Workflow**: Clear visual indication of progress
- **Data Integrity**: Database-level validation ensures consistency

## Next Steps

After running this migration:
1. Restart your Next.js development server
2. The system will automatically start tracking text ranges for new shots
3. Existing shots won't have text ranges (they'll be null)
4. New shots will include full text range data for visual highlighting




