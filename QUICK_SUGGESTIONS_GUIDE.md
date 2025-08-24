# Custom Quick Suggestions Guide

## Overview
The AI Text Editor now supports custom quick suggestions that are saved in the database. This allows you to create personalized, context-specific suggestions for your AI text editing workflow.

## Database Migration

### Step 1: Run the Migration
1. Go to your Supabase Dashboard
2. Navigate to the SQL Editor
3. Copy and paste the contents of `supabase/quick-suggestions-migration.sql`
4. Click "Run" to execute the migration

### Step 2: Verify the Migration
The migration will:
- Add a `quick_suggestions` column to the `ai_settings` table
- Populate default suggestions for each AI tab type (scripts, images, videos, audio)
- Set up proper constraints and validation

## How It Works

### Default Suggestions
Each AI tab type comes with 5 default suggestions:

**Scripts:**
- Make this dialogue more natural and conversational
- Add more emotional depth to this scene
- Make this action description more cinematic
- Improve the pacing and rhythm of this section
- Add more visual details and atmosphere

**Images:**
- Make this more cinematic and dramatic
- Add more atmospheric lighting
- Improve the composition and framing
- Make this more stylized and artistic
- Add more detail and texture

**Videos:**
- Make this more dynamic and engaging
- Improve the pacing and timing
- Add more visual effects and transitions
- Make this more cinematic and professional
- Enhance the mood and atmosphere

**Audio:**
- Make this more emotional and expressive
- Improve the rhythm and flow
- Add more depth and layering
- Make this more atmospheric and immersive
- Enhance the mood and tone

### Custom Suggestions
You can now:
1. **Edit existing suggestions** - Modify the default suggestions to match your workflow
2. **Add new suggestions** - Create context-specific prompts for your projects
3. **Remove suggestions** - Delete suggestions that aren't relevant to your work

## API Usage

### Get Quick Suggestions
```typescript
import { AISettingsService } from '@/lib/ai-settings-service'

// Get suggestions for a specific tab
const suggestions = await AISettingsService.getQuickSuggestions(userId, 'scripts')
```

### Update Quick Suggestions
```typescript
// Update suggestions for a specific tab
const updatedSetting = await AISettingsService.updateQuickSuggestions(
  userId, 
  'scripts', 
  ['Custom suggestion 1', 'Custom suggestion 2']
)
```

## Future Enhancements

The "Edit" button in the AI Text Editor currently shows a placeholder message. Future versions will include:
- A modal for editing suggestions
- Drag-and-drop reordering
- Context-aware suggestion generation
- Suggestion templates for different project types

## Database Schema

```sql
ALTER TABLE ai_settings 
ADD COLUMN quick_suggestions TEXT[] DEFAULT ARRAY[]::TEXT[];

-- Constraints:
-- - NOT NULL
-- - Maximum 20 suggestions per tab
-- - No empty or NULL values allowed
```

## Benefits

1. **Personalization** - Tailor suggestions to your specific writing style and project needs
2. **Efficiency** - Save time with frequently used prompts
3. **Consistency** - Maintain consistent AI editing patterns across projects
4. **Context Awareness** - Different suggestions for different content types
5. **Workflow Integration** - Suggestions are tied to your AI settings and user preferences

## Troubleshooting

### Migration Issues
If you encounter errors during migration:
1. Check that you have the correct permissions
2. Ensure the `ai_settings` table exists
3. Verify your Supabase connection

### Empty Suggestions
If suggestions appear empty after migration:
1. Check the database for the new column
2. Verify the default values were inserted
3. Refresh your application

### Performance
The suggestions are stored as PostgreSQL arrays for optimal performance and are cached at the application level.
