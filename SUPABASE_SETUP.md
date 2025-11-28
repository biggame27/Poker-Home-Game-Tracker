# Supabase Backend Setup Guide

This guide will walk you through setting up Supabase as the backend for your Poker Tracker application.

## Prerequisites

- A Supabase account (sign up at [supabase.com](https://supabase.com))
- Your Supabase project URL and API keys
- Clerk authentication already configured

## Step 1: Create Supabase Project

1. Go to [database.new](https://database.new) or your Supabase dashboard
2. Create a new project
3. Note down your project URL and anon key from Settings > API

## Step 2: Set Up Environment Variables

Create or update your `.env` file in the root of your project:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project-id.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key-here

# Clerk (you should already have these)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=your-clerk-publishable-key
CLERK_SECRET_KEY=your-clerk-secret-key
```

**Where to find these values:**
- **Supabase URL & Anon Key**: Supabase Dashboard → Settings → API
- **Clerk Keys**: Clerk Dashboard → API Keys

## Step 3: Create Database Schema

1. Open your Supabase project dashboard
2. Go to **SQL Editor**
3. Click **New Query**
4. Copy and paste the entire contents of `supabase/schema.sql` from this project
5. Click **Run** to execute the SQL

This will create:
- `users` table (links Clerk user IDs)
- `groups` table (poker groups)
- `group_members` table (many-to-many relationship)
- `games` table (poker games)
- `game_sessions` table (player participation)
- All necessary indexes, triggers, and RLS policies

## Step 4: Verify Database Setup

After running the schema, verify the tables were created:

1. Go to **Table Editor** in Supabase dashboard
2. You should see 5 tables:
   - `users`
   - `groups`
   - `group_members`
   - `games`
   - `game_sessions`

## Step 5: Test the Application

1. Start your development server:
   ```bash
   npm run dev
   ```

2. Sign in with Clerk
3. Try creating a group
4. Try creating a game
5. Verify data appears in Supabase Table Editor

## Step 6: Row Level Security (RLS)

The schema includes RLS policies that allow all operations (since we're using Clerk for auth). The application validates permissions in code using Clerk user IDs.

**Important**: The RLS policies are set to `USING (true)` which means they allow all operations. This is because:
- Clerk handles authentication
- We validate user permissions in application code
- Supabase doesn't have Clerk user context in JWT tokens

If you want stricter security, you can:
1. Set up Supabase Auth alongside Clerk (more complex)
2. Use Supabase Edge Functions to validate Clerk tokens
3. Keep current setup and validate in application code (recommended for now)

## Database Schema Overview

### Tables

**users**
- Stores Clerk user IDs and basic info
- Auto-created when users interact with the app

**groups**
- Poker groups with invite codes
- Links to creator via `created_by` (Clerk user ID)

**group_members**
- Many-to-many relationship between users and groups
- Tracks role (owner/member) and join date

**games**
- Individual poker games
- Linked to groups via `group_id`
- Has status: 'open', 'in-progress', 'completed'

**game_sessions**
- Player participation in games
- Stores buy-in, end amount, and calculated profit
- Linked to users via `user_id` (Clerk user ID, nullable for guests)

### Functions

**generate_invite_code()**
- Generates unique 6-character invite codes for groups
- Falls back to client-side generation if function unavailable

**update_updated_at_column()**
- Trigger function to automatically update `updated_at` timestamps

## Troubleshooting

### "Error fetching groups"
- Check that environment variables are set correctly
- Verify Supabase project is active
- Check browser console for detailed error messages

### "Failed to create group"
- Ensure you're signed in with Clerk
- Check Supabase dashboard for any errors
- Verify RLS policies are enabled

### Data not appearing
- Check Supabase Table Editor to see if data was inserted
- Verify your Clerk user ID matches what's in the database
- Check browser network tab for API errors

### RLS Policy Errors
- The current setup uses permissive policies
- If you see RLS errors, check that policies are created correctly
- You may need to disable RLS temporarily for testing (not recommended for production)

## Migration from localStorage

The application has been migrated from localStorage to Supabase. All data is now stored in the database:

- **Groups**: Stored in `groups` and `group_members` tables
- **Games**: Stored in `games` table
- **Sessions**: Stored in `game_sessions` table

Old localStorage data will not be automatically migrated. Users will need to recreate their groups and games.

## Production Considerations

1. **Backup**: Set up regular database backups in Supabase
2. **Monitoring**: Monitor Supabase dashboard for errors
3. **Rate Limiting**: Supabase has rate limits on free tier
4. **Security**: Consider implementing stricter RLS policies for production
5. **Environment Variables**: Never commit `.env` to git (add to `.gitignore`)

## Next Steps

- Set up database backups
- Configure Supabase Edge Functions if needed
- Add database migrations for future schema changes
- Set up monitoring and alerts

## Support

If you encounter issues:
1. Check Supabase dashboard logs
2. Check browser console for errors
3. Verify all environment variables are set
4. Ensure database schema was created successfully

