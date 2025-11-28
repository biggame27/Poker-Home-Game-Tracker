'use client'

import { useState, useEffect } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Leaderboard } from '@/components/Leaderboard'
import { RunningTotalsChart } from '@/components/RunningTotalsChart'
import { OverallStats } from '@/components/OverallStats'
import { getGroupById, getGamesByGroup, deleteGame } from '@/lib/supabase/storage'
import type { Group, Game } from '@/types'
import { Users, PlusCircle, Copy, Check, X, Trash2 } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { toast } from 'sonner'

export default function GroupDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const groupId = params.groupId as string
  const [group, setGroup] = useState<Group | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [copied, setCopied] = useState(false)
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null)

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

  const copyInviteCode = () => {
    if (group?.inviteCode) {
      navigator.clipboard.writeText(group.inviteCode)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }

  const handleDeleteGame = async (gameId: string, e: React.MouseEvent) => {
    e.preventDefault()
    e.stopPropagation()
    
    toast('Are you sure you want to delete this game?', {
      description: 'This action cannot be undone.',
      action: {
        label: 'Delete',
        onClick: async () => {
          setDeletingGameId(gameId)
          try {
            const success = await deleteGame(gameId)
            if (success) {
              toast.success('Game deleted successfully')
              // Reload games list
              await loadData()
            } else {
              toast.error('Failed to delete game. Please try again.')
            }
          } catch (error) {
            console.error('Error deleting game:', error)
            toast.error('An error occurred while deleting the game.')
          } finally {
            setDeletingGameId(null)
          }
        },
        className: 'sonner-action-delete',
      },
      cancel: {
        label: 'Cancel',
        onClick: () => {},
      },
    })
    
    // Add class to delete button after toast is rendered
    setTimeout(() => {
      const toastElements = document.querySelectorAll('[data-sonner-toast]')
      const latestToast = toastElements[toastElements.length - 1]
      if (latestToast) {
        const actionButtons = latestToast.querySelectorAll('[data-button][data-sonner-action], button[data-sonner-action]')
        actionButtons.forEach((button) => {
          if (button.textContent?.trim() === 'Delete') {
            button.classList.add('sonner-action-delete')
          }
        })
      }
    }, 100)
  }

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
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-lg font-medium mb-2">Group not found</p>
                <p className="text-muted-foreground mb-4">
                  This group doesn't exist or you don't have access to it.
                </p>
                <Link href="/groups">
                  <Button>Back to Groups</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const isOwner = group.createdBy === user?.id
  const isMember = group.members.some(m => m.userId === user?.id)

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-start justify-between">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">{group.name}</h1>
              {group.description && (
                <p className="text-muted-foreground">{group.description}</p>
              )}
            </div>
            <Link href="/games/new">
              <Button className="gap-2">
                <PlusCircle className="h-4 w-4" />
                New Game
              </Button>
            </Link>
          </div>

          {/* Group Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">Members</span>
                </div>
                <p className="text-2xl font-bold">{group.members.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <span className="text-sm">Games</span>
                </div>
                <p className="text-2xl font-bold">{games.length}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="flex items-center gap-2 text-muted-foreground mb-2">
                      <span className="text-sm">Invite Code</span>
                    </div>
                    <p className="text-2xl font-bold font-mono">{group.inviteCode}</p>
                  </div>
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={copyInviteCode}
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
                        Copy
                      </>
                    )}
                  </Button>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Members List */}
        <Card>
          <CardHeader>
            <CardTitle>Members</CardTitle>
            <CardDescription>People in this group</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {group.members.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <div>
                    <p className="font-medium">{member.userName}</p>
                    <p className="text-sm text-muted-foreground">
                      Joined {format(new Date(member.joinedAt), 'MMM dd, yyyy')}
                    </p>
                  </div>
                  {member.role === 'owner' && (
                    <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                      Owner
                    </span>
                  )}
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        {/* Games List */}
        <Card>
          <CardHeader>
            <div className="flex items-center justify-between">
              <div>
                <CardTitle>Games</CardTitle>
                <CardDescription>Click on a game to view or join</CardDescription>
              </div>
              <Link href={`/games/new?groupId=${groupId}`}>
                <Button size="sm" className="gap-2">
                  <PlusCircle className="h-4 w-4" />
                  New Game
                </Button>
              </Link>
            </div>
          </CardHeader>
          <CardContent>
            {games.length > 0 ? (
              <div className="space-y-3">
                {games.map((game) => {
                  const playerCount = game.sessions.length
                  const totalSum = game.sessions.reduce((sum, s) => sum + (s.profit || 0), 0)
                  const isBalanced = Math.abs(totalSum) < 0.01 // Allow small floating point errors
                  const userJoined = game.sessions.some(s => s.userId === user?.id)
                  
                  return (
                    <div key={game.id} className="relative group">
                      <Link href={`/games/${game.id}`}>
                        <div className="flex items-center justify-between p-4 border rounded-lg hover:bg-muted/50 transition-colors cursor-pointer">
                          <div className="flex-1">
                            <div className="flex items-center gap-3">
                              <p className="font-medium">
                                {format(new Date(game.date), 'MMMM dd, yyyy')}
                              </p>
                              {userJoined && (
                                <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                                  Joined
                                </span>
                              )}
                              {game.status === 'open' && (
                                <span className="text-xs px-2 py-1 bg-green-500/10 text-green-600 rounded-full">
                                  Open
                                </span>
                              )}
                            </div>
                            <p className="text-sm text-muted-foreground mt-1">
                              {playerCount} player{playerCount !== 1 ? 's' : ''} • {game.notes || 'No notes'}
                            </p>
                          </div>
                          <div className="flex items-center gap-4">
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
                            {isOwner && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="opacity-0 group-hover:opacity-100 transition-all h-8 w-8 p-0 text-destructive hover:text-destructive hover:bg-destructive/10 rounded-md shadow-sm hover:shadow-md"
                                onClick={(e) => handleDeleteGame(game.id, e)}
                                disabled={deletingGameId === game.id}
                                title="Delete game"
                              >
                                {deletingGameId === game.id ? (
                                  <div className="h-4 w-4 border-2 border-destructive border-t-transparent rounded-full animate-spin" />
                                ) : (
                                  <Trash2 className="h-4 w-4" />
                                )}
                              </Button>
                            )}
                          </div>
                        </div>
                      </Link>
                    </div>
                  )
                })}
              </div>
            ) : (
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <PlusCircle className="h-12 w-12 text-muted-foreground mb-4" />
                <p className="text-lg font-medium mb-2">No games yet</p>
                <p className="text-muted-foreground mb-6">
                  Create your first game to get started!
                </p>
                <Link href={`/games/new?groupId=${groupId}`}>
                  <Button className="gap-2">
                    <PlusCircle className="h-4 w-4" />
                    Create First Game
                  </Button>
                </Link>
              </div>
            )}
          </CardContent>
        </Card>

        {/* Statistics */}
        {games.length > 0 && (
          <>
            <OverallStats games={games} userId={user?.id} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RunningTotalsChart 
                games={games} 
                cumulative={false}
                title="Running Totals by Date"
                description="Profit/loss per game date"
                userId={user?.id}
              />
              <RunningTotalsChart 
                games={games} 
                cumulative={true}
                title="Overall Running Total"
                description="Cumulative profit/loss over time"
                userId={user?.id}
              />
            </div>

            <Leaderboard games={games} />
          </>
        )}
      </div>
    </div>
  )
}

