'use client'

import { useMemo } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { TrendingUp, TrendingDown, DollarSign, Calendar } from 'lucide-react'
import type { Game, GameSession } from '@/types'

export function OverallStats({ games, groupId, userId }: { games: Game[]; groupId?: string; userId?: string }) {
  const stats = useMemo(() => {
    // Filter games to only include sessions from the current user if userId is provided
    const filteredGames = userId 
      ? games.map(game => ({
          ...game,
          sessions: game.sessions?.filter((sess: GameSession) => sess.userId === userId) || []
        })).filter(game => game.sessions.length > 0)
      : games

    const totalGames = filteredGames.length
    const totalBuyIns = filteredGames.reduce((sum, game) => 
      sum + (game.sessions?.reduce((s: number, sess: GameSession) => 
        s + (sess.buyIn || 0), 0) || 0), 0
    )
    const totalEndAmounts = filteredGames.reduce((sum, game) => 
      sum + (game.sessions?.reduce((s: number, sess: GameSession) => 
        s + (sess.endAmount || 0), 0) || 0), 0
    )
    const totalProfit = totalEndAmounts - totalBuyIns
    const avgProfitPerGame = totalGames > 0 ? totalProfit / totalGames : 0

    return { 
      totalGames, 
      totalBuyIns, 
      totalEndAmounts, 
      totalProfit,
      avgProfitPerGame
    }
  }, [games, userId])

  const statCards = [
    {
      title: 'Total Games',
      value: stats.totalGames,
      icon: Calendar,
      description: 'Games tracked'
    },
    {
      title: 'Total Buy-Ins',
      value: `$${stats.totalBuyIns.toFixed(2)}`,
      icon: DollarSign,
      description: 'All buy-ins combined'
    },
    {
      title: 'Total Profit',
      value: `$${stats.totalProfit.toFixed(2)}`,
      icon: stats.totalProfit >= 0 ? TrendingUp : TrendingDown,
      description: 'Net profit/loss',
      isProfit: true
    },
    {
      title: 'Avg Profit/Game',
      value: `$${stats.avgProfitPerGame.toFixed(2)}`,
      icon: stats.avgProfitPerGame >= 0 ? TrendingUp : TrendingDown,
      description: 'Average per game',
      isProfit: true
    }
  ]

  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
      {statCards.map((stat) => {
        const Icon = stat.icon
        const isPositive = stat.isProfit && typeof stat.value === 'string' && stat.value.includes('-') === false
        
        return (
          <Card key={stat.title}>
            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
              <CardTitle className="text-sm font-medium">{stat.title}</CardTitle>
              <Icon className={`h-4 w-4 ${
                stat.isProfit 
                  ? (isPositive ? 'text-green-600' : 'text-red-600')
                  : 'text-muted-foreground'
              }`} />
            </CardHeader>
            <CardContent>
              <div className={`text-2xl font-bold ${
                stat.isProfit 
                  ? (isPositive ? 'text-green-600' : 'text-red-600')
                  : ''
              }`}>
                {stat.value}
              </div>
              <CardDescription className="mt-1">{stat.description}</CardDescription>
            </CardContent>
          </Card>
        )
      })}
    </div>
  )
}

