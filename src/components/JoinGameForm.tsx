'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { updateGameSession, getGameById } from '@/lib/supabase/storage'
import type { Game, GameSession } from '@/types'
import { UserPlus } from 'lucide-react'
import { toast } from 'sonner'

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

  if (isAlreadyJoined && userSession) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>Your Session</CardTitle>
          <CardDescription>You've already joined this game</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label className="text-muted-foreground">Buy-In</Label>
                <p className="text-lg font-semibold">${userSession.buyIn.toFixed(2)}</p>
              </div>
              <div>
                <Label className="text-muted-foreground">End Amount</Label>
                <p className="text-lg font-semibold">${userSession.endAmount.toFixed(2)}</p>
              </div>
            </div>
            <div className="pt-2 border-t">
              <Label className="text-muted-foreground">Profit/Loss</Label>
              <p className={`text-2xl font-bold ${
                userSession.profit >= 0 ? 'text-green-600' : 'text-red-600'
              }`}>
                ${userSession.profit.toFixed(2)}
              </p>
            </div>
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-2">
                  <Label htmlFor="buyIn">Update Buy-In ($)</Label>
                  <Input
                    id="buyIn"
                    type="number"
                    step="0.01"
                    min="0"
                    value={buyIn}
                    onChange={(e) => setBuyIn(e.target.value)}
                    placeholder={userSession.buyIn.toString()}
                  />
                </div>
                <div className="space-y-2">
                  <Label htmlFor="endAmount">Update End Amount ($)</Label>
                  <Input
                    id="endAmount"
                    type="number"
                    step="0.01"
                    min="0"
                    value={endAmount}
                    onChange={(e) => setEndAmount(e.target.value)}
                    placeholder={userSession.endAmount.toString()}
                  />
                </div>
              </div>
              <Button type="submit" disabled={loading} className="w-full gap-2">
                <UserPlus className="h-4 w-4" />
                {loading ? 'Updating...' : 'Update Session'}
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Join Game</CardTitle>
        <CardDescription>Add your buy-in and end amount</CardDescription>
      </CardHeader>
      <CardContent>
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
      </CardContent>
    </Card>
  )
}

