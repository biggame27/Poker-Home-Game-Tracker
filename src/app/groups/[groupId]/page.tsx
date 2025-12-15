'use client'

import { useState, useEffect, useMemo } from 'react'
import { useParams, useRouter } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Leaderboard } from '@/components/Leaderboard'
import { RunningTotalsChart } from '@/components/RunningTotalsChart'
import { OverallStats } from '@/components/OverallStats'
import { getGroupById, getGamesByGroup, deleteGame, deleteGroup, updateGroup, addGuestMember, removeGroupMember, removeGuestFromGroupSessions, getClaimRequests, submitClaimRequest, approveClaimRequest, denyClaimRequest, promoteToAdmin, demoteFromAdmin } from '@/lib/supabase/storage'
import type { Group, Game } from '@/types'
import { Users, PlusCircle, Copy, Check, X, Trash2, EllipsisVertical, ChevronLeft, ChevronRight } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

export default function GroupDetailPage() {
  const params = useParams()
  const router = useRouter()
  const { user, isLoaded } = useUser()
  const groupId = params.groupId as string
  const [group, setGroup] = useState<Group | null>(null)
  const [games, setGames] = useState<Game[]>([])
  const [copied, setCopied] = useState(false)
  const [deletingGameId, setDeletingGameId] = useState<string | null>(null)
  const [notification, setNotification] = useState<{ type: 'error'; message: string } | null>(null)
  const [confirmingGameId, setConfirmingGameId] = useState<string | null>(null)
  const [deletingGroup, setDeletingGroup] = useState(false)
  const [groupMenuOpen, setGroupMenuOpen] = useState(false)
  const [addingGuest, setAddingGuest] = useState(false)
  const [claimRequests, setClaimRequests] = useState<{ id: string; guestName: string; requesterId: string; requesterEmail?: string; status: 'pending' | 'approved' }[]>([])
  const [currentPage, setCurrentPage] = useState(1)

  // Pagination logic
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
        const claims = await getClaimRequests(groupId)
        setClaimRequests(claims)
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

    setConfirmingGameId(gameId)
  }

  const confirmDelete = async () => {
    if (!confirmingGameId) return
    setDeletingGameId(confirmingGameId)
    try {
      const success = await deleteGame(confirmingGameId)
      if (success) {
        await loadData()
      } else {
        setNotification({ type: 'error', message: 'Failed to delete game. Please try again.' })
      }
    } catch (error) {
      console.error('Error deleting game:', error)
      setNotification({ type: 'error', message: 'An error occurred while deleting the game.' })
    } finally {
      setDeletingGameId(null)
      setConfirmingGameId(null)
    }
  }

  const handleDeleteGroup = async () => {
    if (!group || !user?.id) return
    setGroupMenuOpen(false)
    
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm('Delete this group and all its games? This cannot be undone.')

    if (!confirmed) return

    setDeletingGroup(true)
    try {
      const success = await deleteGroup(group.id, user.id)
      if (success) {
        router.push('/groups')
      } else {
        setNotification({ type: 'error', message: 'Failed to delete group. Please try again.' })
        setDeletingGroup(false)
      }
    } catch (error) {
      console.error('Error deleting group:', error)
      setNotification({ type: 'error', message: 'An error occurred while deleting the group.' })
      setDeletingGroup(false)
    }
  }

  const handleRenameGroup = async () => {
    if (!group || !user?.id) return
    const newName = typeof window !== 'undefined'
      ? window.prompt('Rename group to:', group.name)
      : null

    if (!newName || newName.trim() === '' || newName === group.name) {
      setGroupMenuOpen(false)
      return
    }

    const updated = await updateGroup({
      ...group,
      name: newName.trim(),
    })

    if (updated) {
      setGroup(prev => prev ? { ...prev, name: newName.trim() } : prev)
    } else {
      setNotification({ type: 'error', message: 'Failed to rename group. Please try again.' })
    }
    setGroupMenuOpen(false)
  }

  const handleKickMember = async (memberId: string) => {
    if (!group || !user?.id) return
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm('Remove this member from the group? They will lose access.')

    if (!confirmed) return

    const success = await removeGroupMember(group.id, memberId, user.id)
    if (success) {
      setGroup(prev => prev ? { ...prev, members: prev.members.filter(m => m.userId !== memberId) } : prev)
    } else {
      setNotification({ type: 'error', message: 'Failed to remove member.' })
    }
  }

  const handleAddGuest = async () => {
    if (!group || !isOwner) return
    const guestName = typeof window !== 'undefined'
      ? window.prompt('Guest name to save for this group?')
      : null

    if (!guestName || guestName.trim() === '') return
    const trimmed = guestName.trim()
    const duplicateGuest = (group.members || []).some(
      m => m.userId?.startsWith('guest-') && (m.userName || '').toLowerCase() === trimmed.toLowerCase()
    )
    if (duplicateGuest) {
      const proceed = typeof window === 'undefined'
        ? true
        : window.confirm('Are you sure you want to add another guest with the same name?')
      if (!proceed) return
    }

    setAddingGuest(true)
    try {
      const added = await addGuestMember(group.id, trimmed)
      if (added) {
        await loadData()
      } else {
        setNotification({ type: 'error', message: 'Failed to add guest. Please try again.' })
      }
    } catch (error) {
      console.error('Error adding guest:', error)
      setNotification({ type: 'error', message: 'An error occurred while adding the guest.' })
    } finally {
      setAddingGuest(false)
    }
  }

  const handleRemoveGuestFromGames = async (guestName: string) => {
    if (!group || !user?.id) return
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(`Remove guest "${guestName}" from this group's games?`)
    if (!confirmed) return

    const success = await removeGuestFromGroupSessions(group.id, guestName)
    if (success) {
      await loadData()
    } else {
      setNotification({ type: 'error', message: 'Failed to remove guest.' })
    }
  }

  const handleSubmitClaim = async (guestName: string) => {
    if (!group || !user?.id) return
    const userEmail = user.primaryEmailAddress?.emailAddress || user.emailAddresses?.[0]?.emailAddress || undefined
    const res = await submitClaimRequest(group.id, guestName, user.id, userEmail)
    if (res) {
      setClaimRequests(prev => {
        const without = prev.filter(r => !(r.guestName.toLowerCase() === res.guestName.toLowerCase() && r.requesterId === res.requesterId))
        return [...without, res]
      })
      setNotification({ type: 'error', message: 'Claim submitted. Waiting for owner approval.' })
    } else {
      setNotification({ type: 'error', message: 'Failed to submit claim.' })
    }
  }

  const handleApproveClaim = async (requestId: string) => {
    if (!user?.id) return
    const success = await approveClaimRequest(requestId, user.id)
    if (success) {
      await loadData()
    } else {
      setNotification({ type: 'error', message: 'Failed to approve claim.' })
    }
  }

  const handleDenyClaim = async (requestId: string) => {
    if (!user?.id) return
    const success = await denyClaimRequest(requestId, user.id)
    if (success) {
      // Remove the denied claim from state immediately
      setClaimRequests(prev => prev.filter(r => r.id !== requestId))
      await loadData()
    } else {
      setNotification({ type: 'error', message: 'Failed to deny claim.' })
    }
  }

  const handlePromoteToAdmin = async (memberId: string) => {
    if (!group || !user?.id) return
    const success = await promoteToAdmin(group.id, memberId, user.id)
    if (success) {
      // Optimistically update the UI
      setGroup(prev => prev ? {
        ...prev,
        members: prev.members.map(m => 
          m.userId === memberId ? { ...m, role: 'admin' as const } : m
        )
      } : prev)
      await loadData()
    } else {
      setNotification({ type: 'error', message: 'Failed to promote member.' })
    }
  }

  const handleDemoteFromAdmin = async (memberId: string) => {
    if (!group || !user?.id) return
    const success = await demoteFromAdmin(group.id, memberId, user.id)
    if (success) {
      // Optimistically update the UI
      setGroup(prev => prev ? {
        ...prev,
        members: prev.members.map(m => 
          m.userId === memberId ? { ...m, role: 'member' as const } : m
        )
      } : prev)
      await loadData()
    } else {
      setNotification({ type: 'error', message: 'Failed to demote admin.' })
    }
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
  const isAdmin = group.members.some(m => m.userId === user?.id && m.role === 'admin')
  const isOwnerOrAdmin = isOwner || isAdmin
  const isMember = group.members.some(m => m.userId === user?.id)
  const savedGuests = group.members.filter(m => m.userId?.startsWith('guest-'))
  const regularMembers = group.members.filter(m => !m.userId?.startsWith('guest-'))
  const guestParticipants = Array.from(
    new Map(
      games
        .flatMap(g =>
          g.sessions
            .filter(s => (s as any).role === 'guest')
            .map(s => [s.playerName.toLowerCase(), { name: s.playerName, userId: s.userId }])
        )
    ).values()
  )
  const extraGuestParticipants = guestParticipants.filter(
    gp => !savedGuests.some(g => g.userName.toLowerCase() === gp.name.toLowerCase())
  )
  const myClaimedGuests = claimRequests.filter(r => r.requesterId === user?.id)
  const totalMemberDisplay = regularMembers.length + savedGuests.length + extraGuestParticipants.length

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        {notification && (
          <div
            className="flex items-center justify-between border rounded-lg px-4 py-3 bg-red-50 border-red-200 text-red-700"
          >
            <span>{notification.message}</span>
            <button
              type="button"
              className="text-sm underline"
              onClick={() => setNotification(null)}
            >
              Dismiss
            </button>
          </div>
        )}

        {confirmingGameId && (
          <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/40 px-4">
            <div className="w-full max-w-md rounded-lg border bg-background p-6 shadow-lg">
              <h3 className="text-lg font-semibold mb-2">Delete game?</h3>
              <p className="text-sm text-muted-foreground mb-4">
                This action cannot be undone. Are you sure you want to delete this game?
              </p>
              <div className="flex justify-end gap-3">
                <Button
                  variant="outline"
                  onClick={() => setConfirmingGameId(null)}
                  disabled={deletingGameId !== null}
                >
                  Cancel
                </Button>
                <Button
                  variant="destructive"
                  onClick={confirmDelete}
                  disabled={deletingGameId !== null}
                  className="min-w-[100px]"
                >
                  {deletingGameId ? 'Deleting...' : 'Delete'}
                </Button>
              </div>
            </div>
          </div>
        )}

        {/* Header */}
        <div className="space-y-4">
          <div className="flex items-start justify-between relative">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">{group.name}</h1>
              {group.description && (
                <p className="text-muted-foreground">{group.description}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {isOwner && (
                <div className="relative">
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setGroupMenuOpen(prev => !prev)}
                    disabled={deletingGroup}
                    aria-label="Group actions"
                    className="h-9 w-9"
                  >
                    <EllipsisVertical className="h-4 w-4" />
                  </Button>
                  {groupMenuOpen && (
                    <div className="absolute right-0 mt-2 w-48 rounded-md border bg-background shadow-lg z-20">
                      <button
                        className="w-full text-left px-3 py-2 text-sm hover:bg-muted"
                        onClick={handleRenameGroup}
                      >
                        Rename Group
                      </button>
                      <button
                        className="w-full text-left px-3 py-2 text-sm text-red-600 hover:bg-muted"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleDeleteGroup()
                        }}
                        disabled={deletingGroup}
                      >
                        {deletingGroup ? 'Deleting...' : 'Delete Group'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>

          {/* Group Info */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">Members</span>
                </div>
                <p className="text-2xl font-bold">{totalMemberDisplay}</p>
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
          <CardHeader className="flex flex-row items-start justify-between">
            <div>
              <CardTitle>Members</CardTitle>
              <CardDescription>People in this group</CardDescription>
            </div>
            {isOwner && (
              <Button size="sm" variant="outline" onClick={handleAddGuest} disabled={addingGuest}>
                {addingGuest ? 'Saving...' : 'Add guest'}
              </Button>
            )}
          </CardHeader>
          <CardContent className="space-y-6">
            {isOwnerOrAdmin && claimRequests.filter(r => r.status === 'pending').length > 0 && (
              <div className="rounded-lg border p-3 bg-muted/50 space-y-2">
                <p className="text-sm font-semibold">Pending guest claims</p>
                <div className="space-y-2">
                  {claimRequests.filter(r => r.status === 'pending').map(r => (
                    <div key={r.id} className="flex items-center justify-between rounded-md border bg-background px-3 py-2">
                      <div>
                        <p className="font-medium">{r.guestName}</p>
                        <p className="text-xs text-muted-foreground">Requested by {r.requesterEmail || 'User'}</p>
                      </div>
                      <div className="flex items-center gap-2">
                        <Button size="sm" variant="outline" onClick={() => handleDenyClaim(r.id)}>
                          Deny
                        </Button>
                        <Button size="sm" onClick={() => handleApproveClaim(r.id)}>
                          Approve
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
            <div className="space-y-2">
              <p className="text-sm font-semibold text-muted-foreground">Members</p>
              {regularMembers.length === 0 && (
                <p className="text-sm text-muted-foreground">No members yet.</p>
              )}
              {regularMembers.map((member) => (
                <div
                  key={member.userId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <Link href={`/groups/${groupId}/members/${member.userId}`} className="flex-1 hover:opacity-80 transition-opacity">
                    <div>
                      <p className="font-medium">{member.userName}</p>
                      <p className="text-sm text-muted-foreground">
                        Joined {format(new Date(member.joinedAt), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2">
                    {member.role === 'owner' && (
                      <span className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-full">
                        Owner
                      </span>
                    )}
                    {member.role === 'admin' && (
                      <span className="text-xs px-2 py-1 bg-blue-500/10 text-blue-600 rounded-full">
                        Admin
                      </span>
                    )}
                    {isOwner && member.role !== 'owner' && (
                      <>
                        {member.role === 'admin' ? (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handleDemoteFromAdmin(member.userId)
                            }}
                            aria-label="Demote from admin"
                          >
                            Demote
                          </Button>
                        ) : (
                          <Button
                            type="button"
                            size="sm"
                            variant="outline"
                            onClick={(e) => {
                              e.preventDefault()
                              e.stopPropagation()
                              handlePromoteToAdmin(member.userId)
                            }}
                            aria-label="Promote to admin"
                          >
                            Promote
                          </Button>
                        )}
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleKickMember(member.userId)
                          }}
                          aria-label="Remove member"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </>
                    )}
                  </div>
                </div>
              ))}
            </div>

            <div className="space-y-2">
              <div className="flex items-center gap-2">
                <p className="text-sm font-semibold text-muted-foreground">Guests</p>
                <span className="text-xs px-2 py-0.5 rounded-full bg-muted text-muted-foreground">
                  Saved + recent
                </span>
              </div>
              {savedGuests.length === 0 && extraGuestParticipants.length === 0 && (
                <p className="text-sm text-muted-foreground">No guests yet.</p>
              )}
              {savedGuests.map((guest) => (
                <div
                  key={guest.userId}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <Link href={`/groups/${groupId}/guests/${encodeURIComponent(guest.userName)}`} className="flex-1 hover:opacity-80 transition-opacity cursor-pointer">
                    <div>
                      <p className="font-medium">{guest.userName}</p>
                      <p className="text-sm text-muted-foreground">
                        Saved guest · Joined {format(new Date(guest.joinedAt), 'MMM dd, yyyy')}
                      </p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs px-2 py-1 bg-blue-50 text-blue-700 rounded-full border border-blue-200">
                      Guest
                    </span>
                    {user && !isMember && (
                      (() => {
                        const mine = claimRequests.find(
                          r => r.guestName.toLowerCase() === guest.userName.toLowerCase() && r.requesterId === user.id
                        )
                        if (mine?.status === 'pending') {
                          return <span className="text-xs text-muted-foreground">Claim pending</span>
                        }
                        return (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSubmitClaim(guest.userName)}
                          >
                            Claim
                          </Button>
                        )
                      })()
                    )}
                    {isOwner && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleKickMember(guest.userId)
                        }}
                        aria-label="Remove guest"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
                </div>
              ))}
              {extraGuestParticipants.map((guest) => (
                <div
                  key={`guest-${guest.userId || guest.name}`}
                  className="flex items-center justify-between p-3 border rounded-lg"
                >
                  <Link href={`/groups/${groupId}/guests/${encodeURIComponent(guest.name)}`} className="flex-1 hover:opacity-80 transition-opacity cursor-pointer">
                    <div>
                      <p className="font-medium">{guest.name}</p>
                      <p className="text-sm text-muted-foreground">Guest from games</p>
                    </div>
                  </Link>
                  <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                    <span className="text-xs px-2 py-1 bg-muted text-muted-foreground rounded-full">
                      Guest
                    </span>
                    {user && !isMember && (
                      (() => {
                        const mine = claimRequests.find(
                          r => r.guestName.toLowerCase() === guest.name.toLowerCase() && r.requesterId === user.id
                        )
                        if (mine?.status === 'pending') {
                          return <span className="text-xs text-muted-foreground">Claim pending</span>
                        }
                        return (
                          <Button
                            size="sm"
                            variant="outline"
                            onClick={() => handleSubmitClaim(guest.name)}
                          >
                            Claim
                          </Button>
                        )
                      })()
                    )}
                    {isOwner && (
                      <Button
                        size="icon"
                        variant="ghost"
                        className="text-destructive hover:text-destructive"
                        onClick={(e) => {
                          e.preventDefault()
                          e.stopPropagation()
                          handleRemoveGuestFromGames(guest.name)
                        }}
                        aria-label="Remove guest from games"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    )}
                  </div>
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
              <>
                <div className="space-y-3">
                  {paginatedGames.map((game) => {
                  const playerCount = game.sessions.length
                  const totalSum = game.sessions.reduce((sum, s) => sum + (s.profit || 0), 0)
                  const isBalanced = Math.abs(totalSum) < 0.01 // Allow small floating point errors
                  const userJoined = game.sessions.some(s => s.userId === user?.id)
                  
                  return (
                    <div key={game.id} className="relative group">
                      <Link href={`/games/${game.id}?from=group&groupId=${groupId}`}>
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
            <OverallStats games={games} userId={user?.id} totalGamesInGroup={games.length} />

            <RunningTotalsChart 
              games={games} 
              cumulative={true}
              title="Overall Running Total"
              description="Cumulative profit/loss over time"
              userId={user?.id}
            />

            <Leaderboard games={games} />
          </>
        )}
      </div>
    </div>
  )
}

