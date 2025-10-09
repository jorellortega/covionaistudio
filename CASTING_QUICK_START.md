# Casting System - Quick Start

## Setup (5 minutes)

### 1. Run Database Migration

In your Supabase SQL Editor, run:
```sql
-- Execute this file
supabase/actor-submissions-setup.sql
```

This creates two tables:
- `casting_settings` - Your casting call configuration
- `actor_submissions` - Actor applications with files

### 2. Create Storage Bucket

In Supabase Dashboard → Storage:
1. Click "New bucket"
2. Name: `actor-submissions`
3. Set to **Public**
4. Max file size: 50MB
5. Allowed types: `image/*`, `video/*`, `application/pdf`

### 3. Add Storage Policies

In Supabase SQL Editor:
```sql
-- Allow public uploads
CREATE POLICY "Anyone can upload submissions"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'actor-submissions');

-- Allow public reads
CREATE POLICY "Anyone can view submissions"
ON storage.objects FOR SELECT
USING (bucket_id = 'actor-submissions');
```

## Usage

### For You (Movie Owner)

1. **Go to your movie** in the Movies page
2. Click **"Casting"** button
3. Click **"Casting Settings"** (only you see this)
4. Configure:
   - Toggle what actors can see (script, scenes, timeline, storyboards)
   - Add available roles
   - Set submission deadline
   - Add casting notes
   - Activate casting call
5. **Save Settings**

### Actors Can Now:
- Visit the casting page URL
- View your movie and shared materials
- Apply with:
  - Cover letter
  - Experience
  - Headshot photo
  - Demo reel video
  - Resume
  - Additional photos

### You Can:
- View all submissions
- Update status (pending → reviewing → shortlisted → accepted/rejected)
- Add internal notes
- View all uploaded media
- Delete submissions

## URL Structure

```
Your Domain/casting/[movie-id]
```

Example:
```
https://yoursite.com/casting/123e4567-e89b-12d3-a456-426614174000
```

Share this link with actors!

## Features Built

✅ **Settings Panel** (Owner-only, invisible to actors)
✅ **Material Visibility** (Control what actors see)
✅ **Role Management** (Add/remove available roles)
✅ **File Uploads** (Headshots, videos, resumes, photos)
✅ **Submission Forms** (Actors can apply without login)
✅ **Status Tracking** (5 statuses: pending/reviewing/shortlisted/rejected/accepted)
✅ **Internal Notes** (Private notes only you see)
✅ **Media Preview** (View photos and videos inline)

## Files Created

### Database
- `supabase/actor-submissions-setup.sql` - Database schema

### Services
- `lib/casting-service.ts` - Backend logic for casting & submissions

### Pages
- `app/(protected)/casting/[movieId]/page.tsx` - Main casting page

### Documentation
- `ACTOR_CASTING_GUIDE.md` - Complete documentation
- `CASTING_QUICK_START.md` - This file

### Updated
- `app/(protected)/movies/page.tsx` - Added "Casting" button to movie cards

## Security

- ✅ Row Level Security enabled
- ✅ Only movie owner can see submissions
- ✅ Only movie owner can see settings
- ✅ Anyone can submit (no login required)
- ✅ Secure file storage with policies

## Next Steps

1. Run the database migration
2. Create the storage bucket
3. Add storage policies
4. Navigate to a movie and click "Casting"
5. Configure your first casting call
6. Share the URL with actors

## Need Help?

See the full documentation in `ACTOR_CASTING_GUIDE.md` for:
- Detailed feature explanations
- Troubleshooting guide
- API documentation
- Database schema reference
- Best practices

---

**Ready to cast!** 🎬⭐

