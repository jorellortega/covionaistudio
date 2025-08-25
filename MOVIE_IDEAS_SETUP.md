# Movie Ideas Feature Setup

This guide explains how to set up the new Movie Ideas feature in your cinema platform.

## Overview

The Movie Ideas feature allows users to:
- Save quick movie ideas with titles, descriptions, and genres
- Add AI prompts to help develop ideas further
- Track idea status (concept, development, completed)
- Search and filter through their idea library
- Use an AI Prompt Studio for creative development

## Database Setup

### 1. Run the Migration

Execute the SQL migration file to create the required table:

```bash
# Connect to your Supabase database and run:
psql -h your-supabase-host -U postgres -d postgres -f supabase/movie-ideas-setup.sql
```

Or copy and paste the contents of `supabase/movie-ideas-setup.sql` into your Supabase SQL editor.

### 2. Table Structure

The `movie_ideas` table includes:
- `id`: Unique identifier (UUID)
- `user_id`: References the authenticated user
- `title`: Movie idea title (required)
- `description`: Brief description (required)
- `genre`: Movie genre (optional)
- `prompt`: AI development prompt (optional)
- `status`: Development status (concept/development/completed)
- `created_at`: Creation timestamp
- `updated_at`: Last update timestamp

### 3. Security Features

- Row Level Security (RLS) enabled
- Users can only access their own ideas
- Automatic `updated_at` timestamp updates

## Features

### Idea Library
- Grid view of all saved ideas
- Search functionality across title, description, and prompts
- Filter by genre and status
- Edit and delete existing ideas

### AI Prompt Studio
- Dedicated space for AI-assisted idea development
- Save prompts as new ideas
- Tips for effective prompt writing

### Responsive Design
- Mobile-friendly interface
- Optimized for both desktop and mobile use
- Consistent with existing platform design

## Navigation

The Ideas page is accessible via:
- Main navigation menu (desktop)
- Mobile navigation menu
- Direct URL: `/ideas`

## Usage

### Adding a New Idea
1. Click "Add New Idea" button
2. Fill in title and description (required)
3. Select genre and status (optional)
4. Add AI prompt for development (optional)
5. Click "Save Idea"

### Editing an Idea
1. Click the edit icon on any idea card
2. Modify the fields as needed
3. Click "Update Idea"

### Deleting an Idea
1. Click the delete icon on any idea card
2. Idea is permanently removed

### Searching and Filtering
- Use the search bar to find ideas by content
- Use genre and status filters to narrow results
- Filters can be combined with search terms

## Technical Implementation

### Components
- `app/ideas/page.tsx`: Main ideas page
- `app/ideas/loading.tsx`: Loading skeleton
- `lib/movie-ideas-service.ts`: Service layer for database operations

### Dependencies
- Uses existing UI components from `@/components/ui`
- Integrates with authentication context
- Uses toast notifications for user feedback

### State Management
- Local state for form inputs
- Real-time filtering and search
- Optimistic updates for better UX

## Future Enhancements

Potential improvements could include:
- AI-powered idea generation
- Idea sharing and collaboration
- Integration with other platform features
- Export/import functionality
- Advanced analytics and insights

## Troubleshooting

### Common Issues

1. **Ideas not loading**: Check if user is authenticated
2. **Database errors**: Verify the migration was run successfully
3. **Permission errors**: Ensure RLS policies are properly configured

### Debug Steps

1. Check browser console for errors
2. Verify database table exists and has correct structure
3. Confirm user authentication is working
4. Check Supabase logs for any backend errors

## Support

If you encounter issues:
1. Check the browser console for error messages
2. Verify database setup and permissions
3. Ensure all required dependencies are installed
4. Check authentication context is properly configured
