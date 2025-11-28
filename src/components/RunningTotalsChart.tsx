'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid } from 'recharts'
import { ChartContainer, ChartTooltip, ChartTooltipContent, type ChartConfig } from '@/components/ui/chart'
import { useMemo } from 'react'
import { format } from 'date-fns'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import type { Game, GameSession } from '@/types'

interface RunningTotalsChartProps {
  games: Game[]
  cumulative?: boolean
  title?: string
  description?: string
  groupId?: string
  userId?: string
}

const chartConfig = {
  total: {
    label: 'Total',
    color: 'hsl(var(--chart-1))',
  },
} satisfies ChartConfig

export function RunningTotalsChart({ 
  games, 
  cumulative = false,
  title = cumulative ? 'Overall Running Total' : 'Running Totals by Date',
  description = cumulative 
    ? 'Cumulative profit/loss over time' 
    : 'Profit/loss per game date',
  userId
}: RunningTotalsChartProps) {
  const chartData = useMemo(() => {
    if (!games || games.length === 0) {
      return []
    }

    // Process games data into chart format, filtering by userId if provided
    const processed = games
      .flatMap(game => 
        game.sessions
          ?.filter((session: GameSession) => !userId || session.userId === userId)
          ?.map((session: GameSession) => ({
            date: new Date(game.date),
            profit: session.profit || (session.endAmount - session.buyIn)
          })) || []
      )
      .sort((a, b) => a.date.getTime() - b.date.getTime())

    if (cumulative) {
      let runningTotal = 0
      return processed.map(item => {
        runningTotal += item.profit
        return {
          date: format(item.date, 'MMM dd, yyyy'),
          total: Number(runningTotal.toFixed(2))
        }
      })
    }

    // Group by date
    const byDate = processed.reduce((acc, item) => {
      const dateKey = format(item.date, 'yyyy-MM-dd')
      if (!acc[dateKey]) {
        acc[dateKey] = { date: item.date, total: 0 }
      }
      acc[dateKey].total += item.profit
      return acc
    }, {} as Record<string, { date: Date; total: number }>)

    return Object.values(byDate)
      .map(({ date, total }) => ({
        date: format(date, 'MMM dd, yyyy'),
        total: Number(total.toFixed(2))
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [games, cumulative, userId])

  if (chartData.length === 0) {
    return (
      <Card>
        <CardHeader>
          <CardTitle>{title}</CardTitle>
          <CardDescription>{description}</CardDescription>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-center h-[300px] text-muted-foreground">
            No data available. Add a game to see charts.
          </div>
        </CardContent>
      </Card>
    )
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
      <CardContent>
        <ChartContainer config={chartConfig} className="min-h-[300px] w-full">
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{ top: 5, right: 10, left: 10, bottom: 5 }}
          >
            <CartesianGrid strokeDasharray="3 3" vertical={false} />
            <XAxis 
              dataKey="date" 
              tickLine={false}
              axisLine={false}
              tickMargin={8}
            />
            <YAxis 
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `$${value}`}
            />
            <ChartTooltip 
              content={<ChartTooltipContent 
                formatter={(value) => `$${Number(value).toLocaleString()}`}
              />} 
            />
            <Line 
              type="monotone" 
              dataKey="total" 
              stroke="var(--color-total)"
              strokeWidth={2}
              dot={{ r: 4 }}
              activeDot={{ r: 6 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

