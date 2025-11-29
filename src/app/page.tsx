'use client'

import { useUser } from '@clerk/nextjs'
import { useState, useEffect } from 'react'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { PlusCircle, Heart, Flame, Sparkles, Trophy } from 'lucide-react'
import { getGames, getOrCreatePersonalGroup } from '@/lib/supabase/storage'
import type { Game } from '@/types'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createGame, updateGameSession } from '@/lib/supabase/storage'

export default function Dashboard() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [games, setGames] = useState<Game[]>([])
  const [creatingPersonal, setCreatingPersonal] = useState(false)
  const [showPersonalModal, setShowPersonalModal] = useState(false)
  const [personalBuyIn, setPersonalBuyIn] = useState('')
  const [personalEnd, setPersonalEnd] = useState('')
  const [personalDate, setPersonalDate] = useState(new Date().toISOString().split('T')[0])
  const [personalSaving, setPersonalSaving] = useState(false)
  const [reactions, setReactions] = useState<Record<string, { like: number; hype: number; clap: number }>>({})
  const [comments, setComments] = useState<Record<string, { id: string; text: string; createdAt: string }[]>>({})
  const [draftComments, setDraftComments] = useState<Record<string, string>>({})

  useEffect(() => {
    if (isLoaded && user?.id) {
      loadGames()
    }
  }, [isLoaded, user?.id])

  const socialGames = games.slice(0, 5)

  useEffect(() => {
    const updates: Record<string, { like: number; hype: number; clap: number }> = {}
    socialGames.forEach((game) => {
      if (!reactions[game.id]) {
        updates[game.id] = { like: 0, hype: 0, clap: 0 }
      }
    })
    if (Object.keys(updates).length) {
      setReactions((prev) => ({ ...updates, ...prev }))
    }
  }, [socialGames, reactions])

  const addReaction = (gameId: string, type: 'like' | 'hype' | 'clap') => {
    setReactions((prev) => ({
      ...prev,
      [gameId]: {
        like: (prev[gameId]?.like ?? 0) + (type === 'like' ? 1 : 0),
        hype: (prev[gameId]?.hype ?? 0) + (type === 'hype' ? 1 : 0),
        clap: (prev[gameId]?.clap ?? 0) + (type === 'clap' ? 1 : 0),
      },
    }))
  }

  const addComment = (gameId: string) => {
    const text = draftComments[gameId]?.trim()
    if (!text) return
    const entry = {
      id: crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
      text,
      createdAt: new Date().toISOString(),
    }
    setComments((prev) => ({
      ...prev,
      [gameId]: [...(prev[gameId] || []), entry],
    }))
    setDraftComments((prev) => ({ ...prev, [gameId]: '' }))
  }

  const loadGames = async () => {
    if (!user?.id) return
    try {
      const userGames = await getGames(user.id)
      setGames(userGames)
    } catch (error) {
      console.error('Error loading games:', error)
    }
  }

  const handlePersonalGame = async () => {
    if (!user?.id) return
    setCreatingPersonal(true)
    try {
      await getOrCreatePersonalGroup(
        user.id,
        user.fullName || user.emailAddresses[0]?.emailAddress || 'Host'
      )
      setShowPersonalModal(true)
    } catch (error) {
      console.error('Error preparing personal game:', error)
    } finally {
      setCreatingPersonal(false)
    }
  }

  const savePersonalGame = async () => {
    if (!user?.id) return
    const buyIn = parseFloat(personalBuyIn) || 0
    const endAmount = parseFloat(personalEnd) || 0
    const selectedDate = personalDate || new Date().toISOString().split('T')[0]
    setPersonalSaving(true)
    try {
      const personalGroup = await getOrCreatePersonalGroup(
        user.id,
        user.fullName || user.emailAddresses[0]?.emailAddress || 'Host'
      )
      if (!personalGroup) return

      const game = await createGame(
        personalGroup.id,
        selectedDate,
        'Personal session',
        user.id,
        user.fullName || user.emailAddresses[0]?.emailAddress || 'Host'
      )
      if (game) {
        await updateGameSession(
          game.id,
          user.id,
          user.fullName || user.emailAddresses[0]?.emailAddress || 'Host',
          buyIn,
          endAmount
        )
        await loadGames()
      }
    } catch (error) {
      console.error('Error saving personal game:', error)
    } finally {
      setPersonalSaving(false)
      setShowPersonalModal(false)
      setPersonalBuyIn('')
      setPersonalEnd('')
      setPersonalDate(new Date().toISOString().split('T')[0])
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Dashboard</h1>
            <p className="text-muted-foreground">
              Overview of your poker games and statistics
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Link href="/games/new">
              <Button className="gap-2">
                <PlusCircle className="h-4 w-4" />
                New Group Game
              </Button>
            </Link>
            <Button
              variant="outline"
              className="gap-2"
              onClick={handlePersonalGame}
              disabled={creatingPersonal}
            >
              <PlusCircle className="h-4 w-4" />
              {creatingPersonal ? 'Preparing...' : 'New Personal Game'}
            </Button>
          </div>
        </div>

        {showPersonalModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg space-y-4">
              <div className="space-y-1">
                <h3 className="text-lg font-semibold">New Personal Session</h3>
                <p className="text-sm text-muted-foreground">
                  Log a single-session personal game. It will appear in your dashboard stats.
                </p>
              </div>
              <div className="space-y-3">
                <div className="space-y-2">
                  <Label htmlFor="personalDate">Date</Label>
                  <Input
                    id="personalDate"
                    type="date"
                    value={personalDate}
                    onChange={(e) => setPersonalDate(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="personalBuyIn">Buy-In ($)</Label>
                  <Input
                    id="personalBuyIn"
                    type="number"
                    step="0.01"
                    min="0"
                    value={personalBuyIn}
                    onChange={(e) => setPersonalBuyIn(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="personalEnd">Cash Out ($)</Label>
                  <Input
                    id="personalEnd"
                    type="number"
                    step="0.01"
                    min="0"
                    value={personalEnd}
                    onChange={(e) => setPersonalEnd(e.target.value)}
                    placeholder="0.00"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2">
                <Button
                  variant="outline"
                  onClick={() => {
                    setShowPersonalModal(false)
                    setPersonalBuyIn('')
                    setPersonalEnd('')
                  }}
                  disabled={personalSaving}
                >
                  Cancel
                </Button>
                <Button
                  onClick={savePersonalGame}
                  disabled={personalSaving}
                  className="min-w-[120px]"
                >
                  {personalSaving ? 'Saving...' : 'Save'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Quick Stats */}
        {games.length > 0 ? (
          <>
            {/* Social Interactions moved from profile */}
            <Card>
              <div className="p-6 space-y-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Sparkles className="h-4 w-4" />
                    <h2 className="text-2xl font-semibold">Social Interactions</h2>
                  </div>
                  <p className="text-sm text-muted-foreground">React or comment on sessions</p>
                </div>
                {socialGames.length === 0 ? (
                  <div className="text-muted-foreground">No sessions yet.</div>
                ) : (
                  <div className="space-y-4">
                    {socialGames.map((game) => {
                      const userSession = game.sessions.find((s) => s.userId === user?.id)
                      const userProfit = userSession
                        ? userSession.profit ?? (userSession.endAmount - userSession.buyIn)
                        : null
                      const playerCount = game.sessions.length
                      return (
                        <div key={game.id} className="rounded-lg border p-3 space-y-3">
                          <div className="flex flex-col gap-1 md:flex-row md:items-center md:justify-between">
                            <div>
                              <p className="font-semibold">
                                {new Date(game.date).toLocaleDateString()}
                              </p>
                              <p className="text-sm text-muted-foreground">
                                {playerCount} player{playerCount === 1 ? '' : 's'}
                                {userProfit !== null && (
                                  <> · Your profit {userProfit >= 0 ? '+' : ''}${userProfit.toFixed(2)}</>
                                )}
                              </p>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => addReaction(game.id, 'like')}
                            >
                              <Heart className="h-4 w-4" />
                              Like {reactions[game.id]?.like ? reactions[game.id].like : ''}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => addReaction(game.id, 'hype')}
                            >
                              <Flame className="h-4 w-4" />
                              Hype {reactions[game.id]?.hype ? reactions[game.id].hype : ''}
                            </Button>
                            <Button
                              type="button"
                              variant="outline"
                              size="sm"
                              className="gap-1"
                              onClick={() => addReaction(game.id, 'clap')}
                            >
                              <Trophy className="h-4 w-4" />
                              Clap {reactions[game.id]?.clap ? reactions[game.id].clap : ''}
                            </Button>
                          </div>
                          <div className="space-y-2">
                            <div className="flex gap-2">
                              <Input
                                value={draftComments[game.id] || ''}
                                onChange={(e) =>
                                  setDraftComments((prev) => ({ ...prev, [game.id]: e.target.value }))
                                }
                                placeholder="Add a comment"
                              />
                              <Button type="button" onClick={() => addComment(game.id)} size="sm">
                                Post
                              </Button>
                            </div>
                            <div className="space-y-1">
                              {(comments[game.id] || []).length === 0 ? (
                                <p className="text-xs text-muted-foreground">No comments yet.</p>
                              ) : (
                                comments[game.id].map((c) => (
                                  <div key={c.id} className="text-sm">
                                    <span className="font-semibold">Player</span>{' '}
                                    <span className="text-muted-foreground">
                                      {new Date(c.createdAt).toLocaleString()}
                                    </span>
                                    <div>{c.text}</div>
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>
            </Card>
          </>
        ) : (
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <PlusCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">No games tracked yet</p>
                <p className="text-muted-foreground mb-6">
                  Add your first game to get started!
                </p>
                <Link href="/games/new">
                  <Button className="gap-2">
                    <PlusCircle className="h-4 w-4" />
                    Create Your First Game
                  </Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}
