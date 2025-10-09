# Actor Casting & Audition System Guide

This guide explains how to use the Actor Casting system for managing casting calls and actor submissions in your cinema platform.

## Overview

The casting system allows movie creators to:
- Set up casting calls for their movies
- Configure what materials actors can view (script, scenes, timeline, storyboards)
- Specify available roles
- Receive and manage actor submissions with photos and videos
- Review applications and track submission status

## Database Setup

### 1. Run the SQL Migration

Execute the migration script in your Supabase SQL Editor:

```bash
supabase/actor-submissions-setup.sql
```

This creates:
- `casting_settings` table: Stores casting call configuration per movie
- `actor_submissions` table: Stores actor applications

### 2. Create Storage Bucket

In Supabase Dashboard:
1. Go to **Storage** section
2. Create a new bucket named: `actor-submissions`
3. Set it as **Public** (so actors can upload files)
4. Configure:
   - File size limit: **50MB**
   - Allowed MIME types: `image/*`, `video/*`, `application/pdf`

### 3. Set Storage Policies

Add these policies to the `actor-submissions` bucket:

```sql
-- Allow public uploads
CREATE POLICY "Anyone can upload submissions"
ON storage.objects FOR INSERT
WITH CHECK (bucket_id = 'actor-submissions');

-- Allow public reads
CREATE POLICY "Anyone can view submissions"
ON storage.objects FOR SELECT
USING (bucket_id = 'actor-submissions');

-- Allow owners to delete
CREATE POLICY "Owners can delete submissions"
ON storage.objects FOR DELETE
USING (
  bucket_id = 'actor-submissions' 
  AND auth.uid() IN (
    SELECT user_id FROM public.projects 
    WHERE id::text = (storage.foldername(name))[1]
  )
);
```

## For Movie Creators/Directors

### Setting Up a Casting Call

1. **Navigate to Your Movie**
   - Go to the Movies page
   - Click on your movie card or select a movie
   - Click the **"Casting"** button

2. **Configure Casting Settings**
   - Click **"Casting Settings"** button (visible only to you as the owner)
   - Configure visibility options:
     - **Show Script**: Allow actors to view the script/treatment
     - **Show Scenes**: Display scene breakdown
     - **Show Timeline**: Share production timeline
     - **Show Storyboard**: Show storyboard shots
   
3. **Add Available Roles**
   - Enter role names (e.g., "Lead Actor", "Supporting Role", "Villain")
   - Click the **+** button or press Enter to add each role
   - Remove roles by clicking the **X** on each tag

4. **Set Submission Deadline**
   - Select a date and time for the casting call deadline
   - Actors will see this deadline on the casting page

5. **Add Casting Notes**
   - Provide special instructions or requirements
   - Describe what you're looking for in actors
   - Mention any specific skills needed (accent, physical requirements, etc.)

6. **Activate Casting Call**
   - Toggle **"Casting Call Active"** to allow submissions
   - When inactive, actors cannot submit applications

7. **Save Settings**
   - Click **"Save Settings"** to apply your configuration

### Managing Submissions

#### Viewing Applications

On the casting page, you'll see all submissions in the **"Actor Submissions"** section:

- **Actor Information**: Name, email, phone
- **Role Applied For**: Which role they're interested in
- **Cover Letter**: Their pitch (first 3 lines shown)
- **Media Files**: Quick access buttons for:
  - Headshot
  - Demo Reel/Video
  - Resume/CV
  - Additional photos

#### Reviewing Submissions

1. **Update Status**
   - Use the dropdown to change submission status:
     - **Pending**: Initial status (yellow)
     - **Reviewing**: Currently under review (blue)
     - **Shortlisted**: Selected for next round (green)
     - **Accepted**: Offered the role (purple)
     - **Rejected**: Not selected (red)

2. **View Full Details**
   - Click the **eye icon** to open detailed view
   - See full cover letter and experience
   - View all uploaded media (headshots, videos, photos)
   - Add internal notes about the applicant
   - Watch demo reels inline

3. **Delete Submissions**
   - Click the **trash icon** to remove a submission
   - Confirms before deletion

#### Internal Notes

- Click **"View Details"** on any submission
- Scroll to **"Internal Notes"** section
- Add notes that only you (the owner) can see
- Track callback decisions, audition dates, etc.

### Sharing the Casting Page

Share the casting page URL with actors:
```
https://your-domain.com/casting/[movie-id]
```

Actors can:
- View the movie information
- See only the materials you've enabled
- Submit their applications with files
- Cannot see other submissions or your settings

## For Actors

### Applying to a Casting Call

1. **Visit the Casting Page**
   - Receive the casting page link from the production team
   - View movie details and available roles

2. **Review Materials**
   - Check what materials are shared:
     - Script/Treatment (if enabled)
     - Scenes breakdown (if enabled)
     - Production timeline (if enabled)
     - Storyboard shots (if enabled)

3. **Submit Application**
   - Click **"Apply for Role"** button
   - Fill in required information:
     - **Full Name** * (required)
     - **Email** * (required)
     - Phone number (optional)
     - Role you're applying for
     - Cover letter explaining why you're perfect for the role
     - Your acting experience

4. **Upload Materials**
   - **Headshot**: Professional photo (jpg, png)
   - **Demo Reel**: Video showcasing your work (mp4, mov, etc.)
   - **Resume/CV**: PDF or Word document
   - **Additional Photos**: Extra photos if needed

5. **Submit**
   - Review all information
   - Click **"Submit Application"**
   - You'll receive a confirmation message

### File Requirements

- **Images**: JPG, PNG, GIF, WebP
- **Videos**: MP4, MOV, AVI, WebM
- **Documents**: PDF, DOC, DOCX
- **Size Limit**: 50MB per file

## Features

### Owner-Only Features

✅ Casting settings panel (invisible to actors)  
✅ View all submissions  
✅ Update submission status  
✅ Add internal notes  
✅ Delete submissions  
✅ Configure visibility of materials  

### Actor Features

✅ View movie details and cover  
✅ See available roles  
✅ View shared materials (script, scenes, etc.)  
✅ Submit applications with cover letter  
✅ Upload headshots, videos, resume  
✅ Add multiple photos  

### Security & Privacy

- **Row Level Security (RLS)**: Only movie owners can see submissions
- **Public Submissions**: Actors don't need accounts to apply
- **Secure Storage**: Files stored in Supabase storage with proper policies
- **Settings Privacy**: Casting settings only visible to movie owner

## API & Services

### CastingService Methods

#### Casting Settings

```typescript
// Get settings for a movie
CastingService.getCastingSettings(movieId: string)

// Create or update settings
CastingService.upsertCastingSettings(movieId: string, settings: Partial<CreateCastingSettingData>)

// Delete settings
CastingService.deleteCastingSettings(movieId: string)
```

#### Actor Submissions

```typescript
// Get all submissions for a movie (owner only)
CastingService.getSubmissionsForMovie(movieId: string)

// Submit an application (public)
CastingService.submitActorApplication(submissionData: CreateActorSubmissionData)

// Update submission status (owner only)
CastingService.updateSubmission(submissionId: string, updates: UpdateActorSubmissionData)

// Delete submission (owner only)
CastingService.deleteSubmission(submissionId: string)

// Upload files to storage
CastingService.uploadFile(file: File, folder: 'headshots' | 'videos' | 'resumes' | 'photos', movieId: string)

// Get public casting data (for display)
CastingService.getPublicCastingData(movieId: string)
```

## Troubleshooting

### Actors Can't Upload Files

**Solution**: Check storage bucket configuration
1. Verify `actor-submissions` bucket exists
2. Ensure bucket is set to **Public**
3. Check storage policies allow public uploads

### Owner Can't See Submissions

**Solution**: Verify RLS policies
1. Check that user owns the movie (`projects.user_id = auth.uid()`)
2. Verify RLS policies are enabled
3. Check browser console for errors

### Files Not Uploading

**Solution**: Check file size and type
1. Files must be under 50MB
2. Verify MIME types are allowed in bucket settings
3. Check browser console for upload errors

### Settings Not Saving

**Solution**: Check authentication
1. User must be logged in
2. User must own the movie
3. Check network tab for API errors

## Database Schema

### casting_settings

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| movie_id | UUID | Reference to projects table (unique) |
| user_id | UUID | Owner's user ID |
| show_script | BOOLEAN | Show script to actors |
| show_scenes | BOOLEAN | Show scenes to actors |
| show_timeline | BOOLEAN | Show timeline to actors |
| show_storyboard | BOOLEAN | Show storyboard to actors |
| roles_available | TEXT[] | Array of role names |
| submission_deadline | TIMESTAMP | Deadline for submissions |
| casting_notes | TEXT | Notes for actors |
| is_active | BOOLEAN | Casting call is active |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

### actor_submissions

| Column | Type | Description |
|--------|------|-------------|
| id | UUID | Primary key |
| movie_id | UUID | Reference to projects table |
| actor_name | VARCHAR | Actor's full name |
| actor_email | VARCHAR | Actor's email |
| actor_phone | VARCHAR | Actor's phone (optional) |
| role_applying_for | VARCHAR | Role name |
| cover_letter | TEXT | Cover letter |
| experience | TEXT | Acting experience |
| headshot_url | TEXT | Headshot image URL |
| video_url | TEXT | Demo reel URL |
| resume_url | TEXT | Resume/CV URL |
| additional_photos | TEXT[] | Array of photo URLs |
| submission_date | TIMESTAMP | Submission time |
| status | VARCHAR | Status (pending/reviewing/shortlisted/rejected/accepted) |
| notes | TEXT | Internal notes (owner only) |
| created_at | TIMESTAMP | Record creation time |
| updated_at | TIMESTAMP | Last update time |

## Best Practices

### For Movie Creators

1. **Be Clear About Roles**: Provide detailed role descriptions in casting notes
2. **Set Realistic Deadlines**: Give actors enough time to prepare materials
3. **Review Regularly**: Check submissions frequently and update statuses
4. **Communicate**: Use status updates to keep actors informed
5. **Share Wisely**: Only enable materials that are necessary for casting

### For Actors

1. **Professional Materials**: Use high-quality headshots and demo reels
2. **Tailor Your Application**: Customize cover letter for each role
3. **Be Concise**: Keep cover letter focused and relevant
4. **Follow Instructions**: Pay attention to casting notes and requirements
5. **Update Resume**: Keep your acting resume current

## Future Enhancements

Potential features to add:

- [ ] Email notifications for submission status updates
- [ ] Scheduled callbacks/auditions calendar
- [ ] Video audition requests and submissions
- [ ] Character breakdown templates
- [ ] Collaborative casting (multiple casting directors)
- [ ] Integration with casting networks
- [ ] Analytics and submission insights

## Support

For issues or questions:
1. Check this documentation
2. Review the Troubleshooting section
3. Check database logs in Supabase
4. Verify RLS policies and storage settings

---

**Created**: October 2025  
**Version**: 1.0

