# Session Recovery Guide

## Issue: User Authentication Lost During Shot Creation

### What Happened:
- User was creating shots in shot mode
- First shot was created successfully
- User session expired or was lost during the process
- Second shot creation failed with "User not authenticated" error

### Root Cause:
The user session expired or was lost during the shot creation process, causing subsequent operations to fail.

### Solutions Implemented:

1. **Session Recovery in Backend** (`lib/storyboards-service.ts`):
   - Added automatic session refresh when user authentication fails
   - If `getUser()` fails, tries `getSession()` to recover the session
   - Provides clear error message if session cannot be recovered

2. **Better Error Handling in Frontend** (`app/(protected)/storyboards/[sceneId]/page.tsx`):
   - Added specific error messages for authentication issues
   - Clear instructions to refresh the page when session expires
   - Better user feedback for different error types

### How to Handle This Issue:

1. **If you see "User not authenticated" error**:
   - Refresh the page (F5 or Ctrl+R)
   - Try creating the shot again
   - The session should be automatically recovered

2. **If the error persists**:
   - Check if you're still logged in
   - If not, log in again
   - Try creating the shot again

3. **Prevention**:
   - Avoid leaving the page idle for too long
   - If working on multiple shots, create them in quick succession
   - The system now has better session recovery, so this should happen less often

### Technical Details:
- Session recovery attempts to refresh the authentication token
- If successful, operations continue normally
- If failed, user gets clear instructions to refresh the page
- All error messages are now more user-friendly
