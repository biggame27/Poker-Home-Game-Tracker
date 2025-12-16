'use client'

import { useUser } from '@clerk/nextjs'
import { useState, useEffect, useMemo } from 'react'
import { OverallStats } from '@/components/OverallStats'
import { RunningTotalsChart } from '@/components/RunningTotalsChart'
import { Card, CardContent, CardHeader } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { PlusCircle, Check, X, ChevronLeft, ChevronRight } from 'lucide-react'
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
  const gamesPerPage = 4
  // Filter games to only show ones where the user played
  const userGames = useMemo(() => 
    games.filter((game) => game.sessions.some((s) => s.userId === user?.id)),
    [games, user?.id]
  )
  const totalBuyIns = useMemo(
    () =>
      userGames.reduce(
        (sum, game) =>
          sum +
          (game.sessions?.reduce(
            (s, sess) => s + (sess.userId === user?.id ? (sess.buyIn || 0) : 0),
            0
          ) || 0),
        0
      ),
    [userGames, user?.id]
  )
  const totalPages = useMemo(() => Math.ceil(userGames.length / gamesPerPage), [userGames.length, gamesPerPage])
  useEffect(() => {
    if (userGames.length > 0 && currentPage > totalPages) {
      setCurrentPage(1)
    }
  }, [userGames.length, currentPage, totalPages])


  const startIndex = (currentPage - 1) * gamesPerPage
  const endIndex = startIndex + gamesPerPage
  const paginatedGames = userGames.slice(startIndex, endIndex)

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
        </div>

        {/* Quick Stats / Layout */}
        {userGames.length > 0 ? (
          <>
            {/* Top stats cards */}
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <span className="text-sm">Total Buy-Ins</span>
                  </div>
                  <p className="text-2xl font-bold text-green-600">${totalBuyIns.toFixed(2)}</p>
                </CardContent>
              </Card>
              <Card>
                <CardContent className="pt-6">
                  <div className="flex items-center gap-2 text-muted-foreground mb-2">
                    <span className="text-sm">Games Played</span>
                  </div>
                  <p className="text-2xl font-bold">{userGames.length}</p>
                </CardContent>
              </Card>
            </div>

            {/* Overall stats */}
            <OverallStats games={games} userId={user?.id} />

            {/* Chart and Games side by side */}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-stretch">
              {/* Chart - takes 2/3 of the space */}
              <div className="lg:col-span-2 flex">
                <div className="flex-1">
                  <RunningTotalsChart 
                    games={games} 
                    cumulative={true}
                    title="Overall Running Total"
                    description="Cumulative profit/loss over time"
                    userId={user?.id}
                  />
                </div>
              </div>

              {/* Games List - takes 1/3 of the space */}
              <div className="lg:col-span-1 flex">
                <Card className="flex-1 flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <h2 className="text-xl font-semibold">Your Games</h2>
                        {totalPages > 1 && (
                          <p className="text-xs text-muted-foreground">
                            Page {currentPage} of {totalPages}
                          </p>
                        )}
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto pt-0 pb-2">
                    {paginatedGames.length > 0 ? (
                      <>
                        <div className="space-y-2">
                          {paginatedGames.map((game) => {
                            const userSessions = game.sessions.filter(
                              (s) => s.userId === user?.id
                            )
                            const userProfit = userSessions.reduce(
                              (sum, s) => sum + (s.profit ?? (s.endAmount - s.buyIn)),
                              0
                            )

                            return (
                              <div key={game.id} className="relative group">
                                <Link
                                  href={`/games/${game.id}?from=dashboard`}
                                  className="block"
                                >
                                  <div className="flex items-center justify-between gap-2 p-2 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-medium text-sm truncate">
                                          {new Date(game.date).toLocaleDateString(undefined, {
                                            month: 'short',
                                            day: 'numeric',
                                            year: 'numeric',
                                          })}
                                        </p>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                        {game.sessions.length} player{game.sessions.length !== 1 ? 's' : ''}
                                        {game.notes && ` • ${game.notes}`}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      <p className={`font-semibold text-sm whitespace-nowrap ${userProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                        {userProfit >= 0 ? '+' : ''}${userProfit.toFixed(2)}
                                      </p>
                                    </div>
                                  </div>
                                </Link>
                              </div>
                            )
                          })}
                        </div>
                        {totalPages > 1 && (
                          <div className="flex flex-col gap-2 mt-4 pt-3 pb-0 border-t">
                            <div className="flex items-center justify-center gap-1 flex-wrap">
                              {(() => {
                                const pages: (number | string)[] = []
                                const maxVisible = 7
                                
                                if (totalPages <= maxVisible) {
                                  for (let i = 1; i <= totalPages; i++) {
                                    pages.push(i)
                                  }
                                } else {
                                  pages.push(1)
                                  
                                  if (currentPage <= 3) {
                                    for (let i = 2; i <= 4; i++) {
                                      pages.push(i)
                                    }
                                    pages.push('...')
                                    pages.push(totalPages)
                                  } else if (currentPage >= totalPages - 2) {
                                    pages.push('...')
                                    for (let i = totalPages - 3; i <= totalPages; i++) {
                                      pages.push(i)
                                    }
                                  } else {
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
                            <div className="flex items-center justify-between gap-2">
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                                disabled={currentPage === 1}
                                className="gap-1 text-xs"
                              >
                                <ChevronLeft className="h-3 w-3" />
                                Prev
                              </Button>
                              <Button
                                variant="outline"
                                size="sm"
                                onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                                disabled={currentPage === totalPages}
                                className="gap-1 text-xs"
                              >
                                Next
                                <ChevronRight className="h-3 w-3" />
                              </Button>
                            </div>
                          </div>
                        )}
                      </>
                    ) : (
                      <p className="text-muted-foreground text-center py-4">
                        No recent games
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
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
