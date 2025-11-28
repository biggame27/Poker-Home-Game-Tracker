'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { GroupSelector } from '@/components/GroupSelector'
import { Plus, Trash2 } from 'lucide-react'
import { addGame } from '@/lib/storage'
import { toast } from 'sonner'

interface PlayerSession {
  playerName: string
  buyIn: string
  endAmount: string
}

export function GameForm({ onSuccess, defaultGroupId }: { onSuccess?: () => void; defaultGroupId?: string }) {
  const { user } = useUser()
  const [date, setDate] = useState(new Date().toISOString().split('T')[0])
  const [groupId, setGroupId] = useState(defaultGroupId || '')
  const [players, setPlayers] = useState<PlayerSession[]>([
    { playerName: user?.fullName || '', buyIn: '', endAmount: '' }
  ])
  const [notes, setNotes] = useState('')
  const [loading, setLoading] = useState(false)

  const addPlayer = () => {
    setPlayers([...players, { playerName: '', buyIn: '', endAmount: '' }])
  }

  const removePlayer = (index: number) => {
    setPlayers(players.filter((_, i) => i !== index))
  }

  const updatePlayer = (index: number, field: keyof PlayerSession, value: string) => {
    const updated = [...players]
    updated[index] = { ...updated[index], [field]: value }
    setPlayers(updated)
  }

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
      const gameData = {
        id: `game-${Date.now()}`,
        groupId,
        date,
        createdBy: user.id,
        createdAt: new Date().toISOString(),
        sessions: players.map(p => ({
          playerName: p.playerName,
          buyIn: parseFloat(p.buyIn) || 0,
          endAmount: parseFloat(p.endAmount) || 0,
          profit: (parseFloat(p.endAmount) || 0) - (parseFloat(p.buyIn) || 0),
          userId: p.playerName === user.fullName ? user.id : undefined
        })),
        notes: notes || undefined,
        status: 'completed' as const
      }

      addGame(gameData)
      
      // Simulate API call delay
      await new Promise(resolve => setTimeout(resolve, 300))
      
      // Reset form
      setDate(new Date().toISOString().split('T')[0])
      setGroupId(defaultGroupId || '')
      setPlayers([{ playerName: user?.fullName || '', buyIn: '', endAmount: '' }])
      setNotes('')
      
      toast.success('Game added successfully!')
      
      if (onSuccess) {
        onSuccess()
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
          <Label htmlFor="date">Game Date</Label>
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

      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <Label>Players</Label>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={addPlayer}
            className="gap-2"
          >
            <Plus className="h-4 w-4" />
            Add Player
          </Button>
        </div>

        <div className="space-y-3">
          {players.map((player, index) => (
            <Card key={index}>
              <CardContent className="pt-6">
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                  <div className="md:col-span-1">
                    <Label htmlFor={`player-${index}`}>Player Name</Label>
                    <Input
                      id={`player-${index}`}
                      value={player.playerName}
                      onChange={(e) => updatePlayer(index, 'playerName', e.target.value)}
                      placeholder="Player name"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor={`buyin-${index}`}>Buy-In ($)</Label>
                    <Input
                      id={`buyin-${index}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={player.buyIn}
                      onChange={(e) => updatePlayer(index, 'buyIn', e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div>
                    <Label htmlFor={`end-${index}`}>End Amount ($)</Label>
                    <Input
                      id={`end-${index}`}
                      type="number"
                      step="0.01"
                      min="0"
                      value={player.endAmount}
                      onChange={(e) => updatePlayer(index, 'endAmount', e.target.value)}
                      placeholder="0.00"
                      required
                    />
                  </div>
                  <div className="flex items-end">
                    {players.length > 1 && (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => removePlayer(index)}
                        className="gap-2 text-destructive"
                      >
                        <Trash2 className="h-4 w-4" />
                        Remove
                      </Button>
                    )}
                    {player.buyIn && player.endAmount && (
                      <div className="ml-auto text-sm">
                        <span className="text-muted-foreground">Profit: </span>
                        <span className={parseFloat(player.endAmount) - parseFloat(player.buyIn) >= 0 ? 'text-green-600' : 'text-red-600'}>
                          ${(parseFloat(player.endAmount) - parseFloat(player.buyIn)).toFixed(2)}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
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
        {loading ? 'Saving...' : 'Add Game'}
      </Button>
    </form>
  )
}

