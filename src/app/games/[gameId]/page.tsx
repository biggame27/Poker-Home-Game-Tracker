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
import { addGuestMember, getGameById, getGroupById, removeGameSession, updateGameStatus, updateGameSession, removeGameParticipantAsAdmin } from '@/lib/supabase/storage'
import type { Game, Group, GameSession } from '@/types'
import { Users, ArrowLeft, Copy, Check, Lock, Unlock, UserPlus, LogOut } from 'lucide-react'
import Link from 'next/link'
import { format } from 'date-fns'
import { Badge } from '@/components/ui/badge'

function GameDetailContent() {
  const params = useParams()
  const router = useRouter()
  const searchParams = useSearchParams()
  const { user, isLoaded } = useUser()
  const gameId = params.gameId as string
  const [game, setGame] = useState<Game | null>(null)
  const [group, setGroup] = useState<Group | null>(null)
  const [copied, setCopied] = useState(false)
  const [statusUpdating, setStatusUpdating] = useState(false)
  const [editingSessions, setEditingSessions] = useState<{
    playerName: string
    buyIn: string
    endAmount: string
    userId?: string
  }[]>([])
  const [savingIndex, setSavingIndex] = useState<number | null>(null)
  const [participantUpdating, setParticipantUpdating] = useState(false)
  const [payoutCompletedAt, setPayoutCompletedAt] = useState<string>('')
  const [payoutMethod, setPayoutMethod] = useState<string>('')
  const [payoutHandle, setPayoutHandle] = useState<string>('')
  const [sessionConfirmed, setSessionConfirmed] = useState(false)
  const [confirmDialogOpen, setConfirmDialogOpen] = useState(false)
  const [confirmMethod, setConfirmMethod] = useState<string>('')
  const [confirmPayoutTime, setConfirmPayoutTime] = useState<string>('')
  const [confirmHandle, setConfirmHandle] = useState<string>('')
  const [disputeDialogOpen, setDisputeDialogOpen] = useState(false)
  const [disputeBuyIn, setDisputeBuyIn] = useState<string>('')
  const [disputePayout, setDisputePayout] = useState<string>('')
  const [disputeNoticeOpen, setDisputeNoticeOpen] = useState(false)
  const [addMemberOpen, setAddMemberOpen] = useState(false)
  const [addMemberMode, setAddMemberMode] = useState<'group' | 'guest' | 'one-time'>('group')
  const [selectedGroupMemberId, setSelectedGroupMemberId] = useState<string>('')
  const [memberSearch, setMemberSearch] = useState('')
  const [memberListOpen, setMemberListOpen] = useState(false)
  const [memberName, setMemberName] = useState('')
  const [memberSaving, setMemberSaving] = useState(false)
  const [selectedMembers, setSelectedMembers] = useState<{ userId: string; userName: string }[]>([])

  const getNowLocal = () => {
    const now = new Date()
    now.setMinutes(now.getMinutes() - now.getTimezoneOffset())
    return now.toISOString().slice(0, 16)
  }

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

  useEffect(() => {
    if (!game || !user?.id) return
    const key = `payout-${game.id}-${user.id}`
    const stored = typeof window !== 'undefined' ? localStorage.getItem(key) : null
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        setPayoutCompletedAt(parsed.completedAt || '')
        setPayoutMethod(parsed.method || '')
        setPayoutHandle(parsed.handle || '')
        setSessionConfirmed(Boolean(parsed.confirmed))
        setConfirmMethod(parsed.method || '')
        setConfirmPayoutTime(parsed.completedAt || '')
        setConfirmHandle(parsed.handle || '')
      } catch {
        setPayoutCompletedAt(stored)
        setPayoutMethod('')
        setPayoutHandle('')
        setSessionConfirmed(false)
        setConfirmMethod('')
        setConfirmPayoutTime('')
        setConfirmHandle('')
      }
    } else {
      const nowLocal = getNowLocal()
      setPayoutCompletedAt(nowLocal)
      setPayoutMethod('')
      setPayoutHandle('')
      setSessionConfirmed(false)
      setConfirmMethod('')
      setConfirmPayoutTime(nowLocal)
      setConfirmHandle('')
    }
  }, [game?.id, user?.id])

  // If the game is reopened (not completed), clear confirmation so it reappears next time it closes
  useEffect(() => {
    if (!game || !user?.id || typeof window === 'undefined') return
    if (game.status === 'completed') return

    const key = `payout-${game.id}-${user.id}`
    const stored = localStorage.getItem(key)
    if (stored) {
      try {
        const parsed = JSON.parse(stored)
        localStorage.setItem(
          key,
          JSON.stringify({
            ...parsed,
            confirmed: false,
          })
        )
      } catch {
        localStorage.setItem(key, JSON.stringify({ completedAt: '', method: '', confirmed: false }))
      }
    }

    setSessionConfirmed(false)
    setConfirmDialogOpen(false)
  }, [game?.status, game?.id, user?.id])

  const savePayoutMeta = (next: { completedAt?: string; method?: string; handle?: string; confirmed?: boolean }) => {
    if (!game || !user?.id) return
    const key = `payout-${game.id}-${user.id}`
    const payload = {
      completedAt: next.completedAt ?? payoutCompletedAt,
      method: next.method ?? payoutMethod,
      handle: next.handle ?? payoutHandle,
      confirmed: next.confirmed ?? sessionConfirmed,
    }
    localStorage.setItem(key, JSON.stringify(payload))
  }

  const handleConfirmSession = () => {
    if (!game || !user?.id) return
    setConfirmMethod(payoutMethod)
    setConfirmHandle(payoutHandle)
    setConfirmPayoutTime(payoutCompletedAt || getNowLocal())
    setConfirmDialogOpen(true)
  }

  const handleConfirmDialogSave = () => {
    if (!confirmMethod) {
      alert('Please select a payment type.')
      return
    }
    if (!confirmHandle.trim()) {
      alert('Please enter your payment username/handle.')
      return
    }
    const nextMethod = confirmMethod.trim()
    const nextHandle = confirmHandle.trim()
    setPayoutMethod(nextMethod)
    setPayoutHandle(nextHandle)
    setPayoutCompletedAt(confirmPayoutTime)
    setSessionConfirmed(true)
    savePayoutMeta({ confirmed: true, method: nextMethod, completedAt: confirmPayoutTime, handle: nextHandle })
    setConfirmDialogOpen(false)
  }

  const handleOpenDispute = () => {
    setDisputeBuyIn(userSession ? userSession.buyIn.toString() : '')
    setDisputePayout(userSession ? userSession.endAmount.toString() : '')
    setDisputeDialogOpen(true)
  }

  const handleSubmitDispute = () => {
    const buyVal = disputeBuyIn.trim()
    const payoutVal = disputePayout.trim()
    if (!buyVal || !payoutVal) {
      alert('Please enter both buy-in and payout amounts.')
      return
    }
    setSessionConfirmed(true)
    setDisputeDialogOpen(false)
    setDisputeNoticeOpen(true)
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
    } else {
      // one-time player (ghost). Keep userId null, do not add to group, set role to one-time.
      if (!playerName) {
        alert('Please enter a name.')
        return
      }
      if (savedGuestMatch || existingGuestSessionMatch) {
        const proceed = typeof window === 'undefined'
          ? true
          : window.confirm('A guest with this name already exists. Add another one-time player?')
        if (!proceed) {
          return
        }
      }
      userId = null
      roleOverride = undefined // store as guest role; differentiate in UI by null userId
      isOneTime = true
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

  const changeGameStatus = async (status: 'open' | 'completed' | 'in-progress') => {
    if (!gameId || !game || !user?.id) return
    setStatusUpdating(true)
    try {
      const success = await updateGameStatus(gameId, status, user.id)
      if (success) {
        await refreshGame()
      } else {
        alert('Could not update the game status. Please try again.')
      }
    } catch (error) {
      console.error('Error updating game status:', error)
      alert('Could not update the game status. Please try again.')
    } finally {
      setStatusUpdating(false)
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
  const isGroupMember = group?.members.some(m => m.userId === user?.id) || false
  const canAdminEdit = isHost || isGroupOwner
  const isAlreadyJoined = game.sessions.some(s => s.userId === user?.id)
  const userSession = game.sessions.find(s => s.userId === user?.id)
  const isClosed = game.status === 'completed'
  const userLostMoney = userSession ? userSession.endAmount < userSession.buyIn : false
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
  const canKick = canAdminEdit && !isClosed

  const handleQuickJoin = async (): Promise<boolean> => {
    if (!user?.id) {
      alert('You must be logged in to join this game.')
      return false
    }
    if (isAlreadyJoined || isClosed) return false

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
    if (!isClosed) {
      alert('You can only add this game to your dashboard after it is closed.')
      return
    }
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
    if (!isAlreadyJoined || isClosed) return

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
          {from && (
            <div className="flex items-center gap-4">
              <Button 
                variant="ghost" 
                size="sm" 
                className="gap-2"
                onClick={() => {
                  if (from === 'group' && groupId) {
                    router.push(`/groups/${groupId}`)
                  } else if (from === 'dashboard') {
                    router.push('/')
                  } else if (group) {
                    router.push(`/groups/${group.id}`)
                  } else {
                    router.push('/')
                  }
                }}
              >
                <ArrowLeft className="h-4 w-4" />
                Back
              </Button>
            </div>
          )}
          
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-2">
              <h1 className="text-4xl font-bold tracking-tight">
                Game - {format(new Date(game.date), 'MMMM dd, yyyy')}
              </h1>
              {group && (
                <p className="text-muted-foreground">
                  Group: {group.name}
                </p>
              )}
              <div className="flex flex-wrap items-center gap-3">
                <Badge variant={game.status === 'completed' ? 'secondary' : 'default'}>
                  {game.status === 'completed' ? 'Closed' : game.status === 'in-progress' ? 'In Progress' : 'Open'}
                </Badge>
                {isGroupOwner && game.status === 'open' && (
                  <Button
                    size="sm"
                    className="gap-2"
                    onClick={() => changeGameStatus('in-progress')}
                    disabled={statusUpdating}
                  >
                    {statusUpdating ? 'Starting...' : 'Start Game'}
                  </Button>
                )}
                {isGroupOwner && (
                  <Button
                    variant={game.status === 'completed' ? 'outline' : 'destructive'}
                    size="sm"
                    className="gap-2"
                    onClick={() => changeGameStatus(game.status === 'completed' ? 'open' : 'completed')}
                    disabled={statusUpdating}
                  >
                    {game.status === 'completed' ? (
                      <Unlock className="h-4 w-4" />
                    ) : (
                      <Lock className="h-4 w-4" />
                    )}
                    {statusUpdating
                      ? 'Updating...'
                      : game.status === 'completed'
                        ? 'Reopen Game'
                        : 'Close Game'}
                  </Button>
                )}
              </div>
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
                  disabled={participantUpdating || isClosed}
                >
                  {isAlreadyJoined ? <LogOut className="h-4 w-4" /> : <UserPlus className="h-4 w-4" />}
                  {isClosed
                    ? 'Game Closed'
                    : isAlreadyJoined
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
                  disabled={participantUpdating || isClosed}
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
                          disabled={game.status === 'completed' || game.status === 'open'}
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
                          disabled={game.status === 'completed' || game.status === 'open'}
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
                          disabled={savingIndex === index || game.status === 'completed' || game.status === 'open'}
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

        {/* Closed game verification for current user */}
        {user && isClosed && isAlreadyJoined && userSession && !sessionConfirmed && (
          <Card>
            <CardHeader>
              <CardTitle>Your Session Verification</CardTitle>
              <CardDescription>
                Review your buy-in and cash-out. You can confirm your session and, if you lost money, record payout details.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Buy-In</p>
                  <p className="text-lg font-semibold">${userSession.buyIn.toFixed(2)}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Cash Out</p>
                  <p className="text-lg font-semibold">${userSession.endAmount.toFixed(2)}</p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Result</p>
                  <p
                    className={`text-lg font-semibold ${
                      userSession.endAmount - userSession.buyIn >= 0 ? 'text-green-600' : 'text-red-600'
                    }`}
                  >
                    {userSession.endAmount - userSession.buyIn >= 0 ? '+' : '-'}$
                    {Math.abs(userSession.endAmount - userSession.buyIn).toFixed(2)}
                  </p>
                </div>
              </div>

              <p className="text-sm text-muted-foreground">
                Use confirm to lock your session. Add payout details so others know how to pay you (or how you paid out).
              </p>

              <div className="flex items-center gap-3">
                <div className="flex flex-wrap gap-2">
                  <Button
                    type="button"
                    variant="default"
                    onClick={handleConfirmSession}
                  >
                    Confirm Session
                  </Button>
                  <Button
                    type="button"
                    variant="outline"
                    onClick={handleOpenDispute}
                  >
                    Dispute Session
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Confirmation and payout details are visible to you and the owner on this device.
                </p>
              </div>
            </CardContent>
          </Card>
        )}

        {/* Participants (merged list in player format) */}
        {user && (
          <div id="join-game-section">
            <JoinGameForm 
              game={game}
              canAddMember={canAdminEdit && !isClosed}
              onAddMember={canAdminEdit && !isClosed ? handleOpenAddMember : undefined}
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

      {confirmDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Confirm Your Session</CardTitle>
              <CardDescription>
                Review and confirm your session. Add how you want to be paid (or how you paid out).
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Buy-In</p>
                  <p className="text-lg font-semibold">
                    ${userSession?.buyIn.toFixed(2) ?? '0.00'}
                  </p>
                </div>
                <div className="rounded-md border p-3">
                  <p className="text-xs text-muted-foreground">Cash Out</p>
                  <p className="text-lg font-semibold">
                    ${userSession?.endAmount.toFixed(2) ?? '0.00'}
                  </p>
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="confirmMethod">Payment method</Label>
                <Select
                  value={confirmMethod}
                  onValueChange={(val) => setConfirmMethod(val)}
                >
                  <SelectTrigger id="confirmMethod" className="w-full">
                    <SelectValue placeholder="Choose a method" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="Zelle">Zelle</SelectItem>
                    <SelectItem value="Cash App">Cash App</SelectItem>
                    <SelectItem value="Venmo">Venmo</SelectItem>
                    <SelectItem value="Cash">Cash</SelectItem>
                    <SelectItem value="Other">Other</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmHandle">Username / handle</Label>
                <Input
                  id="confirmHandle"
                  placeholder="@johndoe"
                  value={confirmHandle}
                  onChange={(e) => setConfirmHandle(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="confirmPayoutTime">Payout completed at</Label>
                <Input
                  id="confirmPayoutTime"
                  type="datetime-local"
                  value={confirmPayoutTime}
                  onChange={(e) => setConfirmPayoutTime(e.target.value)}
                />
              </div>

              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" type="button" onClick={() => setConfirmDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleConfirmDialogSave}>
                  Confirm
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {disputeDialogOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-lg">
            <CardHeader>
              <CardTitle>Dispute Session</CardTitle>
              <CardDescription>
                Suggest the buy-in and payout amounts you believe are correct.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="disputeBuyIn">Buy-In</Label>
                  <Input
                    id="disputeBuyIn"
                    type="number"
                    step="0.01"
                    min="0"
                    value={disputeBuyIn}
                    onChange={(e) => setDisputeBuyIn(e.target.value)}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="disputePayout">Payout</Label>
                  <Input
                    id="disputePayout"
                    type="number"
                    step="0.01"
                    min="0"
                    value={disputePayout}
                    onChange={(e) => setDisputePayout(e.target.value)}
                  />
                </div>
              </div>
              <div className="flex items-center justify-end gap-2 pt-2">
                <Button variant="outline" type="button" onClick={() => setDisputeDialogOpen(false)}>
                  Cancel
                </Button>
                <Button type="button" onClick={handleSubmitDispute}>
                  Submit Dispute
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      )}

      {disputeNoticeOpen && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center px-4">
          <Card className="w-full max-w-md">
            <CardHeader>
              <CardTitle>Dispute Submitted</CardTitle>
              <CardDescription>
                When the host verifies this dispute, you can confirm the correct amount.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-center justify-end gap-2">
              <Button variant="outline" onClick={() => setDisputeNoticeOpen(false)}>
                Close
              </Button>
            </CardContent>
          </Card>
        </div>
      )}

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
                  onValueChange={(val: 'group' | 'guest' | 'one-time') => {
                    if (val === 'group') {
                      const memberIdsInGame = new Set(game.sessions.map(s => s.userId).filter(Boolean) as string[])
                      const eligible = (group?.members || []).filter(m => !memberIdsInGame.has(m.userId))
                      setAddMemberMode('group')
                      setSelectedGroupMemberId(eligible[0]?.userId || '')
                      setMemberName(eligible[0]?.userName || '')
                      setMemberSearch('')
                      setSelectedMembers([])
                    } else if (val === 'guest') {
                      setAddMemberMode('guest')
                      setSelectedGroupMemberId('')
                      setMemberName('')
                      setMemberSearch('')
                      setSelectedMembers([])
                    } else {
                      setAddMemberMode('one-time')
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
                    <SelectItem value="one-time">One-time player</SelectItem>
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
                    {addMemberMode === 'guest' ? 'Guest name' : 'One-time player name'}
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

