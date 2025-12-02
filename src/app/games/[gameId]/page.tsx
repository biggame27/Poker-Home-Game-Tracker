'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { JoinGameForm } from '@/components/JoinGameForm'
import { Leaderboard } from '@/components/Leaderboard'
import { getGameById, getGroupById, updateGameStatus, updateGameSession } from '@/lib/supabase/storage'
import type { Game, Group } from '@/types'
import { Users, ArrowLeft, Copy, Check, Lock, Unlock, UserPlus } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'

function GameDetailContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoaded } = useUser()
  const gameId = params.gameId as string
  const [game, setGame] = useState<Game | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [copied, setCopied] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [editingSessions, setEditingSessions] = useState<{
    playerName: string
    buyIn: string
    endAmount: string
    userId?: string
  }[]>([])
  const [savingIndex, setSavingIndex] = useState<number | null>(null)
  const [joinLoading, setJoinLoading] = useState(false)
  
  // Get the referrer from query params
  const from = searchParams.get('from') || null
  const groupId = searchParams.get('groupId') || null

  useEffect(() => {
    if (gameId) {
      loadData()
    }
  }, [gameId])

  const loadData = async () => {
    if (!gameId) return
    try {
      const foundGame = await getGameById(gameId)
      if (foundGame) {
        setGame(foundGame)
        const foundGroup = await getGroupById(foundGame.groupId)
        setGroup(foundGroup)

        setEditingSessions(
          (foundGame.sessions || []).map(s => ({
            playerName: s.playerName,
            buyIn: s.buyIn.toString(),
            endAmount: s.endAmount.toString(),
            userId: s.userId,
          }))
        )
      }
    } catch (error) {
      console.error('Error loading game data:', error)
    }
  }

  const refreshGame = async () => {
    if (!gameId) return
    try {
      const foundGame = await getGameById(gameId)
      if (foundGame) {
        setGame(foundGame)
        setEditingSessions(
          (foundGame.sessions || []).map(s => ({
            playerName: s.playerName,
            buyIn: s.buyIn.toString(),
            endAmount: s.endAmount.toString(),
            userId: s.userId,
          }))
        )
      }
    } catch (error) {
      console.error('Error refreshing game:', error)
    }
  }

  const copyGameLink = () => {
    if (gameId) {
      const url = `${window.location.origin}/games/${gameId}`
      navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const changeGameStatus = async (status: 'open' | 'completed') => {
    if (!gameId || !game || !user?.id) return
    setStatusUpdating(true)
    try {
      const success = await updateGameStatus(gameId, status, user.id)
      if (success) {
        await refreshGame()
      } else {
        alert('Could not update the game status. Please try again.')
      }
    } catch (error) {
      console.error('Error updating game status:', error)
      alert('Could not update the game status. Please try again.')
    } finally {
      setStatusUpdating(false)
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-lg font-medium mb-2">Game not found</p>
                <p className="text-muted-foreground mb-4">
                  This game doesn't exist or you don't have access to it.
                </p>
                <Link href="/">
                  <Button>Back to Dashboard</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const isHost = game.createdBy === user?.id
  const isGroupOwner = group
    ? group.createdBy === user?.id || group.members.some(m => m.userId === user?.id && m.role === 'owner')
    : false
  const canAdminEdit = isHost || isGroupOwner
  const isAlreadyJoined = game.sessions.some(s => s.userId === user?.id)
  const isClosed = game.status === 'completed'
  const totalPlayers = game.sessions.length
  const totalBuyIns = game.sessions.reduce((sum, s) => sum + (s.buyIn || 0), 0)
  const totalEndAmounts = game.sessions.reduce((sum, s) => sum + (s.endAmount || 0), 0)
  const totalProfit = totalEndAmounts - totalBuyIns

  const handleQuickJoin = async () => {
    if (!user?.id) {
      alert('You must be logged in to join this game.')
      return
    }
    if (isAlreadyJoined || isClosed) return

    setJoinLoading(true)
    try {
      const playerName = user.fullName || user.emailAddresses?.[0]?.emailAddress || 'Player'
      const success = await updateGameSession(game.id, user.id, playerName, 0, 0)
      if (!success) {
        alert('Failed to join game. Please try again.')
        return
      }
      await refreshGame()
    } catch (error) {
      console.error('Error joining game:', error)
      alert('Failed to join game. Please try again.')
    } finally {
      setJoinLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Button 
              variant="ghost" 
              size="sm" 
              className="gap-2"
              onClick={() => {
                if (from === 'group' && groupId) {
                  router.push(`/groups/${groupId}`)
                } else if (from === 'dashboard') {
                  router.push('/')
                } else if (group) {
                  router.push(`/groups/${group.id}`)
                } else {
                  router.push('/')
                }
              }}
            >
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </div>
          
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">
                Game - {format(new Date(game.date), 'MMMM dd, yyyy')}
              </h1>
              {group && (
                <p className="text-muted-foreground">
                  Group: {group.name}
                </p>
              )}
              <div className="flex items-center gap-3">
                <Badge variant={game.status === 'completed' ? 'secondary' : 'default'}>
                  {game.status === 'completed' ? 'Closed' : game.status === 'in-progress' ? 'In Progress' : 'Open'}
                </Badge>
                {isGroupOwner && (
                  <Button
                    variant={game.status === 'completed' ? 'outline' : 'destructive'}
                    size="sm"
                    className="gap-2"
                    onClick={() => changeGameStatus(game.status === 'completed' ? 'open' : 'completed')}
                    disabled={statusUpdating}
                  >
                    {game.status === 'completed' ? (
                      <Unlock className="h-4 w-4" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    {statusUpdating
                      ? 'Updating...'
                      : game.status === 'completed'
                        ? 'Reopen Game'
                        : 'Close Game'}
                  </Button>
                )}
              </div>
              {game.notes && (
                <p className="text-muted-foreground">{game.notes}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={handleQuickJoin}
                  disabled={joinLoading || isAlreadyJoined || isClosed}
                >
                  <UserPlus className="h-4 w-4" />
                  {isClosed
                    ? 'Game Closed'
                    : isAlreadyJoined
                      ? 'Joined'
                      : joinLoading
                        ? 'Joining...'
                        : 'Join Game'}
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={copyGameLink}
                className="gap-2"
              >
                {copied ? (
                  <>
                    <Check className="h-4 w-4" />
                    Copied
                  </>
                ) : (
                  <>
                    <Copy className="h-4 w-4" />
                    Copy Link
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Game Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">Players</span>
                </div>
                <p className="text-2xl font-bold">{totalPlayers}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <span className="text-sm">Total Buy-Ins</span>
                </div>
                <p className="text-2xl font-bold">${totalBuyIns.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <span className="text-sm">Total End Amounts</span>
                </div>
                <p className="text-2xl font-bold">${totalEndAmounts.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <span className="text-sm">Net Profit</span>
                </div>
                <p className={`text-2xl font-bold ${
                  totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${totalProfit.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Admin Session Editor */}
        {canAdminEdit && (
          <Card>
            <CardHeader>
              <CardTitle>Manage Sessions</CardTitle>
              <CardDescription>
                Edit buy-ins and cash outs for all participants. Changes apply immediately.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {editingSessions.map((session, index) => {
                  const original = game.sessions[index]
                  const profit =
                    (parseFloat(session.endAmount || '0') || 0) -
                    (parseFloat(session.buyIn || '0') || 0)

                  return (
                    <div
                      key={`${session.playerName}-${index}`}
                      className="flex flex-col md:flex-row md:items-end gap-3 border rounded-md p-3"
                    >
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs text-muted-foreground">Player</Label>
                        <p className="text-sm font-medium">
                          {original?.playerName || session.playerName || 'Player'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Buy-In ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-32"
                          value={session.buyIn}
                          onChange={(e) => {
                            const value = e.target.value
                            setEditingSessions(prev => {
                              const next = [...prev]
                              next[index] = { ...next[index], buyIn: value }
                              return next
                            })
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">End Amount ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-32"
                          value={session.endAmount}
                          onChange={(e) => {
                            const value = e.target.value
                            setEditingSessions(prev => {
                              const next = [...prev]
                              next[index] = { ...next[index], endAmount: value }
                              return next
                            })
                          }}
                        />
                      </div>
                      <div className="space-y-1 md:ml-auto">
                        <Label className="text-xs text-muted-foreground">Profit/Loss</Label>
                        <p
                          className={`text-sm font-semibold ${
                            profit >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {profit >= 0 ? '+' : '-'}${Math.abs(profit).toFixed(2)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Button
                          size="sm"
                          className="mt-1"
                          disabled={savingIndex === index || game.status === 'completed'}
                          onClick={async () => {
                            if (!user?.id) return

                            const buyInAmount = parseFloat(session.buyIn) || 0
                            const endAmount = parseFloat(session.endAmount) || 0

                            setSavingIndex(index)
                            try {
                                const success = await updateGameSession(
                                  game.id,
                                  session.userId || null,
                                  original?.playerName || session.playerName || 'Player',
                                  buyInAmount,
                                  endAmount
                                )

                              if (!success) {
                                alert('Failed to update session. Make sure the game is open.')
                                return
                              }

                              await refreshGame()
                            } catch (error) {
                              console.error('Error updating session:', error)
                              alert('Failed to update session. Please try again.')
                            } finally {
                              setSavingIndex(null)
                            }
                          }}
                        >
                          {savingIndex === index ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  )
                })}

                {editingSessions.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No sessions to edit yet. Once players are added, you can manage them here.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Join / Personal Session Form */}
        {user && (
          <div id="join-game-section">
            <JoinGameForm 
              game={game}
            />
          </div>
        )}

        {/* Players List / Leaderboard */}
        {game.sessions.length > 0 && (
          <Leaderboard games={[game]} singleGame={true} />
        )}
      </div>
    </div>
  )
}

export default function GameDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <GameDetailContent />
    </Suspense>
  )
}

