// Utility functions for localStorage management

import type { Game, Group } from '@/types'

const STORAGE_KEYS = {
  GAMES: 'poker-games',
  GROUPS: 'poker-groups',
  USER_GROUPS: 'poker-user-groups', // Map of userId -> groupIds[]
} as const

// Games
export function getGames(): Game[] {
  if (typeof window === 'undefined') return []
  const games = localStorage.getItem(STORAGE_KEYS.GAMES)
  return games ? JSON.parse(games) : []
}

export function saveGames(games: Game[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.GAMES, JSON.stringify(games))
}

export function addGame(game: Game): void {
  const games = getGames()
  games.push(game)
  saveGames(games)
}

export function getGamesByGroup(groupId: string): Game[] {
  return getGames().filter(game => game.groupId === groupId)
}

export function getGamesByUser(userId: string): Game[] {
  return getGames().filter(game => 
    game.createdBy === userId || 
    game.sessions.some(s => s.userId === userId)
  )
}

// Groups
export function getGroups(): Group[] {
  if (typeof window === 'undefined') return []
  const groups = localStorage.getItem(STORAGE_KEYS.GROUPS)
  return groups ? JSON.parse(groups) : []
}

export function saveGroups(groups: Group[]): void {
  if (typeof window === 'undefined') return
  localStorage.setItem(STORAGE_KEYS.GROUPS, JSON.stringify(groups))
}

export function addGroup(group: Group): void {
  const groups = getGroups()
  groups.push(group)
  saveGroups(groups)
}

export function getGroupById(groupId: string): Group | undefined {
  return getGroups().find(g => g.id === groupId)
}

export function updateGroup(group: Group): void {
  const groups = getGroups()
  const index = groups.findIndex(g => g.id === group.id)
  if (index !== -1) {
    groups[index] = group
    saveGroups(groups)
  }
}

export function getGroupByInviteCode(inviteCode: string): Group | undefined {
  return getGroups().find(g => g.inviteCode === inviteCode)
}

// User Groups (which groups a user belongs to)
export function getUserGroups(userId: string): string[] {
  if (typeof window === 'undefined') return []
  const userGroups = localStorage.getItem(STORAGE_KEYS.USER_GROUPS)
  if (!userGroups) return []
  const map = JSON.parse(userGroups)
  return map[userId] || []
}

export function addUserToGroup(userId: string, groupId: string): void {
  if (typeof window === 'undefined') return
  const userGroups = localStorage.getItem(STORAGE_KEYS.USER_GROUPS)
  const map = userGroups ? JSON.parse(userGroups) : {}
  if (!map[userId]) {
    map[userId] = []
  }
  if (!map[userId].includes(groupId)) {
    map[userId].push(groupId)
    localStorage.setItem(STORAGE_KEYS.USER_GROUPS, JSON.stringify(map))
  }
}

export function generateInviteCode(): string {
  return Math.random().toString(36).substring(2, 8).toUpperCase()
}

