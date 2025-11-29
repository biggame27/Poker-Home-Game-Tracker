// Supabase storage functions - replaces localStorage
import { createClient } from './client'
import { createClient as createServerClient } from './server'
import { auth } from '@clerk/nextjs/server'
import type { Game, Group, GameSession, GroupMember, PlayerProfile } from '@/types'

// Ensure date-only values don't shift across timezones when converted to Date objects
const normalizeDateString = (value: string) =>
  value.includes('T') ? value : `${value}T00:00:00`

const PERSONAL_GROUP_NAME = 'Personal Games'

// Helper to ensure user exists in database
async function ensureUser(clerkId: string, email?: string, fullName?: string) {
  try {
    const supabase = createClient()
    
    // Check if user exists
    const { data: existing } = await supabase
      .from('users')
      .select('id')
      .eq('clerk_id', clerkId)
      .single()
    
    if (!existing) {
      // Create user
      await supabase
        .from('users')
        .insert({
          clerk_id: clerkId,
          email: email || null,
          full_name: fullName || null,
        })
    }
  } catch (error) {
    // User might already exist or other error - ignore for now
    console.error('Error ensuring user:', error)
  }
}

// ============ GROUPS ============

export async function getGroups(userId: string): Promise<Group[]> {
  const supabase = createClient()
  
  // Get groups where user is a member
  const { data: memberGroups, error: memberError } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
  
  if (memberError) {
    console.error('Error fetching member groups:', memberError)
    return []
  }
  
  const groupIds = memberGroups?.map(g => g.group_id) || []
  
  // Also include groups created by user
  const { data: createdGroups, error: createdError } = await supabase
    .from('groups')
    .select('id')
    .eq('created_by', userId)
  
  if (createdError) {
    console.error('Error fetching created groups:', createdError)
    return []
  }
  
  const allGroupIds = [
    ...groupIds,
    ...(createdGroups?.map(g => g.id) || [])
  ]
  
  if (allGroupIds.length === 0) return []
  
  // Fetch full group data with members
  const { data: groups, error } = await supabase
    .from('groups')
    .select(`
      *,
      group_members (*)
    `)
    .in('id', allGroupIds)
  
  if (error) {
    console.error('Error fetching groups:', error)
    return []
  }
  
  // Transform to match our Group type
  return (groups || [])
    .filter(g => !(g.created_by === userId && g.name === PERSONAL_GROUP_NAME))
    .map(g => ({
      id: g.id,
      name: g.name,
      description: g.description || undefined,
      createdBy: g.created_by,
      createdAt: g.created_at,
      inviteCode: g.invite_code,
      members: (g.group_members || []).map((m: any) => ({
        userId: m.user_id,
        userName: m.user_name,
        joinedAt: m.joined_at,
        role: m.role as 'owner' | 'member'
      }))
    }))
}

export async function getGroupById(groupId: string): Promise<Group | null> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('groups')
    .select(`
      *,
      group_members (*)
    `)
    .eq('id', groupId)
    .single()
  
  if (error || !data) {
    console.error('Error fetching group:', error)
    return null
  }
  
  return {
    id: data.id,
    name: data.name,
    description: data.description || undefined,
    createdBy: data.created_by,
    createdAt: data.created_at,
    inviteCode: data.invite_code,
    members: (data.group_members || []).map((m: any) => ({
      userId: m.user_id,
      userName: m.user_name,
      joinedAt: m.joined_at,
      role: m.role as 'owner' | 'member'
    }))
  }
}

export async function getGroupByInviteCode(inviteCode: string): Promise<Group | null> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('groups')
    .select(`
      *,
      group_members (*)
    `)
    .eq('invite_code', inviteCode.toUpperCase())
    .maybeSingle()
  
  if (error || !data) {
    return null
  }
  
  return {
    id: data.id,
    name: data.name,
    description: data.description || undefined,
    createdBy: data.created_by,
    createdAt: data.created_at,
    inviteCode: data.invite_code,
    members: (data.group_members || []).map((m: any) => ({
      userId: m.user_id,
      userName: m.user_name,
      joinedAt: m.joined_at,
      role: m.role as 'owner' | 'member'
    }))
  }
}

export async function createGroup(
  name: string,
  description: string | undefined,
  userId: string,
  userName: string,
  inviteCode: string
): Promise<Group | null> {
  const supabase = createClient()
  
  await ensureUser(userId)
  
  const { data: group, error: groupError } = await supabase
    .from('groups')
    .insert({
      name,
      description: description || null,
      created_by: userId,
      invite_code: inviteCode,
    })
    .select()
    .single()
  
  if (groupError || !group) {
    console.error('Error creating group:', groupError)
    return null
  }
  
  // Add creator as owner
  const { error: memberError } = await supabase
    .from('group_members')
    .insert({
      group_id: group.id,
      user_id: userId,
      user_name: userName,
      role: 'owner',
    })
  
  if (memberError) {
    console.error('Error adding owner to group:', memberError)
  }
  
  return getGroupById(group.id)
}

export async function updateGroup(group: Group): Promise<boolean> {
  const supabase = createClient()
  
  const { error } = await supabase
    .from('groups')
    .update({
      name: group.name,
      description: group.description || null,
    })
    .eq('id', group.id)
  
  if (error) {
    console.error('Error updating group:', error)
    return false
  }
  
  return true
}

export async function joinGroup(
  groupId: string,
  userId: string,
  userName: string
): Promise<boolean> {
  const supabase = createClient()
  
  await ensureUser(userId)
  
  // Check if already a member
  const { data: existing, error: checkError } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle()
  
  // If member exists, return true
  if (existing) {
    return true // Already a member
  }
  
  // If there was an error other than "not found", log it
  if (checkError && checkError.code !== 'PGRST116') {
    console.error('Error checking membership:', checkError)
  }
  
  const { error } = await supabase
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: userId,
      user_name: userName,
      role: 'member',
    })
  
  if (error) {
    console.error('Error joining group:', error)
    return false
  }
  
  return true
}

export async function getUserGroups(userId: string): Promise<string[]> {
  const supabase = createClient()
  
  const { data, error } = await supabase
    .from('group_members')
    .select('group_id')
    .eq('user_id', userId)
  
  if (error) {
    console.error('Error fetching user groups:', error)
    return []
  }
  
  return (data || []).map(g => g.group_id)
}

export async function generateInviteCode(): Promise<string> {
  const supabase = createClient()
  
  // Generate a code and check if it's unique
  let attempts = 0
  const maxAttempts = 10
  
  while (attempts < maxAttempts) {
    // Generate a 6-character uppercase code
    const code = Math.random().toString(36).substring(2, 8).toUpperCase()
    
    // Check if code already exists
    const { data, error } = await supabase
      .from('groups')
      .select('id')
      .eq('invite_code', code)
      .maybeSingle()
    
    // If no error and no data found, the code is unique!
    if (!error && !data) {
      return code
    }
    
    // If we found a group or got an error, try again
    attempts++
  }
  
  // Fallback: add timestamp to make it unique if we hit max attempts
  const timestamp = Date.now().toString(36).substring(5).toUpperCase()
  return timestamp.substring(0, 6)
}

export async function searchPlayers(query: string): Promise<PlayerProfile[]> {
  const supabase = createClient()

  const trimmed = query.trim()
  if (!trimmed) return []

  const term = `%${trimmed}%`

  const [userResp, memberResp] = await Promise.all([
    supabase
      .from('users')
      .select('id, clerk_id, full_name, email')
      .or(`full_name.ilike.${term},email.ilike.${term}`)
      .limit(25),
    supabase
      .from('group_members')
      .select('user_id, user_name')
      .not('user_id', 'is', null)
      .ilike('user_name', term)
      .limit(25),
  ])

  const users = userResp.data || []
  const members = memberResp.data || []

  const combined = new Map<string, PlayerProfile>()

  users.forEach((row) => {
    combined.set(row.clerk_id, {
      id: row.id,
      clerkId: row.clerk_id,
      fullName: row.full_name || 'Unnamed player',
      email: row.email || '',
    })
  })

  members.forEach((row: any) => {
    if (!row.user_id) return
    if (!combined.has(row.user_id)) {
      combined.set(row.user_id, {
        id: row.user_id,
        clerkId: row.user_id,
        fullName: row.user_name || 'Player',
        email: '',
      })
    }
  })

  return Array.from(combined.values()).slice(0, 25)
}

export async function getPlayerProfile(clerkId: string): Promise<PlayerProfile | null> {
  const supabase = createClient()

  // Try primary user record
  const { data, error } = await supabase
    .from('users')
    .select('id, clerk_id, full_name, email, created_at')
    .eq('clerk_id', clerkId)
    .maybeSingle()

  if (error) {
    console.error('Error fetching player profile:', error)
  }

  // Fallback to a known display name from group membership if needed
  const { data: memberRow } = await supabase
    .from('group_members')
    .select('user_name')
    .eq('user_id', clerkId)
    .limit(1)
    .maybeSingle()

  if (!data && !memberRow) {
    return null
  }

  return {
    id: data?.id || clerkId,
    clerkId: data?.clerk_id || clerkId,
    fullName: data?.full_name || memberRow?.user_name || 'Unnamed player',
    email: data?.email || '',
    createdAt: data?.created_at || undefined,
  }
}

export async function getOrCreatePersonalGroup(
  userId: string,
  userName: string
): Promise<Group | null> {
  const supabase = createClient()

  // Check for existing personal group by creator and name
  const { data: existing, error: existingError } = await supabase
    .from('groups')
    .select('*')
    .eq('created_by', userId)
    .eq('name', 'Personal Games')
    .maybeSingle()

  if (existingError) {
    console.error('Error checking personal group:', existingError)
  }

  if (existing) {
    // Ensure membership record exists
    const { data: member } = await supabase
      .from('group_members')
      .select('id')
      .eq('group_id', existing.id)
      .eq('user_id', userId)
      .maybeSingle()

    if (!member) {
      await supabase.from('group_members').insert({
        group_id: existing.id,
        user_id: userId,
        user_name: userName,
        role: 'owner',
      })
    }

    return getGroupById(existing.id)
  }

  const inviteCode = await generateInviteCode()
  return createGroup('Personal Games', 'Your personal poker sessions', userId, userName, inviteCode)
}

// ============ GAMES ============

export async function getGames(userId: string): Promise<Game[]> {
  const supabase = createClient()
  
  // Get user's group IDs
  const groupIds = await getUserGroups(userId)
  
  // Also get groups created by user
  const { data: createdGroups } = await supabase
    .from('groups')
    .select('id')
    .eq('created_by', userId)
  
  const allGroupIds = [
    ...groupIds,
    ...(createdGroups?.map(g => g.id) || [])
  ]
  
  if (allGroupIds.length === 0) return []
  
  const { data: games, error } = await supabase
    .from('games')
    .select(`
      *,
      game_sessions (*)
    `)
    .in('group_id', allGroupIds)
    .order('date', { ascending: false })
  
  if (error) {
    console.error('Error fetching games:', error)
    return []
  }
  
  return (games || []).map(g => ({
    id: g.id,
    groupId: g.group_id,
    date: normalizeDateString(g.date),
    notes: g.notes || undefined,
    createdBy: g.created_by,
    createdAt: g.created_at,
    status: g.status as 'open' | 'in-progress' | 'completed',
    sessions: (g.game_sessions || []).map((s: any) => ({
      playerName: s.player_name,
      buyIn: parseFloat(s.buy_in.toString()),
      endAmount: parseFloat(s.end_amount.toString()),
      profit: parseFloat(s.profit.toString()),
      userId: s.user_id || undefined
    }))
  }))
}

export async function getGamesByGroup(groupId: string): Promise<Game[]> {
  const supabase = createClient()
  
  const { data: games, error } = await supabase
    .from('games')
    .select(`
      *,
      game_sessions (*)
    `)
    .eq('group_id', groupId)
    .order('date', { ascending: false })
  
  if (error) {
    console.error('Error fetching games by group:', error)
    return []
  }
  
  return (games || []).map(g => ({
    id: g.id,
    groupId: g.group_id,
    date: normalizeDateString(g.date),
    notes: g.notes || undefined,
    createdBy: g.created_by,
    createdAt: g.created_at,
    status: g.status as 'open' | 'in-progress' | 'completed',
    sessions: (g.game_sessions || []).map((s: any) => ({
      playerName: s.player_name,
      buyIn: parseFloat(s.buy_in.toString()),
      endAmount: parseFloat(s.end_amount.toString()),
      profit: parseFloat(s.profit.toString()),
      userId: s.user_id || undefined
    }))
  }))
}

export async function getGameById(gameId: string): Promise<Game | null> {
  const supabase = createClient()
  
  const { data: game, error } = await supabase
    .from('games')
    .select(`
      *,
      game_sessions (*)
    `)
    .eq('id', gameId)
    .single()
  
  if (error || !game) {
    console.error('Error fetching game:', error)
    return null
  }
  
  return {
    id: game.id,
    groupId: game.group_id,
    date: normalizeDateString(game.date),
    notes: game.notes || undefined,
    createdBy: game.created_by,
    createdAt: game.created_at,
    status: game.status as 'open' | 'in-progress' | 'completed',
    sessions: (game.game_sessions || []).map((s: any) => ({
      playerName: s.player_name,
      buyIn: parseFloat(s.buy_in.toString()),
      endAmount: parseFloat(s.end_amount.toString()),
      profit: parseFloat(s.profit.toString()),
      userId: s.user_id || undefined
    }))
  }
}

export async function getGamesByUser(userId: string): Promise<Game[]> {
  const supabase = createClient()

  // Find game IDs where the user played
  const { data: sessionRows, error: sessionError } = await supabase
    .from('game_sessions')
    .select('game_id')
    .eq('user_id', userId)

  if (sessionError) {
    console.error('Error fetching user sessions:', sessionError)
    return []
  }

  // Find game IDs the user created
  const { data: createdRows, error: createdError } = await supabase
    .from('games')
    .select('id')
    .eq('created_by', userId)

  if (createdError) {
    console.error('Error fetching user games:', createdError)
    return []
  }

  const gameIds = [
    ...(sessionRows || []).map((row) => row.game_id),
    ...(createdRows || []).map((row) => row.id),
  ]

  if (gameIds.length === 0) return []

  const { data: games, error } = await supabase
    .from('games')
    .select(`
      *,
      game_sessions (*)
    `)
    .in('id', gameIds)
    .order('date', { ascending: false })
  
  if (error) {
    console.error('Error fetching games by user:', error)
    return []
  }
  
  return (games || [])
    .map(g => ({
      id: g.id,
      groupId: g.group_id,
      date: normalizeDateString(g.date),
      notes: g.notes || undefined,
      createdBy: g.created_by,
      createdAt: g.created_at,
      status: g.status as 'open' | 'in-progress' | 'completed',
      sessions: (g.game_sessions || []).map((s: any) => ({
        playerName: s.player_name,
        buyIn: parseFloat(s.buy_in.toString()),
        endAmount: parseFloat(s.end_amount.toString()),
        profit: parseFloat(s.profit.toString()),
        userId: s.user_id || undefined
      }))
    }))
}

export async function createGame(
  groupId: string,
  date: string,
  notes: string | undefined,
  userId: string,
  userName: string
): Promise<Game | null> {
  const supabase = createClient()
  
  await ensureUser(userId)
  
  // Create game
  const { data: game, error: gameError } = await supabase
    .from('games')
    .insert({
      group_id: groupId,
      date,
      notes: notes || null,
      status: 'open',
      created_by: userId,
    })
    .select()
    .single()
  
  if (gameError || !game) {
    console.error('Error creating game:', gameError)
    return null
  }
  
  // Add host as first session
  const { error: sessionError } = await supabase
    .from('game_sessions')
    .insert({
      game_id: game.id,
      player_name: userName,
      user_id: userId,
      buy_in: 0,
      end_amount: 0,
    })
  
  if (sessionError) {
    console.error('Error creating host session:', sessionError)
  }
  
  return getGameById(game.id)
}

export async function updateGameSession(
  gameId: string,
  userId: string,
  playerName: string,
  buyIn: number,
  endAmount: number
): Promise<boolean> {
  const supabase = createClient()

  // Prevent edits to closed games
  const { data: gameStatusRow, error: statusError } = await supabase
    .from('games')
    .select('status')
    .eq('id', gameId)
    .single()

  if (statusError || !gameStatusRow) {
    console.error('Error verifying game status:', statusError)
    return false
  }

  if (gameStatusRow.status === 'completed') {
    console.warn('Attempted to edit a completed game; aborting update.')
    return false
  }
  
  // Check if session exists
  const { data: existing } = await supabase
    .from('game_sessions')
    .select('id')
    .eq('game_id', gameId)
    .eq('user_id', userId)
    .single()
  
  if (existing) {
    // Update existing session
    const { error } = await supabase
      .from('game_sessions')
      .update({
        player_name: playerName,
        buy_in: buyIn,
        end_amount: endAmount,
      })
      .eq('id', existing.id)
    
    if (error) {
      console.error('Error updating game session:', error)
      return false
    }
  } else {
    // Create new session
    const { error } = await supabase
      .from('game_sessions')
      .insert({
        game_id: gameId,
        player_name: playerName,
        user_id: userId,
        buy_in: buyIn,
        end_amount: endAmount,
      })
    
    if (error) {
      console.error('Error creating game session:', error)
      return false
    }
  }
  
  return true
}

export async function updateGameStatus(
  gameId: string,
  status: 'open' | 'in-progress' | 'completed',
  userId: string
): Promise<boolean> {
  const supabase = createClient()

  // Ensure only the group owner can change status
  const { data: gameRow, error: fetchError } = await supabase
    .from('games')
    .select('group_id')
    .eq('id', gameId)
    .single()

  if (fetchError || !gameRow) {
    console.error('Error verifying game owner:', fetchError)
    return false
  }

  const groupId = gameRow.group_id

  const { data: groupRow, error: groupError } = await supabase
    .from('groups')
    .select('created_by')
    .eq('id', groupId)
    .single()

  if (groupError || !groupRow) {
    console.error('Error verifying group owner:', groupError)
    return false
  }

  const { data: memberRow } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle()

  const isGroupOwner =
    groupRow.created_by === userId ||
    (memberRow?.role === 'owner')

  if (!isGroupOwner) {
    console.warn('Unauthorized status update attempt.')
    return false
  }

  const { error } = await supabase
    .from('games')
    .update({ status })
    .eq('id', gameId)

  if (error) {
    console.error('Error updating game status:', error)
    return false
  }

  return true
}

export async function deleteGame(gameId: string): Promise<boolean> {
  const supabase = createClient()
  
  // First delete all game sessions (due to foreign key constraints)
  const { error: sessionsError } = await supabase
    .from('game_sessions')
    .delete()
    .eq('game_id', gameId)
  
  if (sessionsError) {
    console.error('Error deleting game sessions:', sessionsError)
    return false
  }
  
  // Then delete the game
  const { error: gameError } = await supabase
    .from('games')
    .delete()
    .eq('id', gameId)
  
  if (gameError) {
    console.error('Error deleting game:', gameError)
    return false
  }

  return true
}

export async function deleteGroup(groupId: string, userId: string): Promise<boolean> {
  const supabase = createClient()

  // Verify ownership
  const { data: groupRow, error: groupFetchError } = await supabase
    .from('groups')
    .select('created_by')
    .eq('id', groupId)
    .single()

  if (groupFetchError || !groupRow || groupRow.created_by !== userId) {
    console.error('Unauthorized or failed to verify group owner:', groupFetchError)
    return false
  }

  // Delete game sessions for all games in the group
  const { data: groupGames, error: gamesFetchError } = await supabase
    .from('games')
    .select('id')
    .eq('group_id', groupId)

  if (gamesFetchError) {
    console.error('Error fetching games for group deletion:', gamesFetchError)
    return false
  }

  const gameIds = (groupGames || []).map(g => g.id)

  if (gameIds.length > 0) {
    const { error: deleteSessionsError } = await supabase
      .from('game_sessions')
      .delete()
      .in('game_id', gameIds)

    if (deleteSessionsError) {
      console.error('Error deleting game sessions for group:', deleteSessionsError)
      return false
    }

    const { error: deleteGamesError } = await supabase
      .from('games')
      .delete()
      .eq('group_id', groupId)

    if (deleteGamesError) {
      console.error('Error deleting games for group:', deleteGamesError)
      return false
    }
  }

  // Delete members
  const { error: membersError } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)

  if (membersError) {
    console.error('Error deleting group members:', membersError)
    return false
  }

  // Delete group
  const { error: groupDeleteError } = await supabase
    .from('groups')
    .delete()
    .eq('id', groupId)

  if (groupDeleteError) {
    console.error('Error deleting group:', groupDeleteError)
    return false
  }

  return true
}

