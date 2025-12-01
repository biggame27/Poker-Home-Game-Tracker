'use client'

import { useUser } from '@clerk/nextjs'
import { useState, useEffect, useMemo } from 'react'
import { OverallStats } from '@/components/OverallStats'
import { RunningTotalsChart } from '@/components/RunningTotalsChart'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { PlusCircle, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'
import { getGames, getOrCreatePersonalGroup } from '@/lib/supabase/storage'
import type { Game } from '@/types'
import { useRouter } from 'next/navigation'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { createGame, updateGameSession, updateGameStatus } from '@/lib/supabase/storage'

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
  const [currentPage, setCurrentPage] = useState(1)

  const loadGames = async () => {
    if (!user?.id) return
    try {
      const userGames = await getGames(user.id)
      setGames(userGames)
    } catch (error) {
      console.error('Error loading games:', error)
    }
  }

  useEffect(() => {
    if (isLoaded && user?.id) {
      loadGames()
    }
  }, [isLoaded, user?.id])

  // Reset to page 1 if current page is out of bounds
  const gamesPerPage = 5
  const totalPages = useMemo(() => Math.ceil(games.length / gamesPerPage), [games.length, gamesPerPage])
  useEffect(() => {
    if (games.length > 0 && currentPage > totalPages) {
      setCurrentPage(1)
    }
  }, [games.length, currentPage, totalPages])

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
        // Mark personal game as completed
        await updateGameStatus(game.id, 'completed', user.id)
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

  const startIndex = (currentPage - 1) * gamesPerPage
  const endIndex = startIndex + gamesPerPage
  const paginatedGames = games.slice(startIndex, endIndex)

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
            <OverallStats games={games} userId={user?.id} />

            {/* Quick Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RunningTotalsChart 
                games={games} 
                cumulative={true}
                title="Overall Running Total"
                description="Cumulative profit/loss over time"
                userId={user?.id}
              />
              <RunningTotalsChart 
                games={games} 
                cumulative={false}
                title="Recent Game Totals"
                description="Profit/loss per game date"
                userId={user?.id}
              />
            </div>

            {/* Recent Games */}
            <Card>
              <div className="p-6">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-2xl font-semibold">Recent Games</h2>
                  {totalPages > 1 && (
                    <p className="text-sm text-muted-foreground">
                      Page {currentPage} of {totalPages}
                    </p>
                  )}
                </div>
                <div className="space-y-3">
                  {paginatedGames.length > 0 ? (
                    paginatedGames.map((game) => {
                      const userSessions = game.sessions.filter(
                        (s) => s.userId === user?.id
                      )
                      const userProfit = userSessions.reduce(
                        (sum, s) => sum + (s.profit || 0),
                        0
                      )
                      const hasUserSession = userSessions.length > 0

                      return (
                        <div
                          key={game.id}
                          className="flex items-center justify-between p-3 border rounded-lg"
                        >
                          <div>
                            <p className="font-medium">
                              {new Date(game.date).toLocaleDateString()}
                            </p>
                            <p className="text-sm text-muted-foreground">
                              {game.sessions.length} player
                              {game.sessions.length !== 1 ? 's' : ''}
                            </p>
                          </div>
                          <div className="flex flex-col items-end gap-1">
                            {hasUserSession ? (
                              <>
                                <span className="text-xs text-muted-foreground">
                                  Your profit
                                </span>
                                <span
                                  className={`text-sm font-semibold ${
                                    userProfit >= 0
                                      ? 'text-green-600'
                                      : 'text-red-600'
                                  }`}
                                >
                                  {userProfit >= 0 ? '+' : '-'}$
                                  {Math.abs(userProfit).toFixed(2)}
                                </span>
                              </>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                You didn&apos;t play
                              </span>
                            )}
                          </div>
                        </div>
                      )
                    })
                  ) : (
                    <p className="text-muted-foreground text-center py-4">
                      No recent games
                    </p>
                  )}
                </div>
                {totalPages > 1 && (
                  <div className="flex items-center justify-between mt-6 pt-4 border-t">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                      disabled={currentPage === 1}
                      className="gap-2"
                    >
                      <ChevronLeft className="h-4 w-4" />
                      Previous
                    </Button>
                    <div className="flex items-center gap-2">
                      {(() => {
                        const pages: (number | string)[] = []
                        const maxVisible = 7
                        
                        if (totalPages <= maxVisible) {
                          // Show all pages if total is small
                          for (let i = 1; i <= totalPages; i++) {
                            pages.push(i)
                          }
                        } else {
                          // Show first page
                          pages.push(1)
                          
                          if (currentPage <= 3) {
                            // Near the start
                            for (let i = 2; i <= 4; i++) {
                              pages.push(i)
                            }
                            pages.push('...')
                            pages.push(totalPages)
                          } else if (currentPage >= totalPages - 2) {
                            // Near the end
                            pages.push('...')
                            for (let i = totalPages - 3; i <= totalPages; i++) {
                              pages.push(i)
                            }
                          } else {
                            // In the middle
                            pages.push('...')
                            for (let i = currentPage - 1; i <= currentPage + 1; i++) {
                              pages.push(i)
                            }
                            pages.push('...')
                            pages.push(totalPages)
                          }
                        }
                        
                        return pages.map((page, index) => {
                          if (page === '...') {
                            return (
                              <span key={`ellipsis-${index}`} className="px-2 text-muted-foreground">
                                ...
                              </span>
                            )
                          }
                          return (
                            <Button
                              key={page}
                              variant={currentPage === page ? "default" : "outline"}
                              size="sm"
                              onClick={() => setCurrentPage(page as number)}
                              className="min-w-[2.5rem]"
                            >
                              {page}
                            </Button>
                          )
                        })
                      })()}
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                      disabled={currentPage === totalPages}
                      className="gap-2"
                    >
                      Next
                      <ChevronRight className="h-4 w-4" />
                    </Button>
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
