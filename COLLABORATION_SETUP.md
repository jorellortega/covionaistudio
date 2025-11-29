# Collaboration Feature Setup Guide

## Overview

A collaborative editing system has been implemented that allows multiple users (including guests) to work together on screenplay text in real-time using access codes.

## Features

- **Access Code System**: Generate unique access codes for collaboration sessions
- **Guest Access**: Guests can access and edit without authentication
- **Real-time Updates**: Changes are synced across all participants (polling every 2 seconds)
- **Scene Management**: Add, edit, and navigate through scenes
- **AI Text Editing**: Full AI text editing features integrated
- **Permissions**: Granular control over what guests can do (edit, delete, add scenes, etc.)
- **Expiration & Revocation**: Access codes can expire and be revoked/renewed

## Database Schema

### Migration File
`supabase/migrations/057_create_collaboration_sessions.sql`

### Table: `collaboration_sessions`
- `id`: UUID primary key
- `project_id`: References projects table
- `user_id`: Owner of the session
- `access_code`: Unique 8-character code for access
- `title`: Optional session title
- `description`: Optional description
- `expires_at`: Optional expiration timestamp
- `is_revoked`: Boolean flag for revocation
- `revoked_at`: Timestamp when revoked
- `max_participants`: Optional limit on participants
- `allow_guests`: Allow guest access
- `allow_edit`: Allow text editing
- `allow_delete`: Allow text deletion
- `allow_add_scenes`: Allow adding new scenes
- `allow_edit_scenes`: Allow editing scene metadata
- `metadata`: JSONB for additional data

## API Routes

### Create Session
`POST /api/collaboration/create`
- Requires authentication
- Creates a new collaboration session
- Returns session with generated access code

### Validate Access Code
`POST /api/collaboration/validate`
- Public endpoint
- Validates access code and returns session if valid

### Get/Update/Delete Session
`GET/PATCH/DELETE /api/collaboration/[sessionId]`
- Requires authentication
- Manage session settings

### Revoke Session
`POST /api/collaboration/[sessionId]/revoke`
- Requires authentication
- Revokes access code

### Renew Session
`POST /api/collaboration/[sessionId]/renew`
- Requires authentication
- Extends expiration date

### Get Scenes (Guest)
`GET /api/collaboration/scenes?access_code=XXX`
- Public endpoint (validates access code)
- Returns all scenes for the project

### Get Scene (Guest)
`GET /api/collaboration/scenes/[sceneId]?access_code=XXX`
- Public endpoint (validates access code)
- Returns specific scene content

### Update Scene (Guest)
`PATCH /api/collaboration/scenes/[sceneId]`
- Public endpoint (validates access code)
- Updates scene content/metadata

### Create Scene (Guest)
`POST /api/collaboration/scenes`
- Public endpoint (validates access code)
- Creates new scene

## Services

### CollaborationService
Location: `lib/collaboration-service.ts`

Methods:
- `createSession()`: Create new collaboration session
- `getSessionByCode()`: Get session by access code (works for guests)
- `getSessionById()`: Get session by ID (requires auth)
- `getSessionsByProject()`: Get all sessions for a project
- `updateSession()`: Update session settings
- `revokeSession()`: Revoke access code
- `renewSession()`: Extend expiration
- `deleteSession()`: Delete session
- `validateAccessCode()`: Validate and return session

## Page

### Collaborative Editing Page
Location: `app/collaborate/[code]/page.tsx`

Features:
- Scene selector dropdown at the top (like timeline-scene page)
- Script card with AI text editing features
- Sidebar with session info and permissions
- Real-time content updates (polling)
- Add/edit/delete scenes
- Full AI text editor integration

## Usage

### Creating a Collaboration Session

```typescript
const response = await fetch('/api/collaboration/create', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    project_id: 'your-project-id',
    title: 'My Collaboration Session',
    description: 'Working on Act 1',
    expires_at: '2024-12-31T23:59:59Z', // Optional
    allow_guests: true,
    allow_edit: true,
    allow_delete: true,
    allow_add_scenes: true,
    allow_edit_scenes: true,
  })
})

const { session } = await response.json()
const accessCode = session.access_code // Share this code
```

### Accessing the Collaboration Page

Users (including guests) can access the page at:
```
/collaborate/[access_code]
```

For example:
```
/collaborate/ABC12345
```

### Managing Sessions

```typescript
// Revoke a session
await fetch(`/api/collaboration/${sessionId}/revoke`, {
  method: 'POST'
})

// Renew a session (extend expiration)
await fetch(`/api/collaboration/${sessionId}/renew`, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    expires_at: '2025-01-31T23:59:59Z'
  })
})

// Update session settings
await fetch(`/api/collaboration/${sessionId}`, {
  method: 'PATCH',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    allow_edit: false,
    title: 'Updated Title'
  })
})
```

## Security Considerations

1. **Access Code Validation**: All guest endpoints validate the access code server-side
2. **Permission Checks**: Each operation checks session permissions
3. **Project Verification**: Scene operations verify the scene belongs to the project
4. **RLS Policies**: Database-level security for collaboration_sessions table
5. **Guest Limitations**: Some operations (like scene deletion) may require authentication

## Real-time Updates

Currently implemented using polling (every 2 seconds) for simplicity and to work with guest users. For a production system with authenticated users, you could switch to Supabase Realtime subscriptions for true real-time updates.

## Next Steps

1. Run the migration: `supabase/migrations/057_create_collaboration_sessions.sql`
2. Create collaboration sessions from your project pages
3. Share access codes with collaborators
4. Collaborate in real-time!

## Notes

- Scene deletion for guests is currently disabled (requires authentication)
- Real-time updates use polling instead of WebSockets for guest compatibility
- The access code is 8 characters and auto-generated
- Sessions can be revoked, renewed, or deleted by the owner










