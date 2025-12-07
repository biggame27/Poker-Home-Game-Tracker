'use client'

import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import type { Game } from '@/types'

interface JoinGameFormProps {
  game: Game
  onAddMember?: () => void
  canAddMember?: boolean
}

export function JoinGameForm({ game, onAddMember, canAddMember }: JoinGameFormProps) {
  const { user } = useUser()

  const renderParticipants = () => {
    if (game.sessions.length === 0) {
      return (
        <p className="text-sm text-muted-foreground">
          No participants have been logged for this game yet.
        </p>
      )
    }

    const memberSessions = game.sessions.filter(s => s.userId)
    const guestSessions = game.sessions.filter(s => !s.userId)

    const renderList = (sessions: typeof game.sessions) => (
      <div className="space-y-2">
        {sessions.map((session, index) => {
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
                  {!session.userId && (
                    <span className="text-[10px] uppercase tracking-wide rounded-full bg-muted text-muted-foreground px-2 py-0.5">
                      Guest
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  Buy-in: ${session.buyIn.toFixed(2)} | Cash out: ${session.endAmount.toFixed(2)}
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

    return (
      <div className="space-y-4">
        {memberSessions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Members</p>
            {renderList(memberSessions)}
          </div>
        )}
        {guestSessions.length > 0 && (
          <div className="space-y-2">
            <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">Guests</p>
            {renderList(guestSessions)}
          </div>
        )}
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

