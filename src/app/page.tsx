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
  // Filter games to only show ones where the user played
  const userGames = useMemo(() => 
    games.filter((game) => game.sessions.some((s) => s.userId === user?.id)),
    [games, user?.id]
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

                      return (
                        <Link
                          key={game.id}
                          href={`/games/${game.id}?from=dashboard`}
                          className="block"
                        >
                          <div className="flex items-center justify-between p-3 border rounded-lg hover:bg-accent transition-colors">
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
                            </div>
                          </div>
                        </Link>
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
