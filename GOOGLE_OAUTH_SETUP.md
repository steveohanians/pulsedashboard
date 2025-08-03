# Google OAuth 2.0 Setup for GA4 Integration

## Overview
To enable Google Analytics 4 (GA4) data access for Pulse Dashboard™, you need to create OAuth 2.0 credentials in Google Cloud Console. This allows secure access to GA4 data without managing complex service account JSON files.

## Step-by-Step Setup Instructions

### 1. Access Google Cloud Console
- Go to [Google Cloud Console](https://console.cloud.google.com/)
- Sign in with your Google account (preferably a Clear Digital company account)

### 2. Create or Select a Project
- If you don't have a project: Click "New Project" and name it (e.g., "Clear Digital Analytics")
- If you have a project: Select it from the dropdown at the top

### 3. Enable Required APIs
- In the left sidebar, go to "APIs & Services" → "Library"
- Search for and enable these APIs:
  - **Google Analytics Reporting API v4**
  - **Google Analytics Data API v1** (for GA4)
  - **Google Analytics Admin API v1**

### 4. Configure OAuth Consent Screen
- Go to "APIs & Services" → "OAuth consent screen"
- Choose "External" (unless you have a Google Workspace domain)
- Fill out required fields:
  - **App name**: "Pulse Dashboard GA4 Integration"
  - **User support email**: Your email
  - **Developer contact email**: Your email
- Add scopes (click "Add or Remove Scopes"):
  - `https://www.googleapis.com/auth/analytics.readonly`
  - `https://www.googleapis.com/auth/analytics.manage.users.readonly`
- Save and continue through all steps

### 5. Create OAuth 2.0 Credentials
- Go to "APIs & Services" → "Credentials"
- Click "Create Credentials" → "OAuth 2.0 Client IDs"
- Application type: "Web application"
- Name: "Pulse Dashboard OAuth Client"
- Authorized redirect URIs: Add this exact URL:
  ```
  https://YOUR_REPLIT_URL/api/oauth/google/callback
  ```
  **Note**: Replace `YOUR_REPLIT_URL` with your actual Replit app URL (e.g., `https://abcd1234-5678-9012-3456-789012345678-00-1a2b3c4d5e6f.janeway.replit.dev`)

### 6. Get Your Credentials
After creating the OAuth client, you'll see:
- **Client ID**: Starts with numbers, ends with `.apps.googleusercontent.com`
- **Client Secret**: A random string of letters and numbers

## What I Need From You

Please provide these two values:

1. **GOOGLE_CLIENT_ID**: The full client ID from step 6
2. **GOOGLE_CLIENT_SECRET**: The client secret from step 6

## Finding Your Replit URL
Your Replit URL is shown in the browser when running your app. It looks like:
`https://[random-string].janeway.replit.dev`

## Security Notes
- These credentials allow read-only access to GA4 data
- Users must explicitly grant permission during OAuth flow
- Credentials can be revoked anytime in Google Cloud Console
- Clear Digital will only access GA4 properties where you grant permission

## Troubleshooting
- If you get "access denied" errors, ensure all three APIs are enabled
- If OAuth fails, double-check the redirect URI matches exactly
- If you can't find your project, make sure you're signed in with the correct Google account

## Next Steps
Once you provide the credentials:
1. I'll configure them in your Replit environment
2. Test the OAuth flow
3. Verify GA4 data access
4. Complete the service account setup for production use