# Setup Checklist - Poker Tracker with Supabase

Follow these steps in order to get your application fully functional.

## ✅ Step 1: Environment Variables

Create `.env` in the project root with:

```env
# Supabase (get from Supabase Dashboard → Settings → API)
NEXT_PUBLIC_SUPABASE_URL=https://xxxxx.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...

# Clerk (you should already have these)
NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...
CLERK_SECRET_KEY=sk_test_...
```

**Status**: ☐ Complete

## ✅ Step 2: Create Supabase Project

1. Go to [supabase.com](https://supabase.com) and sign in
2. Click "New Project"
3. Fill in:
   - Project name: "poker-tracker" (or your choice)
   - Database password: (save this securely)
   - Region: Choose closest to you
4. Wait for project to be created (~2 minutes)

**Status**: ☐ Complete

## ✅ Step 3: Run Database Schema

1. In Supabase dashboard, go to **SQL Editor**
2. Click **New Query**
3. Open `supabase/schema.sql` from this project
4. Copy the entire contents
5. Paste into SQL Editor
6. Click **Run** (or press Ctrl+Enter)
7. Verify success message appears

**Status**: ☐ Complete

## ✅ Step 4: Verify Tables Created

1. In Supabase dashboard, go to **Table Editor**
2. You should see these 5 tables:
   - ☐ `users`
   - ☐ `groups`
   - ☐ `group_members`
   - ☐ `games`
   - ☐ `game_sessions`

**Status**: ☐ Complete

## ✅ Step 5: Test the Application

1. Start dev server: `npm run dev`
2. Open [http://localhost:3000](http://localhost:3000)
3. Sign in with Clerk
4. Test creating a group
5. Test creating a game
6. Check Supabase Table Editor to see data

**Status**: ☐ Complete

## ✅ Step 6: Verify Data Flow

1. Create a group → Check `groups` table in Supabase
2. Join a group → Check `group_members` table
3. Create a game → Check `games` table
4. Join a game → Check `game_sessions` table

**Status**: ☐ Complete

## Troubleshooting

### Can't connect to Supabase
- ☐ Check environment variables are correct
- ☐ Verify Supabase project is active (not paused)
- ☐ Check browser console for errors

### Tables not created
- ☐ Check SQL Editor for error messages
- ☐ Verify you have permission to create tables
- ☐ Try running schema in smaller chunks

### Data not saving
- ☐ Check RLS policies are enabled
- ☐ Verify you're signed in with Clerk
- ☐ Check Supabase logs for errors

### RLS Policy Errors
- ☐ Current setup uses permissive policies (allows all)
- ☐ If errors occur, check that policies were created
- ☐ You can temporarily disable RLS for testing (not recommended)

## Quick Reference

**Supabase Dashboard**: https://supabase.com/dashboard
**SQL Editor**: Dashboard → SQL Editor
**Table Editor**: Dashboard → Table Editor
**API Settings**: Dashboard → Settings → API

## Next Steps After Setup

1. ☐ Test all features (create group, join group, create game, join game)
2. ☐ Verify statistics and charts work
3. ☐ Test with multiple users
4. ☐ Set up database backups (Supabase dashboard)
5. ☐ Deploy to production (Vercel recommended)

## Support

If you're stuck:
1. Check `SUPABASE_SETUP.md` for detailed instructions
2. Check browser console for errors
3. Check Supabase dashboard logs
4. Verify all environment variables are set correctly

