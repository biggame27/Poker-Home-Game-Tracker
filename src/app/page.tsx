'use client'

import { useUser } from '@clerk/nextjs'
import { useState, useEffect } from 'react'
import { OverallStats } from '@/components/OverallStats'
import { RunningTotalsChart } from '@/components/RunningTotalsChart'
import { Leaderboard } from '@/components/Leaderboard'
import { Card, CardContent } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import Link from 'next/link'
import { PlusCircle, Trophy, BarChart3, Check, X } from 'lucide-react'
import { getGames } from '@/lib/supabase/storage'
import type { Game } from '@/types'

export default function Dashboard() {
  const { user, isLoaded } = useUser()
  const [games, setGames] = useState<Game[]>([])

  useEffect(() => {
    if (isLoaded && user?.id) {
      loadGames()
    }
  }, [isLoaded, user?.id])

  const loadGames = async () => {
    if (!user?.id) return
    try {
      const userGames = await getGames(user.id)
      setGames(userGames)
    } catch (error) {
      console.error('Error loading games:', error)
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  const recentGames = games.slice(-5).reverse()

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
          <Link href="/games/new">
            <Button className="gap-2">
              <PlusCircle className="h-4 w-4" />
              New Game
            </Button>
          </Link>
        </div>

        {/* Quick Stats */}
        {games.length > 0 ? (
          <>
            <OverallStats games={games} />

            {/* Quick Charts */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RunningTotalsChart 
                games={games} 
                cumulative={true}
                title="Overall Running Total"
                description="Cumulative profit/loss over time"
              />
              <RunningTotalsChart 
                games={games} 
                cumulative={false}
                title="Recent Game Totals"
                description="Profit/loss per game date"
              />
            </div>

            {/* Quick Leaderboard Preview */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-semibold">Top Players</h2>
                    <Link href="/leaderboard">
                      <Button variant="ghost" size="sm" className="gap-2">
                        View All
                        <Trophy className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                  <div className="overflow-x-auto">
                    <Leaderboard games={games} hideCard />
                  </div>
                </div>
              </Card>

              <Card>
                <div className="p-6">
                  <div className="flex items-center justify-between mb-4">
                    <h2 className="text-2xl font-semibold">Recent Games</h2>
                    <Link href="/statistics">
                      <Button variant="ghost" size="sm" className="gap-2">
                        View Stats
                        <BarChart3 className="h-4 w-4" />
                      </Button>
                    </Link>
                  </div>
                  <div className="space-y-3">
                    {recentGames.length > 0 ? (
                      recentGames.map((game) => {
                        const totalSum = game.sessions.reduce(
                          (sum, s) => sum + (s.profit || 0),
                          0
                        )
                        const isBalanced = Math.abs(totalSum) < 0.01 // Allow small floating point errors
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
                                {game.sessions.length} player{game.sessions.length !== 1 ? 's' : ''}
                              </p>
                            </div>
                            <div className="flex items-center gap-2">
                              {isBalanced ? (
                                <Check className="h-5 w-5 text-green-600" />
                              ) : (
                                <>
                                  <X className="h-5 w-5 text-red-600" />
                                  <p className="font-semibold text-sm text-red-600">
                                    ${totalSum.toFixed(2)}
                                  </p>
                                </>
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
                </div>
              </Card>
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
