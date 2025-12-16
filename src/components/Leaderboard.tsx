'use client'

import { useState, useMemo, type ReactElement } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Trophy, Pencil, ArrowDown } from 'lucide-react'
import { updateGroupMemberName } from '@/lib/supabase/storage'
import type { Game, GameSession, PlayerStats, GroupMember } from '@/types'
import Link from 'next/link'

type LeaderboardItem = PlayerStats & {
  buyIn?: number
  endAmount?: number
}

export function Leaderboard({ games, hideCard = false, groupId, userId, singleGame = false, onNameUpdate, groupMembers }: { games: Game[]; hideCard?: boolean; groupId?: string; userId?: string; singleGame?: boolean; onNameUpdate?: () => void; groupMembers?: GroupMember[] }): ReactElement {
  const { user } = useUser()
  const [editingPlayerId, setEditingPlayerId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [savingName, setSavingName] = useState(false)
  const [sortColumn, setSortColumn] = useState<'profit' | 'sessions' | 'buyins'>('profit')

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
  }, [games, singleGame, userId, memberNameMap])

  // Sort the leaderboard based on selected column (always descending - top to bottom)
  const sortedLeaderboard = useMemo(() => {
    const sorted = [...leaderboard]
    
    sorted.sort((a, b) => {
      let aValue: number
      let bValue: number
      
      switch (sortColumn) {
        case 'sessions':
          aValue = a.gamesPlayed || 0
          bValue = b.gamesPlayed || 0
          break
        case 'buyins':
          aValue = a.totalBuyIns || 0
          bValue = b.totalBuyIns || 0
          break
        case 'profit':
        default:
          aValue = a.totalProfit || 0
          bValue = b.totalProfit || 0
          break
      }
      
      return bValue - aValue
    })
    
    return sorted
  }, [leaderboard, sortColumn])

  const handleSort = (column: 'profit' | 'sessions' | 'buyins') => {
    setSortColumn(column)
  }

  const getRankIcon = (rank: number) => {
    if (rank === 0) return <Trophy className="h-5 w-5 text-yellow-500" />
    if (rank === 1) return <Trophy className="h-5 w-5 text-gray-400" />
    if (rank === 2) return <Trophy className="h-5 w-5 text-amber-600" />
    return <span className="text-muted-foreground">#{rank + 1}</span>
  }

  const handleStartEditName = (playerId: string, currentName: string) => {
    setEditingPlayerId(playerId)
    setEditingName(currentName)
  }

  const handleCancelEditName = () => {
    setEditingPlayerId(null)
    setEditingName('')
  }

  const handleSaveName = async () => {
    if (!groupId || !user?.id || !editingPlayerId) return
    
    const trimmed = editingName.trim()
    if (!trimmed || trimmed.length === 0) {
      return
    }

    setSavingName(true)
    try {
      const success = await updateGroupMemberName(groupId, editingPlayerId, trimmed, user.id)
      if (success) {
        setEditingPlayerId(null)
        setEditingName('')
        onNameUpdate?.()
      }
    } catch (error) {
      console.error('Error updating name:', error)
    } finally {
      setSavingName(false)
    }
  }

  const tableContent = (
    <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Rank</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <span>Total Profit</span>
                  <button
                    type="button"
                    onClick={() => handleSort('profit')}
                    className={`flex items-center justify-center hover:text-primary transition-colors ${sortColumn === 'profit' ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
              </TableHead>
              <TableHead className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <span>Total Buy-Ins</span>
                  <button
                    type="button"
                    onClick={() => handleSort('buyins')}
                    className={`flex items-center justify-center hover:text-primary transition-colors ${sortColumn === 'buyins' ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
              </TableHead>
              <TableHead className="text-right">
                <div className="flex items-center justify-end gap-2">
                  <span>Sessions Played</span>
                  <button
                    type="button"
                    onClick={() => handleSort('sessions')}
                    className={`flex items-center justify-center hover:text-primary transition-colors ${sortColumn === 'sessions' ? 'text-primary' : 'text-muted-foreground'}`}
                  >
                    <ArrowDown className="h-3 w-3" />
                  </button>
                </div>
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {sortedLeaderboard.map((player, index) => {
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
                        {(() => {
                          const isGuest = !player.userId || player.userId?.startsWith('guest-')
                          const profileLink = groupId 
                            ? (isGuest 
                                ? `/groups/${groupId}/guests/${encodeURIComponent(displayName)}`
                                : `/groups/${groupId}/members/${player.userId}`)
                            : null
                          
                          return profileLink ? (
                            <Link 
                              href={profileLink}
                              className="hover:underline hover:text-primary transition-colors"
                            >
                              {displayName}
                            </Link>
                          ) : (
                            <span>{displayName}</span>
                          )
                        })()}
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
                  <TableCell className={`text-right font-semibold ${(player.totalProfit || 0) >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                    ${(player.totalProfit || 0) >= 0 ? '+' : ''}{(player.totalProfit || 0).toFixed(2)}
                  </TableCell>
                  <TableCell className="text-right">${(player.totalBuyIns || 0).toFixed(2)}</TableCell>
                  <TableCell className="text-right">{player.gamesPlayed || 0}</TableCell>
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
  )

  if (sortedLeaderboard.length === 0) {
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
