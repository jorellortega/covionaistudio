# 🎬 Movies Setup Guide

This guide will help you get the `/movies` page working with real database functionality.

## 🚀 Quick Setup

### 1. Environment Variables

Create a `.env.local` file in your project root with your Supabase credentials:

```bash
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_anon_key_here
SUPABASE_SERVICE_ROLE_KEY=your_service_role_key_here
```

**To get these values:**
1. Go to your Supabase project dashboard
2. Navigate to Settings → API
3. Copy the Project URL and anon/public key
4. Copy the service_role key (for migrations)

### 2. Database Setup

**Option A: Simple Setup (Recommended)**
1. Go to your Supabase Dashboard → SQL Editor
2. Copy the contents of `supabase/migrate-with-movies.sql`
3. Paste and run the SQL
4. You should see success messages

**Option B: Migration Files (Advanced)**
If you prefer to use the migration system:
1. Run: `node scripts/migrate.js migrate`
2. This will apply all migrations including the movie support

### 3. Test the Setup

1. Start your development server: `npm run dev`
2. Navigate to `/movies`
3. Try creating a new movie project
4. The movie should appear in the list

## 🎯 What's Working Now

✅ **Create Movies** - Add new movie projects with title, description, genre, and status
✅ **List Movies** - View all your movie projects
✅ **Search & Filter** - Search by title/description and filter by status
✅ **Delete Movies** - Remove movie projects
✅ **Real-time Updates** - Changes reflect immediately in the UI
✅ **Error Handling** - Toast notifications for success/error states
✅ **Loading States** - Proper loading indicators

## 🔧 How It Works

### Database Structure
- **projects table** - Stores all projects including movies
- **project_type** - Distinguishes movies from other project types
- **movie_status** - Tracks production status (Pre-Production, Production, etc.)
- **Row Level Security** - Users can only see their own movies

### Frontend Integration
- **MovieService** - Handles all database operations
- **Real-time Updates** - UI updates immediately after database changes
- **Type Safety** - Full TypeScript support with Supabase types
- **Error Handling** - User-friendly error messages

## 🎨 Customization

### Add Movie Fields
To add more movie-specific fields, modify the `projects` table:

```sql
ALTER TABLE public.projects 
ADD COLUMN budget DECIMAL(10,2),
ADD COLUMN cast TEXT[],
ADD COLUMN crew TEXT[];
```

### Update Types
After modifying the database, update `lib/supabase.ts` with the new fields.

## 🚨 Troubleshooting

### Common Issues

1. **"Failed to load movies"**
   - Check your `.env.local` file
   - Verify Supabase URL and keys
   - Check browser console for errors

2. **"User not authenticated"**
   - Make sure you're signed in
   - Check if auth is working

3. **Database errors**
   - Verify the migration ran successfully
   - Check Supabase logs for SQL errors

### Debug Steps

1. **Check Browser Console** - Look for error messages
2. **Verify Environment** - Ensure `.env.local` is correct
3. **Check Supabase** - Verify tables exist in Table Editor
4. **Test Authentication** - Try signing in/out

## 🔄 Next Steps

Once movies are working, you can:

1. **Add Timeline Support** - Link movies to timelines
2. **Scene Management** - Add scenes to movie timelines
3. **Asset Management** - Upload and organize movie assets
4. **AI Integration** - Use AI tools for script writing, storyboarding
5. **Collaboration** - Add team members to movie projects

## 📚 Files Modified

- `app/movies/page.tsx` - Updated to use real data
- `lib/movie-service.ts` - New service for movie operations
- `lib/supabase.ts` - Updated types for movie support
- `supabase/migrate-with-movies.sql` - Complete database setup

## 🆘 Need Help?

1. Check the troubleshooting section above
2. Review Supabase logs in your dashboard
3. Check browser console for detailed error messages
4. Verify your environment variables are correct

---

**🎉 You're all set!** The movies page should now be fully functional with real database storage.
