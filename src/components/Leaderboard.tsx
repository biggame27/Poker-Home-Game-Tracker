'use client'

import { useState, useMemo, type ReactElement } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trophy, Pencil } from 'lucide-react'
import { updateGroupMemberName } from '@/lib/supabase/storage'
import type { Game, GameSession, PlayerStats, GroupMember } from '@/types'

type LeaderboardItem = PlayerStats & {
  buyIn?: number
  endAmount?: number
}

export function Leaderboard({ games, hideCard = false, groupId, userId, singleGame = false, onNameUpdate, groupMembers }: { games: Game[]; hideCard?: boolean; groupId?: string; userId?: string; singleGame?: boolean; onNameUpdate?: () => void; groupMembers?: GroupMember[] }): ReactElement {
  const { user } = useUser()
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [savingName, setSavingName] = useState(false)

  // Create a map of userId -> current userName from group members
  const memberNameMap = useMemo(() => {
    const map = new Map<string, string>()
    if (groupMembers) {
      groupMembers.forEach(member => {
        if (member.userId && member.userName) {
          map.set(member.userId, member.userName)
        }
      })
    }
    return map
  }, [groupMembers])

  const leaderboard = useMemo((): LeaderboardItem[] => {
    // Helper function to get the display name, prioritizing group member name
    const getDisplayName = (session: GameSession): string => {
      // If we have a userId and it's in the group members, use the current group member name
      if (session.userId && memberNameMap.has(session.userId)) {
        return memberNameMap.get(session.userId)!
      }
      // Otherwise fall back to session playerName
      return (session.playerName || 'Unknown').toString()
    }

    // For single game view, just show the sessions directly
    if (singleGame && games.length === 1) {
      const game = games[0]
      return game.sessions
        .map((session: GameSession) => {
          const profit = session.profit || (session.endAmount - session.buyIn)
          const displayName = getDisplayName(session)
          return {
            name: displayName,
            userId: session.userId || undefined,
            totalProfit: profit,
            buyIn: session.buyIn || 0,
            endAmount: session.endAmount || 0,
            gamesPlayed: 1,
            totalBuyIns: session.buyIn || 0,
            totalEndAmounts: session.endAmount || 0,
            winRate: profit > 0 ? 1 : 0
          }
        })
        .sort((a, b) => b.totalProfit - a.totalProfit)
    }

    // For multiple games, aggregate stats
    const playerStats = new Map<string, PlayerStats>()

    games.forEach(game => {
      game.sessions?.forEach((session: GameSession) => {
        // Filter by userId if provided
        if (userId && session.userId !== userId) {
          return
        }
        
        const displayName = getDisplayName(session)
        const profit = session.profit || (session.endAmount - session.buyIn)
        const buyIn = session.buyIn || 0
        const endAmount = session.endAmount || 0
        
        // Use userId as key if available, otherwise use name
        const key = session.userId || displayName
        
        if (!playerStats.has(key)) {
          playerStats.set(key, {
            name: displayName,
            userId: session.userId || undefined,
            totalProfit: 0,
            gamesPlayed: 0,
            totalBuyIns: 0,
            totalEndAmounts: 0,
            winRate: 0
          })
        }

        const stats = playerStats.get(key)!
        stats.totalProfit += profit
        stats.gamesPlayed += 1
        stats.totalBuyIns += buyIn
        stats.totalEndAmounts += endAmount
      })
    })

    // Update names from group members after aggregation (in case we have userIds)
    playerStats.forEach((stats) => {
      if (stats.userId && memberNameMap.has(stats.userId)) {
        stats.name = memberNameMap.get(stats.userId)!
      }
      stats.winRate = stats.gamesPlayed > 0 
        ? (stats.totalProfit > 0 ? 1 : 0) // Simplified: 1 if profitable overall, 0 otherwise
        : 0
    })

    return Array.from(playerStats.values())
      .sort((a, b) => b.totalProfit - a.totalProfit)
  }, [games, singleGame, userId, memberNameMap])

  const getRankIcon = (rank: number) => {
    if (rank === 0) return <Trophy className="h-5 w-5 text-yellow-500" />
    if (rank === 1) return <Trophy className="h-5 w-5 text-gray-400" />
    if (rank === 2) return <Trophy className="h-5 w-5 text-amber-600" />
    return <span className="text-muted-foreground">#{rank + 1}</span>
  }

  const tableContent = (
    <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Rank</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Sessions Played</TableHead>
              <TableHead className="text-right">Total Buy-Ins</TableHead>
              <TableHead className="text-right">Total Profit</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboard.map((player, index) => {
              const key = player.userId ? `user-${player.userId}` : `name-${(player.name || 'Unknown').toString()}-${index}`
              const displayName = (player.name || 'Unknown').toString()
              const isCurrentUser = player.userId === user?.id
              const isEditing = editingPlayerId === player.userId
              
              return (
                <TableRow key={key}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getRankIcon(index)}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">
                    {isEditing && groupId ? (
                      <div className="flex items-center gap-2">
                        <Input
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              handleSaveName()
                            } else if (e.key === 'Escape') {
                              handleCancelEditName()
                            }
                          }}
                          disabled={savingName}
                          className="h-8 w-32"
                          autoFocus
                        />
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleSaveName}
                          disabled={savingName || !editingName.trim()}
                          className="h-8 px-2"
                        >
                          {savingName ? '...' : '✓'}
                        </Button>
                        <Button
                          size="sm"
                          variant="ghost"
                          onClick={handleCancelEditName}
                          disabled={savingName}
                          className="h-8 px-2"
                        >
                          ✕
                        </Button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span>{displayName}</span>
                        {isCurrentUser && groupId && (
                          <Button
                            size="icon"
                            variant="ghost"
                            onClick={() => handleStartEditName(player.userId!, displayName)}
                            aria-label="Edit your name"
                            className="h-6 w-6"
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                        )}
                      </div>
                    )}
                  </TableCell>
                  <TableCell className="text-right">{player.gamesPlayed || 0}</TableCell>
                  <TableCell className="text-right">${(player.totalBuyIns || 0).toFixed(2)}</TableCell>
                  <TableCell className={`text-right font-semibold ${(player.totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${(player.totalProfit || 0) >= 0 ? '+' : ''}{(player.totalProfit || 0).toFixed(2)}
                  </TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
  )

  if (leaderboard.length === 0) {
    const emptyState = (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        {singleGame ? 'No players have joined this game yet.' : 'No players yet. Add a game to see the leaderboard.'}
      </div>
    )

    if (hideCard) {
      return emptyState
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
          <CardDescription>
            {singleGame ? 'Player rankings for this game' : 'Player rankings based on total profit'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emptyState}
        </CardContent>
      </Card>
    )
  }

  if (hideCard) {
    return tableContent
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
        <CardDescription>
          {singleGame ? 'Player rankings for this game' : 'Player rankings based on total profit'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {tableContent}
      </CardContent>
    </Card>
  )
}

