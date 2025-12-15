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

export default function MemberStatsPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const groupId = params.groupId as string
  const memberId = params.memberId as string
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

  // Find the member
  const member = useMemo(() => {
    if (!group) return null
    return group.members.find(m => m.userId === memberId)
  }, [group, memberId])

  // Filter games to only include ones where this member participated
  const memberGames = useMemo(() => {
    if (!memberId) return []
    return games.filter(game => 
      game.sessions.some(session => session.userId === memberId)
    )
  }, [games, memberId])

  // Pagination logic
  const gamesPerPage = 5
  const totalPages = useMemo(() => Math.ceil(memberGames.length / gamesPerPage), [memberGames.length])
  
  useEffect(() => {
    if (memberGames.length > 0 && currentPage > totalPages) {
      setCurrentPage(1)
    }
  }, [memberGames.length, currentPage, totalPages])

  const startIndex = (currentPage - 1) * gamesPerPage
  const endIndex = startIndex + gamesPerPage
  const paginatedGames = memberGames.slice(startIndex, endIndex)

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
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

        {/* Overall Stats */}
        {memberGames.length > 0 && (
          <>
            <OverallStats games={games} userId={memberId} totalGamesInGroup={games.length} />

            {/* Running Totals Chart */}
            <RunningTotalsChart 
              games={memberGames} 
              cumulative={true}
              title="Overall Running Total"
              description="Cumulative profit/loss over time"
              userId={memberId}
            />

            {/* Games List */}
            <Card>
              <CardHeader>
                <CardTitle>Games Played</CardTitle>
                <CardDescription>
                  {memberGames.length} game{memberGames.length !== 1 ? 's' : ''} total
                </CardDescription>
              </CardHeader>
              <CardContent>
                {paginatedGames.length > 0 ? (
                  <>
                    <div className="space-y-3">
                      {paginatedGames.map((game) => {
                        const memberSession = game.sessions.find(s => s.userId === memberId)
                        const profit = memberSession?.profit ?? (memberSession ? memberSession.endAmount - memberSession.buyIn : 0)
                        
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
                                  <span
                                    className={`text-sm font-semibold ${
                                      profit >= 0
                                        ? 'text-green-600'
                                        : 'text-red-600'
                                    }`}
                                  >
                                    {profit >= 0 ? '+' : ''}${profit.toFixed(2)}
                                  </span>
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
                          <ArrowLeft className="h-4 w-4" />
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

        {memberGames.length === 0 && (
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground text-center">
                {member.userName} hasn't participated in any games yet.
              </p>
            </CardContent>
          </Card>
        )}
      </div>
    </div>
  )
}

