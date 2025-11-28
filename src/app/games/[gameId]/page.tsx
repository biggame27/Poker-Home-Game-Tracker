'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { JoinGameForm } from '@/components/JoinGameForm'
import { Leaderboard } from '@/components/Leaderboard'
import { getGameById, getGroupById, updateGameStatus } from '@/lib/supabase/storage'
import type { Game, Group } from '@/types'
import { Users, Calendar, ArrowLeft, Copy, Check, Lock, Unlock } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'

export default function GameDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const gameId = params.gameId as string
  const [game, setGame] = useState<Game | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [copied, setCopied] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)

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
    if (!gameId || !game) return
    setStatusUpdating(true)
    try {
      const success = await updateGameStatus(gameId, status)
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
  const totalPlayers = game.sessions.length
  const totalBuyIns = game.sessions.reduce((sum, s) => sum + (s.buyIn || 0), 0)
  const totalEndAmounts = game.sessions.reduce((sum, s) => sum + (s.endAmount || 0), 0)
  const totalProfit = totalEndAmounts - totalBuyIns

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-center gap-4">
            <Link href={group ? `/groups/${group.id}` : '/'}>
              <Button variant="ghost" size="sm" className="gap-2">
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </Link>
          </div>
          
          <div className="flex items-start justify-between">
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
                {isHost && (
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

        {/* Join Game Form */}
        {user && (
          <JoinGameForm game={game} onSuccess={refreshGame} />
        )}

        {/* Players List / Leaderboard */}
        {game.sessions.length > 0 && (
          <Leaderboard games={[game]} singleGame={true} />
        )}
      </div>
    </div>
  )
}

