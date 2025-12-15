'use client'

import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Trash2 } from 'lucide-react'
import type { Game } from '@/types'

interface JoinGameFormProps {
  game: Game
  onAddMember?: () => void
  canAddMember?: boolean
  canKick?: boolean
  onKickParticipant?: (userId: string, playerName: string) => void
}

export function JoinGameForm({ game, onAddMember, canAddMember, canKick = false, onKickParticipant }: JoinGameFormProps) {
  const { user } = useUser()

  const renderParticipants = () => {
    if (game.sessions.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          No participants have been logged for this game yet.
        </p>
      )
    }

    const memberSessions = game.sessions.filter(s => s.userId && s.role !== 'guest')
    const guestSessions = game.sessions.filter(s => !s.userId || s.role === 'guest')

    return (
      <div className="space-y-6">
        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">Members</p>
          {memberSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No members in this game yet.</p>
          ) : (
            <div className="space-y-2">
              {memberSessions.map((session, index) => {
                const isCurrentUser = session.userId && session.userId === user?.id
                const profit = session.profit ?? (session.endAmount - session.buyIn)
                return (
                  <div
                    key={session.userId || `${session.playerName}-${index}`}
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
                        Buy-in ${session.buyIn.toFixed(2)} · Cash-out ${session.endAmount.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`text-sm font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {profit >= 0 ? '+' : '-'}${Math.abs(profit).toFixed(2)}
                      </div>
                      {canKick && session.userId && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onKickParticipant?.(session.userId!, session.playerName)}
                          aria-label="Remove player"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>

        <div className="space-y-2">
          <p className="text-sm font-semibold text-muted-foreground">Guests</p>
          {guestSessions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No guests in this game.</p>
          ) : (
            <div className="space-y-2">
              {guestSessions.map((session, index) => {
                const profit = session.profit ?? (session.endAmount - session.buyIn)
                return (
                  <div
                    key={session.userId || `${session.playerName}-${index}`}
                    className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"
                  >
                    <div>
                      <p className="font-medium flex items-center gap-2">
                        {session.playerName}
                        <span className="text-[10px] uppercase tracking-wide rounded-full bg-muted text-muted-foreground px-2 py-0.5">
                          {!session.userId ? 'One-time' : 'Guest'}
                        </span>
                      </p>
                      <p className="text-xs text-muted-foreground">
                        Buy-in ${session.buyIn.toFixed(2)} · Cash-out ${session.endAmount.toFixed(2)}
                      </p>
                    </div>
                    <div className="flex items-center gap-2">
                      <div className={`text-sm font-semibold ${profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                        {profit >= 0 ? '+' : '-'}${Math.abs(profit).toFixed(2)}
                      </div>
                      {canKick && session.userId && (
                        <Button
                          size="icon"
                          variant="ghost"
                          className="text-destructive hover:text-destructive"
                          onClick={() => onKickParticipant?.(session.userId!, session.playerName)}
                          aria-label="Remove player"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    )
  }

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between">
        <CardTitle>Participants</CardTitle>
        {canAddMember && onAddMember && (
          <button
            type="button"
            className="text-sm font-medium text-primary hover:underline"
            onClick={onAddMember}
          >
            Add member
          </button>
        )}
      </CardHeader>
      <CardContent>
        {renderParticipants()}
      </CardContent>
    </Card>
  )
}

