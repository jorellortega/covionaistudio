# Collaboration Quick Start Guide

## Step-by-Step: Create a Collaboration Session for Your Project

### Step 1: Run the Database Migration

First, make sure the database migration has been run:

```bash
# If using Supabase CLI
supabase migration up

# Or run the SQL file directly in your Supabase dashboard
# File: supabase/migrations/057_create_collaboration_sessions.sql
```

### Step 2: Navigate to Your Project

Go to any project page where you want to enable collaboration. For example:
- `/screenplay/[project-id]` - Screenplay page
- `/timeline?movie=[project-id]` - Timeline page

### Step 3: Create a Collaboration Session

#### Option A: Using the UI Button (Recommended)

1. On the screenplay page, look for the **"Start Collaboration"** button
2. Click it to open the collaboration dialog
3. Fill in the details:
   - **Title**: "Act 1 Collaboration" (optional)
   - **Description**: "Working on Act 1 scenes" (optional)
   - **Expiration**: Set when the session should expire (optional)
   - **Permissions**: 
     - ✅ Allow guests
     - ✅ Allow editing
     - ✅ Allow deleting
     - ✅ Allow adding scenes
     - ✅ Allow editing scenes
4. Click **"Create Session"**
5. Copy the access code that appears

#### Option B: Using the API Directly

Open your browser console and run:

```javascript
// Replace 'YOUR_PROJECT_ID' with your actual project ID
const projectId = 'YOUR_PROJECT_ID'

fetch('/api/collaboration/create', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({
    project_id: projectId,
    title: 'My Collaboration Session',
    description: 'Working on screenplay together',
    expires_at: null, // or '2024-12-31T23:59:59Z' for expiration
    allow_guests: true,
    allow_edit: true,
    allow_delete: true,
    allow_add_scenes: true,
    allow_edit_scenes: true,
  })
})
.then(res => res.json())
.then(data => {
  console.log('Access Code:', data.session.access_code)
  console.log('Share this URL:', `/collaborate/${data.session.access_code}`)
})
```

### Step 4: Share the Access Code

You'll get an access code like: `ABC12345`

Share this with your collaborators in one of these ways:

1. **Share the full URL**: 
   ```
   http://localhost:3000/collaborate/ABC12345
   ```

2. **Share just the code**: 
   ```
   Access Code: ABC12345
   Go to: /collaborate/ABC12345
   ```

### Step 5: Collaborators Access the Page

Anyone with the access code can:

1. Navigate to `/collaborate/[access-code]`
2. They'll see:
   - All scenes for the project
   - Scene selector dropdown at the top
   - Script content with AI editing features
   - Sidebar with session info and permissions
3. They can:
   - Edit text in real-time
   - Add new scenes
   - Edit scene titles and metadata
   - Use AI text editing features
   - See updates from other collaborators (updates every 2 seconds)

### Step 6: Manage Your Session

#### View All Sessions for a Project

```javascript
// In browser console
fetch('/api/collaboration/sessions?project_id=YOUR_PROJECT_ID')
  .then(res => res.json())
  .then(data => console.log(data.sessions))
```

#### Revoke a Session (Stop Access)

```javascript
fetch(`/api/collaboration/${sessionId}/revoke`, {
  method: 'POST'
})
```

#### Renew a Session (Extend Expiration)

```javascript
fetch(`/api/collaboration/${sessionId}/renew`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    expires_at: '2025-01-31T23:59:59Z'
  })
})
```

#### Update Session Settings

```javascript
fetch(`/api/collaboration/${sessionId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    allow_edit: false, // Disable editing
    title: 'Updated Title'
  })
})
```

## Example: Complete Workflow

1. **You create a session**:
   ```javascript
   // Get your project ID from the URL or page
   const projectId = '1a8175d0-e6a6-451e-abc4-7cec36227a95'
   
   const response = await fetch('/api/collaboration/create', {
     method: 'POST',
     headers: { 'Content-Type': 'application/json' },
     body: JSON.stringify({
       project_id: projectId,
       title: 'Act 1 Collaboration',
       allow_guests: true,
       allow_edit: true,
     })
   })
   
   const { session } = await response.json()
   console.log('Share this:', `/collaborate/${session.access_code}`)
   ```

2. **Share with collaborator**: 
   - Send them: `http://localhost:3000/collaborate/ABC12345`

3. **They access and edit**:
   - They go to the URL
   - They see all scenes
   - They can edit text, add scenes, etc.
   - Changes sync every 2 seconds

4. **You revoke when done**:
   ```javascript
   fetch(`/api/collaboration/${sessionId}/revoke`, {
     method: 'POST'
   })
   ```

## Troubleshooting

### "Invalid Access Code" Error
- Check that the session hasn't expired
- Check that the session hasn't been revoked
- Verify the access code is correct

### Can't See Scenes
- Make sure the project has scenes in the timeline
- Check that the access code is valid

### Changes Not Syncing
- Real-time updates use polling (every 2 seconds)
- Make sure you're not in edit mode (click "Save" first)
- Refresh the page if needed

## Tips

- **Set Expiration**: Always set an expiration date for security
- **Limit Permissions**: Only enable permissions collaborators need
- **Monitor Sessions**: Regularly check and revoke old sessions
- **Use Descriptive Titles**: Name sessions clearly (e.g., "Act 1 - Scene 5 Review")




