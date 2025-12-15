// Supabase storage functions - replaces localStorage
import { createClient } from './client'
import { createClient as createServerClient } from './server'
import { auth } from '@clerk/nextjs/server'
import type { Game, Group, GameSession, GroupMember } from '@/types'

// Ensure date-only values don't shift across timezones when converted to Date objects
const normalizeDateString = (value: string) =>
  value.includes('T') ? value : `${value}T00:00:00`

const PERSONAL_GROUP_NAME = 'Personal Games'
const generateGuestUserId = () => {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `guest-${crypto.randomUUID()}`
  }
  return `guest-${Math.random().toString(36).slice(2, 10)}${Date.now()}`
}

async function isGroupOwner(userId: string, groupId: string) {
  const supabase = createClient()
  const { data: groupRow, error } = await supabase
    .from('groups')
    .select('created_by')
    .eq('id', groupId)
    .single()
  if (error || !groupRow) return false
  return groupRow.created_by === userId
}

async function isGroupAdmin(userId: string, groupId: string) {
  const supabase = createClient()
  const { data: memberRow } = await supabase
    .from('group_members')
    .select('role')
    .eq('group_id', groupId)
    .eq('user_id', userId)
    .maybeSingle()
  return memberRow?.role === 'admin'
}

async function isGroupOwnerOrAdmin(userId: string, groupId: string) {
  const isOwner = await isGroupOwner(userId, groupId)
  if (isOwner) return true
  return await isGroupAdmin(userId, groupId)
}

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
    console.error('Error fetching member groups:', memberError?.message || memberError, { code: (memberError as any)?.code })
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
  const transformed = (groups || [])
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
        role: m.role as 'owner' | 'admin' | 'member'
      }))
    }))

  // Ensure the personal games group (if it exists) appears first in the list
  // We identify it as the group created by the user with the PERSONAL_GROUP_NAME
  transformed.sort((a, b) => {
    const aIsPersonal = a.createdBy === userId && a.name === PERSONAL_GROUP_NAME
    const bIsPersonal = b.createdBy === userId && b.name === PERSONAL_GROUP_NAME

    if (aIsPersonal && !bIsPersonal) return -1
    if (!aIsPersonal && bIsPersonal) return 1

    // Otherwise, keep original relative order by createdAt (newest first)
    return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  })

  return transformed
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
    console.error('Error fetching group:', error?.message || error, { code: (error as any)?.code })
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
      role: m.role as 'owner' | 'admin' | 'member'
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
      role: m.role as 'owner' | 'admin' | 'member'
    }))
  }
}

export async function addGuestMember(
  groupId: string,
  guestName: string
): Promise<GroupMember | null> {
  const supabase = createClient()
  const trimmed = guestName.trim()
  if (!trimmed) return null

  const guestId = generateGuestUserId()
  const { data, error } = await supabase
    .from('group_members')
    .insert({
      group_id: groupId,
      user_id: guestId,
      user_name: trimmed,
      role: 'member',
    })
    .select()
    .single()

  if (error || !data) {
    console.error('Error adding guest member:', error)
    return null
  }

  return {
    userId: data.user_id,
    userName: data.user_name,
    joinedAt: data.joined_at,
    role: 'member',
  }
}

export async function removeGroupMember(
  groupId: string,
  memberUserId: string,
  actingUserId: string
): Promise<boolean> {
  const supabase = createClient()
  // Only group owner can remove members (admins cannot)
  const owner = await isGroupOwner(actingUserId, groupId)
  if (!owner) {
    console.warn('Unauthorized group member removal attempt')
    return false
  }

  const { error } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', groupId)
    .eq('user_id', memberUserId)

  if (error) {
    console.error('Error removing group member:', error)
    return false
  }

  return true
}

export async function promoteToAdmin(
  groupId: string,
  memberUserId: string,
  actingUserId: string
): Promise<boolean> {
  const supabase = createClient()
  // Only group owner can promote members
  const owner = await isGroupOwner(actingUserId, groupId)
  if (!owner) {
    console.warn('Unauthorized member promotion attempt')
    return false
  }

  // Don't allow promoting the owner
  const isOwner = await isGroupOwner(memberUserId, groupId)
  if (isOwner) {
    console.warn('Cannot promote owner to admin')
    return false
  }

  // First check if the member exists
  const { data: existingMember, error: checkError } = await supabase
    .from('group_members')
    .select('id, role')
    .eq('group_id', groupId)
    .eq('user_id', memberUserId)
    .single()

  if (checkError || !existingMember) {
    console.error('Error finding member to promote:', checkError)
    return false
  }

  const { data, error } = await supabase
    .from('group_members')
    .update({ role: 'admin' })
    .eq('group_id', groupId)
    .eq('user_id', memberUserId)
    .select()

  if (error) {
    console.error('Error promoting member to admin:', error)
    return false
  }

  if (!data || data.length === 0) {
    console.error('No rows updated when promoting member')
    return false
  }

  return true
}

export async function demoteFromAdmin(
  groupId: string,
  memberUserId: string,
  actingUserId: string
): Promise<boolean> {
  const supabase = createClient()
  // Only group owner can demote admins
  const owner = await isGroupOwner(actingUserId, groupId)
  if (!owner) {
    console.warn('Unauthorized admin demotion attempt')
    return false
  }

  // Don't allow demoting the owner
  const isOwner = await isGroupOwner(memberUserId, groupId)
  if (isOwner) {
    console.warn('Cannot demote owner')
    return false
  }

  // First check if the member exists
  const { data: existingMember, error: checkError } = await supabase
    .from('group_members')
    .select('id, role')
    .eq('group_id', groupId)
    .eq('user_id', memberUserId)
    .single()

  if (checkError || !existingMember) {
    console.error('Error finding admin to demote:', checkError)
    return false
  }

  const { data, error } = await supabase
    .from('group_members')
    .update({ role: 'member' })
    .eq('group_id', groupId)
    .eq('user_id', memberUserId)
    .select()

  if (error) {
    console.error('Error demoting admin to member:', error)
    return false
  }

  if (!data || data.length === 0) {
    console.error('No rows updated when demoting admin')
    return false
  }

  return true
}

type ClaimRequest = {
  id: string
  groupId: string
  guestName: string
  requesterId: string
  requesterEmail?: string
  status: 'pending' | 'approved'
}

export async function submitClaimRequest(
  groupId: string,
  guestName: string,
  requesterId: string,
  requesterEmail?: string
): Promise<ClaimRequest | null> {
  const supabase = createClient()
  const trimmed = guestName.trim()
  if (!trimmed) return null

  const { data, error } = await supabase
    .from('claim_requests')
    .upsert(
      {
        group_id: groupId,
        guest_name: trimmed,
        requester_id: requesterId,
        requester_email: requesterEmail || null,
        status: 'pending',
      },
      { onConflict: 'group_id,guest_name,requester_id' }
    )
    .select()
    .single()

  if (error || !data) {
    console.error('Error submitting claim request:', error)
    return null
  }

  return {
    id: data.id,
    groupId: data.group_id,
    guestName: data.guest_name,
    requesterId: data.requester_id,
    requesterEmail: data.requester_email || undefined,
    status: data.status,
  }
}

export async function getClaimRequests(groupId: string): Promise<ClaimRequest[]> {
  const supabase = createClient()
  const { data, error } = await supabase
    .from('claim_requests')
    .select('*')
    .eq('group_id', groupId)

  if (error) {
    console.error('Error fetching claim requests:', error)
    return []
  }

  return (data || []).map(d => ({
    id: d.id,
    groupId: d.group_id,
    guestName: d.guest_name,
    requesterId: d.requester_id,
    requesterEmail: d.requester_email || undefined,
    status: d.status,
  }))
}

async function mergeGuestSessionsToUser(
  groupId: string,
  guestName: string,
  targetUserId: string,
  targetUserName?: string
): Promise<boolean> {
  const supabase = createClient()

  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id')
    .eq('group_id', groupId)

  if (gamesError) {
    console.error('Error fetching games for merge:', gamesError)
    return false
  }

  const gameIds = (games || []).map(g => g.id)
  if (gameIds.length === 0) return true

  const { error: updateError } = await supabase
    .from('game_sessions')
    .update({
      user_id: targetUserId,
      role: 'member',
      player_name: targetUserName || guestName,
    })
    .in('game_id', gameIds)
    .ilike('player_name', guestName)
    .or('user_id.is.null,user_id.ilike.guest-%')

  if (updateError) {
    console.error('Error merging guest sessions:', updateError)
    return false
  }

  return true
}

export async function approveClaimRequest(
  requestId: string,
  actingUserId: string
): Promise<boolean> {
  const supabase = createClient()

  const { data: req, error } = await supabase
    .from('claim_requests')
    .select('*')
    .eq('id', requestId)
    .single()

  if (error || !req) {
    console.error('Error fetching claim request:', error)
    return false
  }

  const isOwnerOrAdmin = await isGroupOwnerOrAdmin(actingUserId, req.group_id)
  if (!isOwnerOrAdmin) {
    console.warn('Unauthorized claim approval attempt')
    return false
  }

  // Get user name from Clerk or use a default
  // Note: We'll need to fetch this from the user's profile or use email as fallback
  const userName = req.requester_email?.split('@')[0] || 'Member'
  
  const merged = await mergeGuestSessionsToUser(req.group_id, req.guest_name, req.requester_id, userName)
  if (!merged) return false

  // Add as group member if not already
  const { data: existingMember } = await supabase
    .from('group_members')
    .select('id')
    .eq('group_id', req.group_id)
    .eq('user_id', req.requester_id)
    .maybeSingle()

  if (!existingMember) {
    await supabase.from('group_members').insert({
      group_id: req.group_id,
      user_id: req.requester_id,
      user_name: userName,
      role: 'member',
    })
  }

  // Remove the old guest member record for this name (if it exists)
  const { error: guestMemberDeleteError } = await supabase
    .from('group_members')
    .delete()
    .eq('group_id', req.group_id)
    .ilike('user_name', req.guest_name)
    .like('user_id', 'guest-%')

  if (guestMemberDeleteError) {
    console.error('Warning: failed to delete guest member after merge:', guestMemberDeleteError)
    // Non-fatal – stats are already merged
  }

  // Clean up any remaining guest sessions that still match this guest name
  // (only affects rows where user_id is null or a guest-* id)
  const cleaned = await removeGuestFromGroupSessions(req.group_id, req.guest_name)
  if (!cleaned) {
    console.error('Warning: failed to clean up guest sessions after merge')
    // Non-fatal – merged sessions are already owned by the user
  }

  await supabase
    .from('claim_requests')
    .update({ status: 'approved' })
    .eq('id', requestId)

  return true
}

export async function denyClaimRequest(
  requestId: string,
  actingUserId: string
): Promise<boolean> {
  const supabase = createClient()
  const { data: req, error } = await supabase
    .from('claim_requests')
    .select('group_id')
    .eq('id', requestId)
    .single()

  if (error || !req) {
    console.error('Error fetching claim request:', error)
    return false
  }

  const isOwnerOrAdmin = await isGroupOwnerOrAdmin(actingUserId, req.group_id)
  if (!isOwnerOrAdmin) {
    console.warn('Unauthorized claim denial attempt')
    return false
  }

  // Delete the claim request instead of marking as denied
  const { error: delError } = await supabase
    .from('claim_requests')
    .delete()
    .eq('id', requestId)

  if (delError) {
    console.error('Error deleting claim request:', delError)
    return false
  }

  return true
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
    console.error('Error fetching user groups:', error?.message || error, { code: (error as any)?.code })
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
    sessions: (g.game_sessions || []).map((s: any) => ({
      playerName: s.player_name,
      buyIn: parseFloat((s.buy_in ?? 0).toString()),
      endAmount: parseFloat((s.end_amount ?? 0).toString()),
      profit: parseFloat((s.profit ?? 0).toString()),
      role: (s.role as GameSession['role']) || 'guest',
      userId: s.user_id || undefined,
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
    sessions: (g.game_sessions || []).map((s: any) => ({
      playerName: s.player_name,
      buyIn: parseFloat((s.buy_in ?? 0).toString()),
      endAmount: parseFloat((s.end_amount ?? 0).toString()),
      profit: parseFloat((s.profit ?? 0).toString()),
      role: (s.role as GameSession['role']) || 'guest',
      userId: s.user_id || undefined,
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
    sessions: (game.game_sessions || []).map((s: any) => ({
      playerName: s.player_name,
      buyIn: parseFloat((s.buy_in ?? 0).toString()),
      endAmount: parseFloat((s.end_amount ?? 0).toString()),
      profit: parseFloat((s.profit ?? 0).toString()),
      role: (s.role as GameSession['role']) || 'guest',
      userId: s.user_id || undefined,
    }))
  }
}

export async function getGamesByUser(userId: string): Promise<Game[]> {
  const supabase = createClient()
  
  const { data: games, error } = await supabase
    .from('games')
    .select(`
      *,
      game_sessions (*)
    `)
    .or(`created_by.eq.${userId},game_sessions.user_id.eq.${userId}`)
    .order('date', { ascending: false })
  
  if (error) {
    console.error('Error fetching games by user:', error)
    return []
  }
  
  // Filter to only games where user has a session or created
  return (games || [])
    .filter(g => 
      g.created_by === userId || 
      (g.game_sessions || []).some((s: any) => s.user_id === userId)
    )
    .map(g => ({
      id: g.id,
      groupId: g.group_id,
      date: normalizeDateString(g.date),
      notes: g.notes || undefined,
      createdBy: g.created_by,
      createdAt: g.created_at,
    sessions: (g.game_sessions || []).map((s: any) => ({
      playerName: s.player_name,
      buyIn: parseFloat((s.buy_in ?? 0).toString()),
      endAmount: parseFloat((s.end_amount ?? 0).toString()),
      profit: parseFloat((s.profit ?? 0).toString()),
      role: (s.role as GameSession['role']) || 'guest',
      userId: s.user_id || undefined,
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
  
  // Check if user is owner or admin of the group
  const isOwnerOrAdmin = await isGroupOwnerOrAdmin(userId, groupId)
  if (!isOwnerOrAdmin) {
    console.error('Unauthorized: Only owners and admins can create games')
    return null
  }
  
  // Create game
  const { data: game, error: gameError } = await supabase
    .from('games')
    .insert({
      group_id: groupId,
      date,
      notes: notes || null,
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
      role: 'host',
    })
  
  if (sessionError) {
    console.error('Error creating host session:', sessionError)
  }
  
  return getGameById(game.id)
}

export async function updateGameSession(
  gameId: string,
  userId: string | null,
  playerName: string,
  buyIn: number,
  endAmount: number,
  roleOverride?: GameSession['role']
): Promise<boolean> {
  const supabase = createClient()
  const allowedRoles: GameSession['role'][] = ['guest', 'member', 'bank', 'host', 'admin']
  const roleToUse = allowedRoles.includes(roleOverride as any) ? roleOverride : undefined

  // Check if session exists
  let existing: { id: string } | null = null

  if (userId) {
    const { data } = await supabase
      .from('game_sessions')
      .select('id')
      .eq('game_id', gameId)
      .eq('user_id', userId)
      .maybeSingle()

    existing = data as any
  } else {
    // For sessions without a userId (manual entries), match by game + player name and null user_id
    const { data } = await supabase
      .from('game_sessions')
      .select('id')
      .eq('game_id', gameId)
      .eq('player_name', playerName)
      .is('user_id', null)
      .maybeSingle()

    existing = data as any
  }
  
  if (existing) {
    // Update existing session
    const { error } = await supabase
      .from('game_sessions')
      .update({
        player_name: playerName,
        buy_in: buyIn,
        end_amount: endAmount,
        role: roleToUse || (userId ? 'member' : 'guest'),
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
        role: roleToUse || (userId ? 'member' : 'guest'),
      })
    
    if (error) {
      console.error('Error creating game session:', error)
      return false
    }
  }
  
  return true
}

export async function removeGameSession(
  gameId: string,
  userId: string
): Promise<boolean> {
  const supabase = createClient()

  const { error } = await supabase
    .from('game_sessions')
    .delete()
    .eq('game_id', gameId)
    .eq('user_id', userId)

  if (error) {
    console.error('Error removing game session:', error)
    return false
  }

  return true
}

export async function removeGameParticipantAsAdmin(
  gameId: string,
  participantUserId: string,
  actingUserId: string
): Promise<boolean> {
  const supabase = createClient()

  // Verify game and group ownership
  const { data: gameRow, error: fetchError } = await supabase
    .from('games')
    .select('group_id, created_by')
    .eq('id', gameId)
    .single()

  if (fetchError || !gameRow) {
    console.error('Error verifying game for removal:', fetchError)
    return false
  }

  const ownerOrAdmin = await isGroupOwnerOrAdmin(actingUserId, gameRow.group_id)
  const isHost = gameRow.created_by === actingUserId
  if (!ownerOrAdmin && !isHost) {
    console.warn('Unauthorized game participant removal attempt.')
    return false
  }

  const { error } = await supabase
    .from('game_sessions')
    .delete()
    .eq('game_id', gameId)
    .eq('user_id', participantUserId)

  if (error) {
    console.error('Error removing game participant:', error)
    return false
  }

  return true
}

export async function removeGuestFromGroupSessions(
  groupId: string,
  playerName: string
): Promise<boolean> {
  const supabase = createClient()

  // Get game ids for the group
  const { data: games, error: gamesError } = await supabase
    .from('games')
    .select('id')
    .eq('group_id', groupId)

  if (gamesError || !games?.length) {
    if (gamesError) console.error('Error fetching games for guest removal:', gamesError)
    return false
  }

  const gameIds = games.map(g => g.id)

  const { error } = await supabase
    .from('game_sessions')
    .delete()
    .in('game_id', gameIds)
    .ilike('player_name', playerName)
    .or('user_id.is.null,user_id.ilike.guest-%')

  if (error) {
    console.error('Error deleting guest sessions:', error)
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

// Update user's name across all groups
export async function updateUserName(userId: string, newName: string): Promise<boolean> {
  const supabase = createClient()
  const trimmed = newName.trim()
  
  if (!trimmed || trimmed.length === 0) {
    console.error('Name cannot be empty')
    return false
  }

  const { error } = await supabase
    .from('group_members')
    .update({ user_name: trimmed })
    .eq('user_id', userId)

  if (error) {
    console.error('Error updating user name:', error)
    return false
  }

  return true
}

// Update user's name for a specific group
export async function updateGroupMemberName(groupId: string, userId: string, newName: string, actingUserId: string): Promise<boolean> {
  const supabase = createClient()
  const trimmed = newName.trim()
  
  if (!trimmed || trimmed.length === 0) {
    console.error('Name cannot be empty')
    return false
  }

  // Users can only update their own name
  if (userId !== actingUserId) {
    console.warn('Unauthorized: users can only update their own name')
    return false
  }

  // Update group_members table
  const { error: memberError } = await supabase
    .from('group_members')
    .update({ user_name: trimmed })
    .eq('group_id', groupId)
    .eq('user_id', userId)

  if (memberError) {
    console.error('Error updating group member name:', memberError)
    return false
  }

  // Also update all game_sessions for this user in this group to keep consistency
  // Get game IDs first, then update sessions
  const { data: games } = await supabase
    .from('games')
    .select('id')
    .eq('group_id', groupId)

  if (games && games.length > 0) {
    const gameIds = games.map(g => g.id)
    const { error: sessionUpdateError } = await supabase
      .from('game_sessions')
      .update({ player_name: trimmed })
      .eq('user_id', userId)
      .in('game_id', gameIds)

    if (sessionUpdateError) {
      console.error('Error updating game session names:', sessionUpdateError)
      // Non-fatal - group member name is updated
    }
  }

  return true
}

