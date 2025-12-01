-- Poker Tracker Database Schema for Supabase
-- Run this in your Supabase SQL Editor

-- Users table (links Clerk user IDs to Supabase)
CREATE TABLE IF NOT EXISTS users (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  clerk_id TEXT UNIQUE NOT NULL,
  email TEXT,
  full_name TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Groups table
CREATE TABLE IF NOT EXISTS groups (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  description TEXT,
  invite_code TEXT UNIQUE NOT NULL,
  created_by TEXT NOT NULL, -- Clerk user ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Group members (many-to-many relationship)
CREATE TABLE IF NOT EXISTS group_members (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  user_id TEXT NOT NULL, -- Clerk user ID
  user_name TEXT NOT NULL,
  role TEXT NOT NULL CHECK (role IN ('owner', 'member')),
  joined_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(group_id, user_id)
);

-- Games table
CREATE TABLE IF NOT EXISTS games (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  group_id UUID REFERENCES groups(id) ON DELETE CASCADE,
  date DATE NOT NULL,
  notes TEXT,
  status TEXT NOT NULL CHECK (status IN ('open', 'in-progress', 'completed')) DEFAULT 'open',
  created_by TEXT NOT NULL, -- Clerk user ID
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Game sessions (player participation in a game)
CREATE TABLE IF NOT EXISTS game_sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  game_id UUID REFERENCES games(id) ON DELETE CASCADE,
  player_name TEXT NOT NULL,
  user_id TEXT, -- Clerk user ID (nullable for guests)
  buy_in DECIMAL(10, 2) NOT NULL DEFAULT 0,
  end_amount DECIMAL(10, 2) NOT NULL DEFAULT 0,
  profit DECIMAL(10, 2) GENERATED ALWAYS AS (end_amount - buy_in) STORED,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(game_id, user_id) -- One session per user per game (user_id can be null)
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_groups_created_by ON groups(created_by);
CREATE INDEX IF NOT EXISTS idx_groups_invite_code ON groups(invite_code);
CREATE INDEX IF NOT EXISTS idx_group_members_group_id ON group_members(group_id);
CREATE INDEX IF NOT EXISTS idx_group_members_user_id ON group_members(user_id);
CREATE INDEX IF NOT EXISTS idx_games_group_id ON games(group_id);
CREATE INDEX IF NOT EXISTS idx_games_created_by ON games(created_by);
CREATE INDEX IF NOT EXISTS idx_games_date ON games(date);
CREATE INDEX IF NOT EXISTS idx_game_sessions_game_id ON game_sessions(game_id);
CREATE INDEX IF NOT EXISTS idx_game_sessions_user_id ON game_sessions(user_id);

-- Function to generate unique invite codes
CREATE OR REPLACE FUNCTION generate_invite_code()
RETURNS TEXT AS $$
DECLARE
  code TEXT;
BEGIN
  LOOP
    code := UPPER(SUBSTRING(MD5(RANDOM()::TEXT) FROM 1 FOR 6));
    EXIT WHEN NOT EXISTS (SELECT 1 FROM groups WHERE invite_code = code);
  END LOOP;
  RETURN code;
END;
$$ LANGUAGE plpgsql;

-- Function to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Triggers to update updated_at
CREATE TRIGGER update_groups_updated_at
  BEFORE UPDATE ON groups
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_games_updated_at
  BEFORE UPDATE ON games
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_game_sessions_updated_at
  BEFORE UPDATE ON game_sessions
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE groups ENABLE ROW LEVEL SECURITY;
ALTER TABLE group_members ENABLE ROW LEVEL SECURITY;
ALTER TABLE games ENABLE ROW LEVEL SECURITY;
ALTER TABLE game_sessions ENABLE ROW LEVEL SECURITY;

-- RLS Policies
-- Note: Since we're using Clerk for auth, we'll handle authorization in application code
-- These policies allow all authenticated operations (we validate Clerk user ID in code)

-- Users: Can read and update their own profile
CREATE POLICY "Users can manage own profile"
  ON users FOR ALL
  USING (true) -- We'll validate Clerk ID in application code
  WITH CHECK (true);

-- Groups: Members can read groups they belong to
CREATE POLICY "Members can read their groups"
  ON groups FOR SELECT
  USING (true); -- We'll validate membership in application code

-- Groups: Users can create groups
CREATE POLICY "Users can create groups"
  ON groups FOR INSERT
  WITH CHECK (true); -- We'll validate in application code

-- Groups: Owners can update their groups
CREATE POLICY "Owners can update their groups"
  ON groups FOR UPDATE
  USING (true) -- We'll validate ownership in application code
  WITH CHECK (true);

-- Group members: Can read members of their groups
CREATE POLICY "Members can read group members"
  ON group_members FOR SELECT
  USING (true); -- We'll validate in application code

-- Group members: Can join groups
CREATE POLICY "Users can join groups"
  ON group_members FOR INSERT
  WITH CHECK (true); -- We'll validate in application code

-- Games: Can read games in their groups
CREATE POLICY "Members can read games"
  ON games FOR SELECT
  USING (true); -- We'll validate membership in application code

-- Games: Members can create games
CREATE POLICY "Members can create games"
  ON games FOR INSERT
  WITH CHECK (true); -- We'll validate membership in application code

-- Games: Can update games
CREATE POLICY "Can update games"
  ON games FOR UPDATE
  USING (true) -- We'll validate in application code
  WITH CHECK (true);

-- Game sessions: Can read sessions
CREATE POLICY "Can read game sessions"
  ON game_sessions FOR SELECT
  USING (true); -- We'll validate in application code

-- Game sessions: Users can manage sessions
CREATE POLICY "Users can manage sessions"
  ON game_sessions FOR ALL
  USING (true) -- We'll validate in application code
  WITH CHECK (true);



