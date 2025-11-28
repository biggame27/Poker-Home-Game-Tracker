// Shared types for the poker tracker app

export interface GameSession {
  playerName: string
  buyIn: number
  endAmount: number
  profit: number
  userId?: string // Clerk user ID if player is a registered user
}

export interface Game {
  id: string
  groupId: string
  date: string
  sessions: GameSession[]
  notes?: string
  createdBy: string // Clerk user ID (host)
  createdAt: string
  status: 'open' | 'in-progress' | 'completed' // Game status
}

export interface Group {
  id: string
  name: string
  description?: string
  createdBy: string // Clerk user ID
  createdAt: string
  members: GroupMember[]
  inviteCode: string // Unique code for joining
}

export interface GroupMember {
  userId: string // Clerk user ID
  userName: string
  joinedAt: string
  role: 'owner' | 'member'
}

export interface PlayerStats {
  name: string
  userId?: string
  totalProfit: number
  gamesPlayed: number
  totalBuyIns: number
  totalEndAmounts: number
  winRate: number
}

