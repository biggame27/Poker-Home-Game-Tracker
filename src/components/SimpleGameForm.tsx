'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { GroupSelector } from '@/components/GroupSelector'
import { createGame } from '@/lib/supabase/storage'
import type { Game, GameSession } from '@/types'

interface SimpleGameFormProps {
  defaultGroupId?: string
  onSuccess?: () => void
}

export function SimpleGameForm({ defaultGroupId, onSuccess }: SimpleGameFormProps) {
  const { user } = useUser()
  const router = useRouter()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [groupId, setGroupId] = useState(defaultGroupId || '')
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!groupId) {
      alert('Please select a group')
      return
    }
    if (!user?.id) {
      alert('You must be logged in to create a game')
      return
    }

    setLoading(true)

    try {
      const userName = user.fullName || user.emailAddresses[0]?.emailAddress || 'Host'
      
      const game = await createGame(
        groupId,
        date,
        notes || undefined,
        user.id,
        userName
      )
      
      if (!game) {
        alert('Failed to create game. Please try again.')
        return
      }
      
      // Redirect to game detail page
      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/games/${game.id}`)
      }
    } catch (error) {
      console.error('Error creating game:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
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
        <GroupSelector value={groupId} onValueChange={setGroupId} required />
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

      <Button
        type="submit"
        disabled={loading}
        className="w-full"
      >
        {loading ? 'Creating...' : 'Create Game'}
      </Button>
    </form>
  )
}

