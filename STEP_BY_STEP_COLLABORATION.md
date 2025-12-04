# Step-by-Step: Create Collaboration Session for One Project

## Quick Start (5 Minutes)

### Step 1: Run the Migration

Make sure the database migration is applied. If you haven't run it yet:

1. Go to your Supabase dashboard
2. Navigate to SQL Editor
3. Copy and paste the contents of `supabase/migrations/057_create_collaboration_sessions.sql`
4. Click "Run"

Or if using Supabase CLI:
```bash
supabase migration up
```

### Step 2: Go to Your Project's Screenplay Page

1. Navigate to your project (e.g., `/screenplay/[your-project-id]`)
2. Look for the **"Start Collaboration"** button in the top action bar
3. Click it

### Step 3: Fill in the Collaboration Form

In the dialog that opens:

1. **Title** (optional): Give it a name like "Act 1 Collaboration"
2. **Description** (optional): Add notes about what you're working on
3. **Expiration** (optional): Set when access should expire
4. **Permissions**: Check/uncheck what collaborators can do:
   - ✅ Allow guests (no login required)
   - ✅ Allow editing text
   - ✅ Allow deleting text
   - ✅ Allow adding scenes
   - ✅ Allow editing scene info

### Step 4: Create the Session

1. Click **"Create Session"**
2. Wait a moment for it to generate
3. You'll see:
   - **Access Code**: A unique 8-character code (e.g., `ABC12345`)
   - **Share URL**: The full URL to share

### Step 5: Copy and Share

1. Click the copy button next to the **Access Code** or **Share URL**
2. Send it to your collaborators via:
   - Email
   - Slack/Discord
   - Text message
   - Any messaging app

### Step 6: Collaborators Join

Your collaborators:

1. Open the URL you shared (e.g., `http://localhost:3000/collaborate/ABC12345`)
2. They'll see:
   - All scenes for the project
   - Scene selector at the top
   - Script content with AI editing
   - Sidebar with session info
3. They can start editing immediately!

## Example: Real Workflow

Let's say you have a project with ID: `1a8175d0-e6a6-451e-abc4-7cec36227a95`

### You (Project Owner):

1. Go to: `http://localhost:3000/screenplay/1a8175d0-e6a6-451e-abc4-7cec36227a95`
2. Click **"Start Collaboration"** button
3. Fill in:
   - Title: "Act 1 Review"
   - Description: "Working on Act 1 scenes with the team"
   - Expiration: Leave blank (or set to next week)
   - Permissions: Check all boxes
4. Click **"Create Session"**
5. Get access code: `XYZ789AB`
6. Share: `http://localhost:3000/collaborate/XYZ789AB`

### Your Collaborator:

1. Opens: `http://localhost:3000/collaborate/XYZ789AB`
2. Sees all scenes in a dropdown
3. Selects a scene
4. Clicks "Edit Content"
5. Starts typing - changes save automatically
6. Other collaborators see changes within 2 seconds

## Alternative: Using Browser Console

If you prefer to use the API directly:

1. Open your project's screenplay page
2. Open browser console (F12)
3. Run this code (replace `YOUR_PROJECT_ID`):

```javascript
const projectId = 'YOUR_PROJECT_ID' // Get this from the URL

fetch('/api/collaboration/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    project_id: projectId,
    title: 'My Collaboration',
    allow_guests: true,
    allow_edit: true,
    allow_delete: true,
    allow_add_scenes: true,
    allow_edit_scenes: true,
  })
})
.then(res => res.json())
.then(data => {
  console.log('✅ Session Created!')
  console.log('Access Code:', data.session.access_code)
  console.log('Share URL:', `${window.location.origin}/collaborate/${data.session.access_code}`)
  
  // Copy to clipboard
  navigator.clipboard.writeText(data.session.access_code)
  console.log('✅ Access code copied to clipboard!')
})
.catch(err => console.error('Error:', err))
```

## Managing Your Session

### View All Sessions

```javascript
// In browser console on any page
fetch('/api/collaboration/sessions?project_id=YOUR_PROJECT_ID')
  .then(res => res.json())
  .then(data => console.table(data.sessions))
```

### Revoke Access (Stop Collaboration)

```javascript
// Get session ID from the sessions list above
fetch(`/api/collaboration/${sessionId}/revoke`, {
  method: 'POST'
})
.then(() => console.log('✅ Session revoked'))
```

### Extend Expiration

```javascript
fetch(`/api/collaboration/${sessionId}/renew`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    expires_at: '2025-12-31T23:59:59Z'
  })
})
.then(() => console.log('✅ Session renewed'))
```

## Troubleshooting

### "Invalid Access Code"
- Check the code is correct (case-sensitive)
- Verify the session hasn't expired
- Check if the session was revoked

### "No Scenes Available"
- Make sure your project has scenes in the timeline
- Scenes are loaded from the project's timeline

### Changes Not Syncing
- Updates happen every 2 seconds (polling)
- Make sure you click "Save" after editing
- Refresh the page if needed

## Tips

1. **Set Expiration**: Always set an expiration for security
2. **Limit Permissions**: Only enable what collaborators need
3. **Use Descriptive Titles**: Makes it easy to find sessions later
4. **Monitor Active Sessions**: Regularly check and revoke old ones
5. **Test First**: Create a test session to verify everything works

## What Collaborators Can Do

Based on permissions:

- ✅ **Edit Text**: Modify screenplay content
- ✅ **Delete Text**: Clear scene content
- ✅ **Add Scenes**: Create new scenes
- ✅ **Edit Scenes**: Change scene titles, numbers, locations
- ✅ **AI Editing**: Use AI text editor features
- ✅ **Real-time Updates**: See changes from others

## Next Steps

Once collaboration is set up:

1. Share the access code with your team
2. Monitor the collaboration page
3. Revoke when done
4. Create new sessions for different parts of the project

That's it! You're ready to collaborate! 🎬






















