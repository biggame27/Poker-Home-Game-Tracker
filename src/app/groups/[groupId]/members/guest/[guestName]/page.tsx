'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { OverallStats } from '@/components/OverallStats'
import { RunningTotalsChart } from '@/components/RunningTotalsChart'
import { getGroupById, getGamesByGroup } from '@/lib/supabase/storage'
import type { Group, Game } from '@/types'
import { ArrowLeft, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

export default function GuestStatsPage() {
  const params = useParams()
  const { user, isLoaded } = useUser()
  const groupId = params.groupId as string
  const guestName = decodeURIComponent(params.guestName as string)
  const [group, setGroup] = useState<Group | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [currentPage, setCurrentPage] = useState(1)

  useEffect(() => {
    if (groupId) {
      loadData()
    }
  }, [groupId])

  const loadData = async () => {
    if (!groupId) return
    try {
      const foundGroup = await getGroupById(groupId)
      if (foundGroup) {
        setGroup(foundGroup)
        const groupGames = await getGamesByGroup(groupId)
        setGames(groupGames)
      }
    } catch (error) {
      console.error('Error loading group data:', error)
    }
  }

  // Get games where this guest participated (for stats)
  const guestGames = useMemo(() => {
    if (!guestName) return []
    return games.filter(game => 
      game.sessions.some(session => 
        !session.userId && session.playerName?.toLowerCase() === guestName.toLowerCase()
      )
    )
  }, [games, guestName])

  // Pagination logic - show all games, not just ones where guest participated
  const gamesPerPage = 5
  const totalPages = useMemo(() => Math.ceil(games.length / gamesPerPage), [games.length])
  
  useEffect(() => {
    if (games.length > 0 && currentPage > totalPages) {
      setCurrentPage(1)
    }
  }, [games.length, currentPage, totalPages])

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

  if (!group) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">Group not found.</p>
              <Link href={`/groups/${groupId}`}>
                <Button variant="outline" className="mt-4">
                  Back to Group
                </Button>
              </Link>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href={`/groups/${groupId}`}>
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back to Group
            </Button>
          </Link>
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">{guestName}'s Stats</h1>
          <p className="text-muted-foreground">
            Statistics for {guestName} (Guest) in {group.name}
          </p>
        </div>

        {/* Overall Stats */}
        {games.length > 0 && (
          <>
            {/* Create filtered games with guest sessions only for stats */}
            <OverallStats 
              games={games.map(game => ({
                ...game,
                sessions: game.sessions.filter(s => 
                  !s.userId && s.playerName?.toLowerCase() === guestName.toLowerCase()
                )
              })).filter(game => game.sessions.length > 0)} 
              totalGamesInGroup={games.length} 
            />

            {/* Running Totals Chart - filter by guest name using a custom component */}
            <RunningTotalsChart 
              games={games} 
              cumulative={true}
              title="Overall Running Total"
              description="Cumulative profit/loss over time"
              guestName={guestName}
            />

            {/* Games List */}
            <Card>
              <CardHeader>
                <CardTitle>Games</CardTitle>
                <CardDescription>
                  {games.length} game{games.length !== 1 ? 's' : ''} total • {guestGames.length} played
                </CardDescription>
              </CardHeader>
              <CardContent>
                {paginatedGames.length > 0 ? (
                  <>
                    <div className="space-y-3">
                      {paginatedGames.map((game) => {
                        const guestSession = game.sessions.find(s => 
                          !s.userId && s.playerName?.toLowerCase() === guestName.toLowerCase()
                        )
                        const profit = guestSession 
                          ? (guestSession.profit ?? (guestSession.endAmount - guestSession.buyIn))
                          : null
                        
                        return (
                          <Link
                            key={game.id}
                            href={`/games/${game.id}?from=group&groupId=${groupId}`}
                            className="block"
                          >
                            <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                              <div className="flex-1">
                                <p className="font-medium">
                                  {format(new Date(game.date), 'MMMM dd, yyyy')}
                                </p>
                                <p className="text-sm text-muted-foreground mt-1">
                                  {game.sessions.length} player{game.sessions.length !== 1 ? 's' : ''} • {game.notes || 'No notes'}
                                </p>
                              </div>
                              <div className="flex items-center gap-4">
                                <div className="flex flex-col items-end gap-1">
                                  <span className="text-xs text-muted-foreground">
                                    Profit/Loss
                                  </span>
                                  {profit !== null ? (
                                    <span
                                      className={`text-sm font-semibold ${
                                        profit >= 0
                                          ? 'text-green-600'
                                          : 'text-red-600'
                                      }`}
                                    >
                                      {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
                                    </span>
                                  ) : (
                                    <span className="text-sm text-muted-foreground">
                                      —
                                    </span>
                                  )}
                                </div>
                              </div>
                            </div>
                          </Link>
                        )
                      })}
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
                            
                            return pages.map((page, idx) => {
                              if (page === '...') {
                                return (
                                  <span key={`ellipsis-${idx}`} className="px-2 text-muted-foreground">
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
                  </>
                ) : (
                  <p className="text-muted-foreground text-center py-4">
                    No games found
                  </p>
                )}
              </CardContent>
            </Card>
          </>
        )}

        {games.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">
                No games in this group yet.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

