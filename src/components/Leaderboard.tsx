'use client'

import { useMemo, type ReactElement } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table'
import { Trophy, TrendingUp, TrendingDown } from 'lucide-react'
import type { Game, GameSession, PlayerStats } from '@/types'

export function Leaderboard({ games, hideCard = false, groupId, userId, singleGame = false }: { games: Game[]; hideCard?: boolean; groupId?: string; userId?: string; singleGame?: boolean }): ReactElement {
  const leaderboard = useMemo(() => {
    // For single game view, just show the sessions directly
    if (singleGame && games.length === 1) {
      const game = games[0]
      return game.sessions
        .map((session: GameSession) => {
          const profit = session.profit || (session.endAmount - session.buyIn)
          return {
            name: session.playerName || 'Unknown',
            userId: session.userId,
            totalProfit: profit,
            buyIn: session.buyIn || 0,
            endAmount: session.endAmount || 0,
            gamesPlayed: 1,
            totalBuyIns: session.buyIn || 0,
            totalEndAmounts: session.endAmount || 0,
            winRate: profit > 0 ? 1 : 0
          }
        })
        .sort((a, b) => b.totalProfit - a.totalProfit)
    }

    // For multiple games, aggregate stats
    const playerStats = new Map<string, PlayerStats>()

    games.forEach(game => {
      game.sessions?.forEach((session: GameSession) => {
        // Filter by userId if provided
        if (userId && session.userId !== userId) {
          return
        }
        
        const playerName = session.playerName || 'Unknown'
        const profit = session.profit || (session.endAmount - session.buyIn)
        const buyIn = session.buyIn || 0
        const endAmount = session.endAmount || 0
        
        // Use userId as key if available, otherwise use name
        const key = session.userId || playerName
        
        if (!playerStats.has(key)) {
          playerStats.set(key, {
            name: playerName,
            userId: session.userId,
            totalProfit: 0,
            gamesPlayed: 0,
            totalBuyIns: 0,
            totalEndAmounts: 0,
            winRate: 0
          })
        }

        const stats = playerStats.get(key)!
        stats.totalProfit += profit
        stats.gamesPlayed += 1
        stats.totalBuyIns += buyIn
        stats.totalEndAmounts += endAmount
      })
    })

    // Calculate win rate
    playerStats.forEach((stats) => {
      stats.winRate = stats.gamesPlayed > 0 
        ? (stats.totalProfit > 0 ? 1 : 0) // Simplified: 1 if profitable overall, 0 otherwise
        : 0
    })

    return Array.from(playerStats.values())
      .sort((a, b) => b.totalProfit - a.totalProfit)
  }, [games, singleGame, userId])

  const getRankIcon = (rank: number) => {
    if (rank === 0) return <Trophy className="h-5 w-5 text-yellow-500" />
    if (rank === 1) return <Trophy className="h-5 w-5 text-gray-400" />
    if (rank === 2) return <Trophy className="h-5 w-5 text-amber-600" />
    return <span className="text-muted-foreground">#{rank + 1}</span>
  }

  const tableContent = (
    <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16">Rank</TableHead>
              <TableHead>Player</TableHead>
              <TableHead className="text-right">Profit/Loss</TableHead>
              {singleGame ? (
                <>
                  <TableHead className="text-right">Buy-In</TableHead>
                  <TableHead className="text-right">End Amount</TableHead>
                </>
              ) : (
                <>
                  <TableHead className="text-right">Games Played</TableHead>
                  <TableHead className="text-right">Total Buy-Ins</TableHead>
                  <TableHead className="text-right">Avg Profit/Game</TableHead>
                </>
              )}
            </TableRow>
          </TableHeader>
          <TableBody>
            {leaderboard.map((player, index) => {
              const avgProfit = !singleGame && player.gamesPlayed > 0 
                ? player.totalProfit / player.gamesPlayed 
                : 0
              
              return (
                <TableRow key={player.name || player.userId || index}>
                  <TableCell>
                    <div className="flex items-center gap-2">
                      {getRankIcon(index)}
                    </div>
                  </TableCell>
                  <TableCell className="font-medium">{player.name}</TableCell>
                  <TableCell className="text-right">
                    <div className="flex items-center justify-end gap-2">
                      {player.totalProfit >= 0 ? (
                        <TrendingUp className="h-4 w-4 text-green-600" />
                      ) : (
                        <TrendingDown className="h-4 w-4 text-red-600" />
                      )}
                      <span className={player.totalProfit >= 0 ? 'text-green-600 font-semibold' : 'text-red-600 font-semibold'}>
                        ${player.totalProfit.toFixed(2)}
                      </span>
                    </div>
                  </TableCell>
                  {singleGame ? (
                    <>
                      <TableCell className="text-right">${player.buyIn.toFixed(2)}</TableCell>
                      <TableCell className="text-right">${player.endAmount.toFixed(2)}</TableCell>
                    </>
                  ) : (
                    <>
                      <TableCell className="text-right">{player.gamesPlayed}</TableCell>
                      <TableCell className="text-right">${player.totalBuyIns.toFixed(2)}</TableCell>
                      <TableCell className="text-right">
                        <span className={avgProfit >= 0 ? 'text-green-600' : 'text-red-600'}>
                          ${avgProfit.toFixed(2)}
                        </span>
                      </TableCell>
                    </>
                  )}
                </TableRow>
              )
            })}
          </TableBody>
        </Table>
  )

  if (leaderboard.length === 0) {
    const emptyState = (
      <div className="flex items-center justify-center h-[200px] text-muted-foreground">
        {singleGame ? 'No players have joined this game yet.' : 'No players yet. Add a game to see the leaderboard.'}
      </div>
    )

    if (hideCard) {
      return emptyState
    }

    return (
      <Card>
        <CardHeader>
          <CardTitle>Leaderboard</CardTitle>
          <CardDescription>
            {singleGame ? 'Player rankings for this game' : 'Player rankings based on total profit'}
          </CardDescription>
        </CardHeader>
        <CardContent>
          {emptyState}
        </CardContent>
      </Card>
    )
  }

  if (hideCard) {
    return tableContent
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>Leaderboard</CardTitle>
        <CardDescription>
          {singleGame ? 'Player rankings for this game' : 'Player rankings based on total profit'}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {tableContent}
      </CardContent>
    </Card>
  )
}

