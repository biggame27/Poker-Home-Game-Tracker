'use client'

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Area } from 'recharts'
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
  guestName?: string
}

const chartConfig = {
  total: {
    label: 'Total',
    color: 'var(--chart-1)',
  },
  trend: {
    label: 'Trend',
    color: 'var(--chart-2)',
  },
  variance: {
    label: 'Variance band',
    color: 'var(--chart-2)',
  },
} satisfies ChartConfig

export function RunningTotalsChart({ 
  games, 
  cumulative = false,
  title = cumulative ? 'Overall Running Total' : 'Running Totals by Date',
  description = cumulative 
    ? 'Cumulative profit/loss over time' 
    : 'Profit/loss per game date',
  userId,
  guestName
}: RunningTotalsChartProps) {
  const chartData = useMemo(() => {
    if (!games || games.length === 0) {
      return []
    }

    // Process games data into chart format, filtering by userId or guestName if provided
    const processed = games
      .flatMap(game => 
        game.sessions
          ?.filter((session: GameSession) => {
            if (userId) {
              return session.userId === userId
            }
            if (guestName) {
              const nameMatches = session.playerName?.toLowerCase() === guestName.toLowerCase()
              const isGuest = !session.userId || session.userId?.startsWith('guest-') || session.role === 'guest'
              return nameMatches && isGuest
            }
            return true
          })
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
          date: item.date.toISOString(),
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
        date: date.toISOString(),
        total: Number(total.toFixed(2))
      }))
      .sort((a, b) => new Date(a.date).getTime() - new Date(b.date).getTime())
  }, [games, cumulative, userId, guestName])


  // Calculate final value to determine color
  const finalValue = useMemo(() => {
    if (chartData.length === 0) return 0
    return chartData[chartData.length - 1]?.total || 0
  }, [chartData])

  const isProfitable = finalValue >= 0
  const lineColor = isProfitable ? '#16a34a' : '#dc2626' // green-600 : red-600

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
      <CardContent className="px-2 sm:p-6">
        <ChartContainer
          config={chartConfig}
          className="aspect-auto h-[250px] w-full"
        >
          <LineChart
            accessibilityLayer
            data={chartData}
            margin={{
              left: 12,
              right: 12,
            }}
          >
            <CartesianGrid vertical={false} />
            <XAxis
              dataKey="date"
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              minTickGap={32}
              tickFormatter={(value) => {
                const date = new Date(value)
                return date.toLocaleDateString('en-US', {
                  month: 'short',
                  day: 'numeric',
                })
              }}
            />
            <YAxis
              tickLine={false}
              axisLine={false}
              tickMargin={8}
              tickFormatter={(value) => `$${value}`}
            />
            <ChartTooltip
              shared={false}
              trigger="hover"
              content={
                <ChartTooltipContent
                  labelFormatter={(value) => {
                    const date = new Date(value)
                    return format(date, 'MMMM dd, yyyy')
                  }}
                  formatter={(value) => {
                    return `$${Number(value).toLocaleString()}`
                  }}
                />
              }
            />
            <Line
              dataKey="total"
              type="linear"
              stroke={lineColor}
              strokeWidth={2}
              dot={{ r: 4, fill: lineColor, strokeWidth: 2 }}
              activeDot={{ r: 6, fill: lineColor, strokeWidth: 2 }}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

