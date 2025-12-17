'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
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
import { Leaderboard } from '@/components/Leaderboard'

export default function MemberStatsPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const groupId = params.groupId as string
  const memberId = params.memberId as string
  const [group, setGroup] = useState<Group | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [currentPage, setCurrentPage] = useState(1)
  const [loading, setLoading] = useState(true)

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

  // Find the member
  const member = useMemo(() => {
    if (!group) return null
    return group.members.find(m => m.userId === memberId)
  }, [group, memberId])

  // Get games where this member participated (for stats)
  const memberGames = useMemo(() => {
    if (!memberId) return []
    return games.filter(game => 
      game.sessions.some(session => session.userId === memberId)
    )
  }, [games, memberId])

  // Pagination logic - show all games, not just ones where member participated
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

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="text-muted-foreground">Loading member stats...</div>
        </div>
      </div>
    )
  }

  if (!group || !member) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">Member not found.</p>
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
          <h1 className="text-4xl font-bold tracking-tight">{member.userName}'s Stats</h1>
          <p className="text-muted-foreground">
            Statistics for {member.userName} in {group.name}
          </p>
        </div>

        {/* Statistics / Games section */}
        {games.length > 0 && (
          <>
            <OverallStats games={games} userId={memberId} totalGamesInGroup={games.length} />

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
                    userId={memberId}
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
                        <CardDescription>Click on a game to view or join</CardDescription>
                      </div>
                    </div>
                  </CardHeader>
                  <CardContent className="flex-1 overflow-y-auto pt-0 pb-2">
                    {games.length > 0 ? (
                      <>
                        <div className="space-y-2">
                          {paginatedGames.map((game) => {
                            const playerCount = game.sessions.length
                            const memberSession = game.sessions.find(s => s.userId === memberId)
                            const memberProfit = memberSession?.profit ?? null
                            const memberJoined = !!memberSession
                            
                            return (
                              <div key={game.id} className="relative group">
                                <Link href={`/games/${game.id}?from=group&groupId=${groupId}`}>
                                  <div className="flex items-center justify-between gap-2 p-2 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                                    <div className="flex-1 min-w-0">
                                      <div className="flex items-center gap-2 flex-wrap">
                                        <p className="font-medium text-sm truncate">
                                          {format(new Date(game.date), 'MMM dd, yyyy')}
                                        </p>
                                        {memberJoined && (
                                          <span className="text-xs px-1.5 py-0.5 bg-primary/10 text-primary rounded-full whitespace-nowrap">
                                            Joined
                                          </span>
                                        )}
                                      </div>
                                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-1">
                                        {playerCount} player{playerCount !== 1 ? 's' : ''}
                                        {game.notes && ` • ${game.notes}`}
                                      </p>
                                    </div>
                                    <div className="flex items-center gap-2 flex-shrink-0">
                                      {memberProfit !== null && (
                                        <p className={`font-semibold text-sm whitespace-nowrap ${memberProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                          {memberProfit >= 0 ? '+' : ''}${memberProfit.toFixed(2)}
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
                      <div className="flex flex-col items-center justify-center py-12 text-center">
                        <p className="text-lg font-medium mb-2">No games yet</p>
                        <p className="text-muted-foreground">
                          No games in this group yet.
                        </p>
                      </div>
                    )}
                  </CardContent>
                </Card>
              </div>
            </div>

            <Leaderboard games={games} groupId={groupId} userId={memberId} groupMembers={group?.members} />
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

