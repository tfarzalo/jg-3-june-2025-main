# Supabase Setup and Connection

## Overview
This project is already configured with Supabase and includes a comprehensive setup for authentication, database operations, and real-time features.

## Current Configuration

### Environment Variables
The following environment variables are configured in `.env`:
- `VITE_SUPABASE_URL`: Your Supabase project URL
- `VITE_SUPABASE_ANON_KEY`: Anonymous/public key for client-side operations
- `VITE_SUPABASE_SERVICE_ROLE_KEY`: Service role key for server-side operations
- `VITE_SUPABASE_JWT_SECRET`: JWT secret for token verification

### Supabase Client
The Supabase client is configured in `src/utils/supabase.ts` with:
- Retry logic for failed requests
- Custom storage handling for authentication
- Optimized real-time configuration
- Comprehensive TypeScript types

### Authentication Context
The app includes a full authentication system in `src/contexts/AuthContext.tsx` that handles:
- User sign-in/sign-out
- Session management
- Automatic token refresh
- Route protection

## Connection Status
A connection status indicator has been added to the top-right corner of the app that shows:
- 🔄 Connecting to Supabase...
- ✅ Supabase Connected
- ❌ Supabase Error: [error message]

## Database Schema
The project includes several database tables and types:
- User profiles and authentication
- Property management groups
- Jobs and work orders
- Billing categories and details
- File storage and management
- User notifications

## Supabase CLI
The Supabase CLI is configured with:
- Local development setup
- Database migrations
- Edge functions
- Storage buckets

## Testing the Connection
1. Start the development server: `npm run dev`
2. Open the browser to `http://localhost:5173`
3. Look for the connection status indicator in the top-right corner
4. Check the browser console for connection logs

## Troubleshooting
If you encounter connection issues:
1. Verify your `.env` file contains the correct credentials
2. Check that your Supabase project is active
3. Ensure your IP is not blocked by Supabase
4. Check the browser console for detailed error messages

## Next Steps
The Supabase connection is fully functional. You can now:
- Use the authentication system
- Perform database operations
- Upload files to storage
- Use real-time subscriptions
- Deploy edge functions
