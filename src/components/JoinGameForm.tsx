'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { updateGameSession } from '@/lib/supabase/storage'
import type { Game } from '@/types'
import { UserPlus } from 'lucide-react'
import { toast } from '@/lib/toast'

interface JoinGameFormProps {
  game: Game
  onSuccess: () => void
}

export function JoinGameForm({ game, onSuccess }: JoinGameFormProps) {
  const { user } = useUser()
  const [buyIn, setBuyIn] = useState('')
  const [endAmount, setEndAmount] = useState('')
  const [loading, setLoading] = useState(false)

  // Check if user is already in the game
  const isAlreadyJoined = game.sessions.some(s => s.userId === user?.id)
  const userSession = game.sessions.find(s => s.userId === user?.id)
  const isClosed = game.status === 'completed'

  const renderParticipants = () => {
    if (game.sessions.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          No participants have been logged for this game yet.
        </p>
      )
    }

    return (
      <div className="space-y-2">
        {game.sessions.map((session, index) => {
          const isCurrentUser = session.userId && session.userId === user?.id
          const profit = session.profit ?? (session.endAmount - session.buyIn)

          return (
            <div
              key={`${session.playerName}-${index}`}
              className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
            >
              <div>
                <p className="font-medium flex items-center gap-2">
                  {session.playerName}
                  {isCurrentUser && (
                    <span className="text-[10px] uppercase tracking-wide rounded-full bg-primary/10 text-primary px-2 py-0.5">
                      You
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Buy-in: ${session.buyIn.toFixed(2)} • Cash out: ${session.endAmount.toFixed(2)}
                </p>
              </div>
              <div className={`text-sm font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {profit >= 0 ? '+' : '-'}${Math.abs(profit).toFixed(2)}
              </div>
            </div>
          )
        })}
      </div>
    )
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id) {
      toast.error('You must be logged in to join a game')
      return
    }

    const buyInAmount = parseFloat(buyIn) || 0
    const endAmountValue = parseFloat(endAmount) || 0
    const profit = endAmountValue - buyInAmount

    setLoading(true)

    try {
      const playerName = user.fullName || user.emailAddresses[0]?.emailAddress || 'Player'
      
      const success = await updateGameSession(
        game.id,
        user.id,
        playerName,
        buyInAmount,
        endAmountValue
      )
      
      if (!success) {
        toast.error('Failed to join game. Please try again.')
        return
      }

      // Reset form
      setBuyIn('')
      setEndAmount('')
      
      toast.success(isAlreadyJoined ? 'Session updated successfully!' : 'Successfully joined the game!')
      onSuccess()
    } catch (error) {
      console.error('Error joining game:', error)
      toast.error('Failed to join game. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  if (!isAlreadyJoined && isClosed) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Game Closed</CardTitle>
          <CardDescription>This game is closed. New players cannot join.</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {renderParticipants()}
            <p className="text-sm text-muted-foreground">
              Contact the host if you believe you should already be listed for this game.
            </p>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          {isAlreadyJoined ? 'Update Your Session' : 'Join Game'}
        </CardTitle>
        <CardDescription>
          {isAlreadyJoined
            ? 'Adjust your buy-in and cash out for this game.'
            : 'Add your buy-in and end amount to join this game.'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-6">
          <div>
            <Label className="mb-2 block">Participants</Label>
            {renderParticipants()}
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="buyIn">Buy-In ($) *</Label>
                <Input
                  id="buyIn"
                  type="number"
                  step="0.01"
                  min="0"
                  value={buyIn}
                  onChange={(e) => setBuyIn(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="endAmount">End Amount ($) *</Label>
                <Input
                  id="endAmount"
                  type="number"
                  step="0.01"
                  min="0"
                  value={endAmount}
                  onChange={(e) => setEndAmount(e.target.value)}
                  placeholder="0.00"
                  required
                />
              </div>
            </div>

            {buyIn && endAmount && (
              <div className="p-3 bg-muted rounded-lg">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-muted-foreground">Profit/Loss:</span>
                  <span className={`text-lg font-semibold ${
                    parseFloat(endAmount) - parseFloat(buyIn) >= 0 ? 'text-green-600' : 'text-red-600'
                  }`}>
                    ${(parseFloat(endAmount) - parseFloat(buyIn)).toFixed(2)}
                  </span>
                </div>
              </div>
            )}

            <Button type="submit" disabled={loading} className="w-full gap-2">
              <UserPlus className="h-4 w-4" />
              {loading ? 'Joining...' : 'Join Game'}
            </Button>
          </form>
        </div>
      </CardContent>
    </Card>
  )
}

