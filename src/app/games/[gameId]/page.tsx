'use client'

import { useState, useEffect, Suspense } from 'react'
import { useParams, useRouter, useSearchParams } from 'next/navigation'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select'
import { JoinGameForm } from '@/components/JoinGameForm'
import { Leaderboard } from '@/components/Leaderboard'
import { addGuestMember, getGameById, getGroupById, removeGameSession, updateGameSession, removeGameParticipantAsAdmin } from '@/lib/supabase/storage'
import type { Game, Group, GameSession } from '@/types'
import { Users, ArrowLeft, Copy, Check, UserPlus, LogOut } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'

function GameDetailContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoaded } = useUser()
  const gameId = params.gameId as string
  const [game, setGame] = useState<Game | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [copied, setCopied] = useState(false)
  const [editingSessions, setEditingSessions] = useState<{
    playerName: string
    buyIn: string
    endAmount: string
    userId?: string
  }[]>([])
  const [savingIndex, setSavingIndex] = useState<number | null>(null)
  const [participantUpdating, setParticipantUpdating] = useState(false)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [addMemberMode, setAddMemberMode] = useState<'group' | 'guest'>('group')
  const [selectedGroupMemberId, setSelectedGroupMemberId] = useState<string>('')
  const [memberSearch, setMemberSearch] = useState('')
  const [memberListOpen, setMemberListOpen] = useState(false)
  const [memberName, setMemberName] = useState('')
  const [memberSaving, setMemberSaving] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState<{ userId: string; userName: string }[]>([])

  // Get the referrer from query params
  const from = searchParams.get('from') || null
  const groupId = searchParams.get('groupId') || null

  useEffect(() => {
    if (gameId) {
      loadData()
    }
  }, [gameId])

  const loadData = async () => {
    if (!gameId) return
    try {
      const foundGame = await getGameById(gameId)
      if (foundGame) {
        setGame(foundGame)
        const foundGroup = await getGroupById(foundGame.groupId)
        setGroup(foundGroup)

        setEditingSessions(
          (foundGame.sessions || []).map(s => ({
            playerName: s.playerName,
            buyIn: s.buyIn.toString(),
            endAmount: s.endAmount.toString(),
            userId: s.userId,
          }))
        )
      }
    } catch (error) {
      console.error('Error loading game data:', error)
    }
  }

  const refreshGame = async () => {
    if (!gameId) return
    try {
      const foundGame = await getGameById(gameId)
      if (foundGame) {
        setGame(foundGame)
        setEditingSessions(
          (foundGame.sessions || []).map(s => ({
            playerName: s.playerName,
            buyIn: s.buyIn.toString(),
            endAmount: s.endAmount.toString(),
            userId: s.userId,
          }))
        )
      }
    } catch (error) {
      console.error('Error refreshing game:', error)
    }
  }

  const handleOpenAddMember = () => {
    if (!game) return
    // Default to group mode if there are eligible members, otherwise guest
    const memberIdsInGame = new Set(game.sessions.map(s => s.userId).filter(Boolean) as string[])
    const eligibleMembers = (group?.members || []).filter(m => !memberIdsInGame.has(m.userId))
    const defaultToGuest = eligibleMembers.length === 0
    setAddMemberMode(defaultToGuest ? 'guest' : 'group')
    if (defaultToGuest) {
      setSelectedGroupMemberId('')
      setMemberSearch('')
      setMemberName('')
      setMemberListOpen(false)
      setSelectedMembers([])
    } else {
      setSelectedGroupMemberId(eligibleMembers[0].userId)
      setMemberSearch('')
      setMemberName(eligibleMembers[0].userName || '')
      setMemberListOpen(true)
      setSelectedMembers([])
    }
    setAddMemberOpen(true)
  }

  const handleKickParticipant = async (participantUserId: string | undefined | null, playerName: string) => {
    if (!game || !user?.id || !participantUserId) return
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm(`Remove ${playerName} from this game?`)
    if (!confirmed) return

    const success = await removeGameParticipantAsAdmin(game.id, participantUserId, user.id)
    if (success) {
      await refreshGame()
    } else {
      alert('Failed to remove participant.')
    }
  }

  const handleSelectMember = async (member: any, alreadyInGame: boolean) => {
    if (alreadyInGame) return
    if (member?._guestOnly && group) {
      const added = await addGuestMember(group.id, member.userName || 'Guest')
      if (!added) {
        alert('Failed to add guest. Please try again.')
        return
      }
      setGroup(prev => prev ? { ...prev, members: [...prev.members, added] } : prev)
      setSelectedMembers(prev => prev.some(m => m.userId === added.userId) ? prev : [...prev, { userId: added.userId, userName: added.userName }])
      setSelectedGroupMemberId(added.userId)
      const chosen = added.userName || 'Guest'
      setMemberName('')
      setMemberSearch('')
    } else {
      setSelectedMembers(prev => {
        if (prev.some(m => m.userId === member.userId)) return prev
        return [...prev, { userId: member.userId, userName: member.userName }]
      })
      setSelectedGroupMemberId(member.userId)
      setMemberName('')
      setMemberSearch('')
    }
    setMemberListOpen(false)
  }

  const handleSaveMember = async () => {
    if (!game || !group) return
    const memberIdsInGame = new Set(game.sessions.map(s => s.userId).filter(Boolean) as string[])
    const eligibleMembers = (group?.members || []).filter(m => !memberIdsInGame.has(m.userId))
    let userId: string | null = null
    let playerName = memberName.trim()
    let roleOverride: GameSession['role'] | undefined = undefined
    let isOneTime = false
    const nameLower = playerName.toLowerCase()
    const savedGuestMatch = (group.members || []).find(
      m => m.userId?.startsWith('guest-') && (m.userName || '').toLowerCase() === nameLower
    )
    const existingGuestSessionMatch = game.sessions.some(
      s =>
        (!s.userId || s.userId?.startsWith('guest-') || s.role === 'guest') &&
        (s.playerName || '').toLowerCase() === nameLower
    )

    if (addMemberMode === 'group') {
      if (selectedMembers.length === 0) {
        alert('Please select at least one player.')
        return
      }
    } else if (addMemberMode === 'guest') {
      if (!playerName) {
        alert('Please enter a guest name.')
        return
      }
      // If a guest with this name exists, confirm whether to add another; otherwise reuse existing
      if (savedGuestMatch || existingGuestSessionMatch) {
        const proceedNew = typeof window === 'undefined'
          ? true
          : window.confirm('A guest with this name already exists. Add another?')
        if (!proceedNew && savedGuestMatch) {
          userId = savedGuestMatch.userId
          playerName = savedGuestMatch.userName
          roleOverride = 'guest'
        } else if (!proceedNew) {
          return
        }
      }
      if (!userId) {
        const added = await addGuestMember(group.id, playerName)
        if (!added) {
          alert('Failed to add guest. Please try again.')
          return
        }
        userId = added.userId
        playerName = added.userName
        setGroup(prev => prev ? { ...prev, members: [...prev.members, added] } : prev)
      }
      roleOverride = 'guest'
    }

    const buyInAmount = 0
    const endAmount = 0

    setMemberSaving(true)
    try {
      if (addMemberMode === 'group') {
        for (const member of selectedMembers) {
          const ok = await updateGameSession(game.id, member.userId, member.userName, buyInAmount, endAmount, 'member')
          if (!ok) {
            alert(`Failed to add ${member.userName}. Make sure the game is not closed.`)
            setMemberSaving(false)
            return
          }
        }
      } else {
        const success = await updateGameSession(game.id, userId, playerName, buyInAmount, endAmount, roleOverride)
        if (!success) {
          alert('Failed to add member. Make sure the game is not closed.')
          return
        }
      }
      setAddMemberOpen(false)
      setSelectedMembers([])
      setMemberName('')
      setMemberSearch('')
      setSelectedGroupMemberId('')
      await refreshGame()
    } catch (error) {
      console.error('Error adding member:', error)
      alert('Failed to add member. Please try again.')
    } finally {
      setMemberSaving(false)
    }
  }

  const copyGameLink = () => {
    if (gameId) {
      const url = `${window.location.origin}/games/${gameId}`
      navigator.clipboard.writeText(url)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    }
  }


  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!game) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          <Card>
            <CardContent className="pt-6">
              <div className="flex flex-col items-center justify-center py-12 text-center">
                <p className="text-lg font-medium mb-2">Game not found</p>
                <p className="text-muted-foreground mb-4">
                  This game doesn't exist or you don't have access to it.
                </p>
                <Link href="/">
                  <Button>Back to Dashboard</Button>
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  const isHost = game.createdBy === user?.id
  const isGroupOwner = group
    ? group.createdBy === user?.id || group.members.some(m => m.userId === user?.id && m.role === 'owner')
    : false
  const isGroupAdmin = group?.members.some(m => m.userId === user?.id && m.role === 'admin') || false
  const isGroupMember = group?.members.some(m => m.userId === user?.id) || false
  const canAdminEdit = isHost || isGroupOwner || isGroupAdmin
  const isAlreadyJoined = game.sessions.some(s => s.userId === user?.id)
  const userSession = game.sessions.find(s => s.userId === user?.id)
  const totalPlayers = game.sessions.length
  const totalBuyIns = game.sessions.reduce((sum, s) => sum + (s.buyIn || 0), 0)
  const totalEndAmounts = game.sessions.reduce((sum, s) => sum + (s.endAmount || 0), 0)
  const totalProfit = totalEndAmounts - totalBuyIns
  const guestParticipants = Array.from(
    new Map(
      game.sessions
        .filter(s => (s as any).role === 'guest')
        .map(s => [s.playerName.toLowerCase(), { name: s.playerName }])
    ).values()
  )
  const canKick = canAdminEdit

  const handleQuickJoin = async (): Promise<boolean> => {
    if (!user?.id) {
      alert('You must be logged in to join this game.')
      return false
    }
    if (isAlreadyJoined) return false

    setParticipantUpdating(true)
    try {
      const playerName = user.fullName || user.emailAddresses?.[0]?.emailAddress || 'Player'
      const role = (!isGroupMember && !isGroupOwner) ? 'guest' : 'member'
      const success = await updateGameSession(game.id, user.id, playerName, 0, 0, role)
      if (!success) {
        alert('Failed to join game. Please try again.')
        return false
      }
      await refreshGame()
      return true
    } catch (error) {
      console.error('Error joining game:', error)
      alert('Failed to join game. Please try again.')
      return false
    } finally {
      setParticipantUpdating(false)
    }
  }

  const handleAddToDashboard = async () => {
    const joined = await handleQuickJoin()
    if (joined) {
      router.push('/')
    }
  }

  const handleQuickLeave = async () => {
    if (!user?.id) {
      alert('You must be logged in to leave this game.')
      return
    }
    if (!isAlreadyJoined) return

    setParticipantUpdating(true)
    try {
      const success = await removeGameSession(game.id, user.id)
      if (!success) {
        alert('Failed to leave game. Please try again.')
        return
      }
      await refreshGame()
    } catch (error) {
      console.error('Error leaving game:', error)
      alert('Failed to leave game. Please try again.')
    } finally {
      setParticipantUpdating(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        {/* Header */}
        <div className="space-y-4">
          {(from || group) && (
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-2"
                onClick={() => {
                  if (group) {
                    router.push(`/groups/${group.id}`)
                  } else if (from === 'group' && groupId) {
                    router.push(`/groups/${groupId}`)
                  } else if (from === 'dashboard') {
                    router.push('/')
                  } else {
                    router.push('/')
                  }
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back to Group
              </Button>
            </div>
          )}
          
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">
                Game - {format(new Date(game.date), 'MMMM dd, yyyy')}
              </h1>
              {group && (
                <Link href={`/groups/${group.id}`}>
                  <p className="text-muted-foreground hover:text-foreground transition-colors cursor-pointer inline-flex items-center gap-1">
                    <ArrowLeft className="h-3 w-3" />
                    Group: {group.name}
                  </p>
                </Link>
              )}
              {game.notes && (
                <p className="text-muted-foreground">{game.notes}</p>
              )}
            </div>
            <div className="flex items-center gap-2">
              {user && (
                <Button
                  size="sm"
                  className="gap-2"
                  onClick={isAlreadyJoined ? handleQuickLeave : handleQuickJoin}
                  disabled={participantUpdating}
                >
                  {isAlreadyJoined ? <LogOut className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                  {isAlreadyJoined
                      ? participantUpdating
                        ? 'Leaving...'
                        : 'Leave Game'
                      : participantUpdating
                        ? 'Joining...'
                        : 'Join Game'}
                </Button>
              )}
              {user && !isAlreadyJoined && (
                <Button
                  variant="outline"
                  size="sm"
                  className="gap-2"
                  onClick={handleAddToDashboard}
                  disabled={participantUpdating}
                >
                  Add to dashboard
                </Button>
              )}
              <Button
                variant="outline"
                size="sm"
                onClick={copyGameLink}
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
                    Copy Link
                  </>
                )}
              </Button>
            </div>
          </div>

          {/* Game Stats */}
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <Users className="h-4 w-4" />
                  <span className="text-sm">Players</span>
                </div>
                <p className="text-2xl font-bold">{totalPlayers}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <span className="text-sm">Total Buy-Ins</span>
                </div>
                <p className="text-2xl font-bold">${totalBuyIns.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <span className="text-sm">Total End Amounts</span>
                </div>
                <p className="text-2xl font-bold">${totalEndAmounts.toFixed(2)}</p>
              </CardContent>
            </Card>
            <Card>
              <CardContent className="pt-6">
                <div className="flex items-center gap-2 text-muted-foreground mb-2">
                  <span className="text-sm">Net Profit</span>
                </div>
                <p className={`text-2xl font-bold ${
                  totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${totalProfit.toFixed(2)}
                </p>
              </CardContent>
            </Card>
          </div>
        </div>

        {/* Admin Session Editor */}
        {canAdminEdit && (
          <Card>
            <CardHeader>
              <CardTitle>Manage Sessions</CardTitle>
              <CardDescription>
                Edit buy-ins and cash outs for all participants. Changes apply immediately.
              </CardDescription>
            </CardHeader>
            <CardContent>
              <div className="space-y-3">
                {editingSessions.map((session, index) => {
                  const original = game.sessions[index]
                  const profit =
                    (parseFloat(session.endAmount || '0') || 0) -
                    (parseFloat(session.buyIn || '0') || 0)

                  return (
                    <div
                      key={`${session.playerName}-${index}`}
                      className="flex flex-col md:flex-row md:items-end gap-3 border rounded-md p-3"
                    >
                      <div className="flex-1 space-y-1">
                        <Label className="text-xs text-muted-foreground">Player</Label>
                        <p className="text-sm font-medium">
                          {original?.playerName || session.playerName || 'Player'}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">Buy-In ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-32"
                          value={session.buyIn}
                          onChange={(e) => {
                            const value = e.target.value
                            setEditingSessions(prev => {
                              const next = [...prev]
                              next[index] = { ...next[index], buyIn: value }
                              return next
                            })
                          }}
                        />
                      </div>
                      <div className="space-y-1">
                        <Label className="text-xs text-muted-foreground">End Amount ($)</Label>
                        <Input
                          type="number"
                          step="0.01"
                          min="0"
                          className="w-32"
                          value={session.endAmount}
                          onChange={(e) => {
                            const value = e.target.value
                            setEditingSessions(prev => {
                              const next = [...prev]
                              next[index] = { ...next[index], endAmount: value }
                              return next
                            })
                          }}
                        />
                      </div>
                      <div className="space-y-1 md:ml-auto">
                        <Label className="text-xs text-muted-foreground">Profit/Loss</Label>
                        <p
                          className={`text-sm font-semibold ${
                            profit >= 0 ? 'text-green-600' : 'text-red-600'
                          }`}
                        >
                          {profit >= 0 ? '+' : '-'}${Math.abs(profit).toFixed(2)}
                        </p>
                      </div>
                      <div className="space-y-1">
                        <Button
                          size="sm"
                          className="mt-1"
                          disabled={savingIndex === index}
                          onClick={async () => {
                            if (!user?.id) return

                            const buyInAmount = parseFloat(session.buyIn) || 0
                            const endAmount = parseFloat(session.endAmount) || 0

                            setSavingIndex(index)
                            try {
                                const success = await updateGameSession(
                                  game.id,
                                  session.userId || null,
                                  original?.playerName || session.playerName || 'Player',
                                  buyInAmount,
                                  endAmount
                                )

                              if (!success) {
                                alert('Failed to update session. Make sure the game is open.')
                                return
                              }

                              await refreshGame()
                            } catch (error) {
                              console.error('Error updating session:', error)
                              alert('Failed to update session. Please try again.')
                            } finally {
                              setSavingIndex(null)
                            }
                          }}
                        >
                          {savingIndex === index ? 'Saving...' : 'Save'}
                        </Button>
                      </div>
                    </div>
                  )
                })}

                {editingSessions.length === 0 && (
                  <p className="text-sm text-muted-foreground">
                    No sessions to edit yet. Once players are added, you can manage them here.
                  </p>
                )}
              </div>
            </CardContent>
          </Card>
        )}

        {/* Participants (merged list in player format) */}
        {user && (
          <div id="join-game-section">
            <JoinGameForm 
              game={game}
              canAddMember={canAdminEdit}
              onAddMember={canAdminEdit ? handleOpenAddMember : undefined}
              canKick={canKick}
              onKickParticipant={(userId, playerName) => handleKickParticipant(userId, playerName)}
            />
          </div>
        )}

        {/* Leaderboard */}
        {game.sessions.length > 0 && (
          <Leaderboard games={[game]} singleGame={true} />
        )}
      </div>


      {addMemberOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-xl">
            <CardHeader>
              <CardTitle>Add Player</CardTitle>
              <CardDescription>
                Add a group member or a guest. Guests are saved without an account so they can claim their stats later.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="memberType">Player type</Label>
                <Select
                  value={addMemberMode}
                  onValueChange={(val: 'group' | 'guest') => {
                    if (val === 'group') {
                      const memberIdsInGame = new Set(game.sessions.map(s => s.userId).filter(Boolean) as string[])
                      const eligible = (group?.members || []).filter(m => !memberIdsInGame.has(m.userId))
                      setAddMemberMode('group')
                      setSelectedGroupMemberId(eligible[0]?.userId || '')
                      setMemberName(eligible[0]?.userName || '')
                      setMemberSearch('')
                      setSelectedMembers([])
                    } else {
                      setAddMemberMode('guest')
                      setSelectedGroupMemberId('')
                      setMemberName('')
                      setMemberSearch('')
                      setSelectedMembers([])
                    }
                  }}
                >
                  <SelectTrigger id="memberType" className="w-full">
                    <SelectValue placeholder="Choose member type" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="group">Existing player</SelectItem>
                    <SelectItem value="guest">Guest</SelectItem>
                  </SelectContent>
                </Select>
              </div>

              {addMemberMode === 'group' ? (
                <div className="space-y-3">
                  <div className="space-y-2">
                    <Label htmlFor="memberSearch">Search players</Label>
                    <Input
                      id="memberSearch"
                      placeholder="Search by name"
                      autoComplete="off"
                      value={memberSearch}
                      onChange={(e) => {
                        setMemberSearch(e.target.value)
                        setMemberListOpen(true)
                      }}
                      onFocus={() => setMemberListOpen(true)}
                      onBlur={() => setMemberListOpen(false)}
                    />
                    {addMemberMode === 'group' && selectedMembers.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {selectedMembers.map(m => (
                          <span
                            key={m.userId}
                            className="inline-flex items-center gap-1 rounded-full bg-muted px-2 py-1 text-xs"
                          >
                            {m.userName}
                            <button
                              type="button"
                              className="text-muted-foreground hover:text-destructive"
                              onClick={() =>
                                setSelectedMembers(prev => prev.filter(sel => sel.userId !== m.userId))
                              }
                              aria-label={`Remove ${m.userName}`}
                            >
                              ×
                            </button>
                          </span>
                        ))}
                      </div>
                    )}
                  </div>
                  {memberListOpen && (
                    <div className="space-y-1 max-h-48 overflow-y-auto rounded-md border p-2">
                      {(() => {
                        const baseMembers = group?.members || []
                          const guestOnlyMembers = guestParticipants
                            .filter(g =>
                              !baseMembers.some(m => (m.userName || '').toLowerCase() === (g.name || '').toLowerCase())
                            )
                            .map(g => ({
                            userId: '',
                            userName: g.name,
                            joinedAt: '',
                            role: 'member' as const,
                            _guestOnly: true,
                          }))

                        const merged = [...baseMembers, ...guestOnlyMembers]
                        const seen = new Set<string>()
                        const filtered = merged.filter(m => {
                          const key = (m.userName || 'Member').toLowerCase()
                          if (seen.has(key)) return false
                          seen.add(key)
                          return key.includes((memberSearch || '').toLowerCase())
                        })

                        if (filtered.length === 0) {
                          return <p className="text-xs text-muted-foreground px-1">No members match your search.</p>
                        }

                        return filtered.map(m => {
                          const alreadyInGame = game.sessions.some(s => s.userId === m.userId)
                          return (
                            <button
                              type="button"
                              key={m.userId}
                              className={`w-full text-left px-2 py-1.5 rounded-md border flex items-center justify-between text-sm ${
                                selectedMembers.some(sel => sel.userId === m.userId) ? 'border-primary text-primary' : 'border-muted'
                              } ${alreadyInGame ? 'opacity-50 cursor-not-allowed' : ''}`}
                              onMouseDown={(e) => {
                                e.preventDefault()
                                void handleSelectMember(m, alreadyInGame)
                              }}
                              disabled={alreadyInGame}
                            >
                              <span className="truncate">{m.userName || 'Member'}</span>
                              {alreadyInGame && (
                                <span className="text-[10px] uppercase tracking-wide rounded-full bg-muted text-muted-foreground px-2 py-0.5">
                                  Added
                                </span>
                              )}
                              {(m as any)._guestOnly && (
                                <span className="text-[10px] uppercase tracking-wide rounded-full bg-blue-50 text-blue-700 px-2 py-0.5 border border-blue-200">
                                  Guest
                                </span>
                              )}
                            </button>
                          )
                        })
                      })()}
                    </div>
                  )}
                </div>
              ) : (
                <div className="space-y-2">
                  <Label htmlFor="memberName">
                    Guest name
                  </Label>
                  <Input
                    id="memberName"
                    placeholder="Player name"
                    value={memberName}
                    onChange={(e) => setMemberName(e.target.value)}
                  />
                </div>
              )}

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button
                  variant="outline"
                  type="button"
                  onClick={() => {
                    setAddMemberOpen(false)
                    setSelectedMembers([])
                    setMemberName('')
                    setMemberSearch('')
                    setSelectedGroupMemberId('')
                  }}
                  disabled={memberSaving}
                >
                  Cancel
                </Button>
                <Button type="button" onClick={handleSaveMember} disabled={memberSaving}>
                  {memberSaving ? 'Adding...' : 'Add member'}
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  )
}

export default function GameDetailPage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <GameDetailContent />
    </Suspense>
  )
}

