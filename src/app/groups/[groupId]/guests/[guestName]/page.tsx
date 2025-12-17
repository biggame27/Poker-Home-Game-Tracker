'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { OverallStats } from '@/components/OverallStats'
import { RunningTotalsChart } from '@/components/RunningTotalsChart'
import { getGroupById, getGamesByGroup } from '@/lib/supabase/storage'
import type { Group, Game, GameSession } from '@/types'
import { ArrowLeft, ChevronRight, ChevronLeft, PlusCircle } from 'lucide-react'
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
  const [loading, setLoading] = useState(true)
  
  // Find the guest's userId from group members or sessions
  const guestUserId = useMemo(() => {
    if (!group || !guestName) return null
    // First try to find in group members
    const guestMember = group.members.find(m => 
      m.userName?.toLowerCase() === guestName.toLowerCase() && 
      (m.userId?.startsWith('guest-') || !m.userId)
    )
    if (guestMember?.userId) return guestMember.userId
    
    // If not found in members, try to find from sessions
    for (const game of games) {
      const session = game.sessions.find(s => {
        const nameMatches = s.playerName?.toLowerCase() === guestName.toLowerCase()
        const isGuest = !s.userId || s.userId?.startsWith('guest-') || s.role === 'guest'
        return nameMatches && isGuest
      })
      if (session?.userId) return session.userId
    }
    
    return null
  }, [group, guestName, games])

  useEffect(() => {
    if (groupId) {
      loadData()
    }
  }, [groupId])

  const loadData = async () => {
    if (!groupId) return
    setLoading(true)
    try {
      const foundGroup = await getGroupById(groupId)
      if (foundGroup) {
        setGroup(foundGroup)
        const groupGames = await getGamesByGroup(groupId)
        setGames(groupGames)
      }
    } catch (error) {
      console.error('Error loading group data:', error)
    } finally {
      setLoading(false)
    }
  }

  // Get games where this guest participated (for stats), filtered to only include the guest's sessions
  const guestGames = useMemo(() => {
    if (!guestName) return []
    return games
      .filter(game => 
        game.sessions.some((session: GameSession) => {
          const nameMatches = session.playerName?.toLowerCase() === guestName.toLowerCase()
          const isGuest = !session.userId || session.userId?.startsWith('guest-') || session.role === 'guest'
          return nameMatches && isGuest
        })
      )
      .map(game => ({
        ...game,
        sessions: game.sessions.filter((session: GameSession) => {
          const nameMatches = session.playerName?.toLowerCase() === guestName.toLowerCase()
          const isGuest = !session.userId || session.userId?.startsWith('guest-') || session.role === 'guest'
          return nameMatches && isGuest
        })
      }))
  }, [games, guestName])

  // Pagination logic - show all games, not just ones where guest participated
  const gamesPerPage = 4
  const totalPages = useMemo(() => Math.ceil(games.length / gamesPerPage), [games.length])
  
  useEffect(() => {
    if (games.length > 0 && currentPage > totalPages) {
      setCurrentPage(1)
    }
  }, [games.length, currentPage, totalPages])

  const startIndex = (currentPage - 1) * gamesPerPage
  const endIndex = startIndex + gamesPerPage
  const paginatedGames = games.slice(startIndex, endIndex)
  
  // Calculate total buy-ins for this guest
  const totalBuyIns = guestGames.reduce((sum, game) => 
    sum + (game.sessions?.reduce((s: number, sess: any) => s + (sess.buyIn || 0), 0) || 0), 0
  )

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="text-muted-foreground">Loading guest stats...</div>
        </div>
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

        {/* Stats Cards */}
        {games.length > 0 && (
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
                <p className="text-2xl font-bold">{guestGames.length}</p>
              </CardContent>
            </Card>
          </div>
        )}

        {/* Overall Stats */}
        {games.length > 0 && (
          <>
            <OverallStats games={guestGames} totalGamesInGroup={games.length} />

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
                    userId={guestUserId || undefined}
                    guestName={guestUserId ? undefined : guestName}
                  />
                </div>
              </div>

              {/* Games List - takes 1/3 of the space */}
              <div className="lg:col-span-1 flex">
                <Card className="flex-1 flex flex-col">
                  <CardHeader className="pb-3">
                    <div className="flex items-center justify-between">
                      <div>
                        <CardTitle>Games</CardTitle>
                        <CardDescription>
                          {games.length} game{games.length !== 1 ? 's' : ''} total • {guestGames.length} played
                        </CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto pt-0 pb-2">
                    {paginatedGames.length > 0 ? (
                      <>
                        <div className="space-y-2">
                          {paginatedGames.map((game) => {
                            const guestSession = game.sessions.find(s => {
                              const nameMatches = s.playerName?.toLowerCase() === guestName.toLowerCase()
                              const isGuest = !s.userId || s.userId?.startsWith('guest-') || s.role === 'guest'
                              return nameMatches && isGuest
                            })
                            const profit = guestSession 
                              ? (guestSession.profit ?? (guestSession.endAmount - guestSession.buyIn))
                              : null
                            
                            return (
                              <div key={game.id} className="relative group">
                                <Link
                                  href={`/games/${game.id}?from=group&groupId=${groupId}`}
                                  className="block"
                                >
                                  <div className="flex items-center justify-between gap-2 p-2 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-medium text-sm truncate">
                                          {format(new Date(game.date), 'MMM dd, yyyy')}
                                        </p>
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                        {game.sessions.length} player{game.sessions.length !== 1 ? 's' : ''}
                                        {game.notes && ` • ${game.notes}`}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {profit !== null && (
                                        <p className={`font-semibold text-sm whitespace-nowrap ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                          {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
                                        </p>
                                      )}
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
                        No games found
                      </p>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>
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

