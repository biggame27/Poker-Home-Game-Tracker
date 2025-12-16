'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GroupSelector } from '@/components/GroupSelector'
import { createGame, getOrCreatePersonalGroup, updateGameSession } from '@/lib/supabase/storage'
import type { Game, GameSession } from '@/types'
import { toast } from '@/lib/toast'

interface SimpleGameFormProps {
  defaultGroupId?: string
  onSuccess?: () => void
  gameType?: 'personal' | 'group'
}

export function SimpleGameForm({ defaultGroupId, onSuccess, gameType = 'group' }: SimpleGameFormProps) {
  const { user } = useUser()
  const router = useRouter()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [groupId, setGroupId] = useState(defaultGroupId || '')
  const [notes, setNotes] = useState('')
  const [buyIn, setBuyIn] = useState('')
  const [cashOut, setCashOut] = useState('')
  const [loading, setLoading] = useState(false)
  const [loadingPersonalGroup, setLoadingPersonalGroup] = useState(false)

  // Automatically get/create personal group when game type is personal
  useEffect(() => {
    const loadPersonalGroup = async () => {
      if (gameType === 'personal' && user?.id) {
        setLoadingPersonalGroup(true)
        try {
          const userName = user.fullName || user.emailAddresses[0]?.emailAddress || 'Host'
          const personalGroup = await getOrCreatePersonalGroup(user.id, userName)
          if (personalGroup) {
            setGroupId(personalGroup.id)
          }
        } catch (error) {
          console.error('Error loading personal group:', error)
          toast.error('Failed to load personal group')
        } finally {
          setLoadingPersonalGroup(false)
        }
      } else if (gameType === 'group' && defaultGroupId) {
        // Reset to default group ID when switching to group mode
        setGroupId(defaultGroupId)
      } else if (gameType === 'group' && !defaultGroupId) {
        // Clear group ID when switching to group mode without default
        setGroupId('')
      }
    }

    loadPersonalGroup()
  }, [gameType, user?.id, defaultGroupId])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupId) {
      toast.error('Please select a group')
      return
    }
    if (!user?.id) {
      toast.error('You must be logged in to create a game')
      return
    }


    setLoading(true)

    try {
      const userName = user.fullName || user.emailAddresses[0]?.emailAddress || 'Host'
      
      // For personal games, ensure personal group exists
      let finalGroupId = groupId
      if (gameType === 'personal') {
        const personalGroup = await getOrCreatePersonalGroup(user.id, userName)
        if (!personalGroup) {
          toast.error('Failed to get personal group')
          return
        }
        finalGroupId = personalGroup.id
      }
      
      const game = await createGame(
        finalGroupId,
        date,
        gameType === 'personal' ? 'Personal session' : (notes || undefined),
        user.id,
        userName
      )
      
      if (!game) {
        toast.error('Failed to create game. Please try again.')
        return
      }
      
      // For personal games, update the session with buy-in and cash out, then mark as completed
      if (gameType === 'personal') {
        const buyInAmount = parseFloat(buyIn) || 0
        const endAmount = parseFloat(cashOut) || 0
        
        const success = await updateGameSession(
          game.id,
          user.id,
          userName,
          buyInAmount,
          endAmount
        )
        
        if (!success) {
          toast.error('Failed to update game session. Please try again.')
          return
        }
      }
      
      toast.success('Game created successfully!')
      
      // Redirect to game detail page
      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/games/${game.id}`)
      }
    } catch (error) {
      console.error('Error creating game:', error)
      toast.error('Failed to create game. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {gameType === 'personal' ? (
        <>
          <div className="space-y-2">
            <Label htmlFor="date">Date *</Label>
            <Input
              id="date"
              type="date"
              value={date}
              onChange={(e) => setDate(e.target.value)}
              required
            />
          </div>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="buyIn">Buy-In ($)</Label>
              <Input
                id="buyIn"
                type="number"
                step="0.01"
                min="0"
                value={buyIn}
                onChange={(e) => setBuyIn(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cashOut">Cash Out ($)</Label>
              <Input
                id="cashOut"
                type="number"
                step="0.01"
                min="0"
                value={cashOut}
                onChange={(e) => setCashOut(e.target.value)}
                placeholder="0.00"
              />
            </div>
          </div>
          {buyIn && cashOut && (
            <div className="p-3 bg-muted rounded-lg">
              <div className="flex justify-between items-center">
                <span className="text-sm text-muted-foreground">Profit/Loss:</span>
                <span className={`text-lg font-semibold ${
                  parseFloat(cashOut) - parseFloat(buyIn) >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${(parseFloat(cashOut) - parseFloat(buyIn)).toFixed(2)}
                </span>
              </div>
            </div>
          )}
        </>
      ) : (
        <>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label htmlFor="date">Game Date *</Label>
              <Input
                id="date"
                type="date"
                value={date}
                onChange={(e) => setDate(e.target.value)}
                required
              />
            </div>
            <GroupSelector value={groupId} onValueChange={setGroupId} required excludePersonalGroup />
          </div>
          <div className="space-y-2">
            <Label htmlFor="notes">Notes (optional)</Label>
            <Input
              id="notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Add any notes about this game..."
            />
          </div>
        </>
      )}

      <Button
        type="submit"
        disabled={loading || loadingPersonalGroup || (gameType === 'personal' && !groupId)}
        className="w-full"
      >
        {loading ? 'Creating...' : 'Create Game'}
      </Button>
    </form>
  )
}
