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
  }, [games, cumulative, userId])

  const enhancedChartData = useMemo(() => {
    if (chartData.length < 2) return chartData

    const xs = chartData.map((_, idx) => idx)
    const ys = chartData.map((point) => point.total)

    const meanX = xs.reduce((sum, x) => sum + x, 0) / xs.length
    const meanY = ys.reduce((sum, y) => sum + y, 0) / ys.length
    const denominator = xs.reduce((sum, x) => sum + Math.pow(x - meanX, 2), 0)

    if (denominator === 0) return chartData

    const slope = xs.reduce((sum, x, idx) => sum + (x - meanX) * (ys[idx] - meanY), 0) / denominator
    const intercept = meanY - slope * meanX

    const trendValues = xs.map((x) => intercept + slope * x)
    const residuals = ys.map((y, idx) => y - trendValues[idx])
    const variance = residuals.reduce((sum, r) => sum + r * r, 0) / residuals.length
    const stdDev = Math.sqrt(variance)

    return chartData.map((point, idx) => {
      const trend = Number(trendValues[idx].toFixed(2))
      const upper = Number((trend + stdDev).toFixed(2))
      const lower = Number((trend - stdDev).toFixed(2))

      return {
        ...point,
        trend,
        varianceRange: [lower, upper] as [number, number],
      }
    })
  }, [chartData])

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
            data={enhancedChartData}
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
              content={
                <ChartTooltipContent
                  formatter={(value, name) => {
                    if (Array.isArray(value) && value.length === 2) {
                      const [low, high] = value
                      return (
                        <div className="flex w-full justify-between">
                          <span className="text-muted-foreground">Variance</span>
                          <span className="font-mono">${low.toFixed(2)} to ${high.toFixed(2)}</span>
                        </div>
                      )
                    }
                    return `$${Number(value).toLocaleString()}`
                  }}
                />
              }
            />
            <Area
              type="monotone"
              dataKey="varianceRange"
              name="variance"
              isRange
              stroke="none"
              fill="var(--color-variance)"
              fillOpacity={0.08}
              activeDot={false}
              dot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="trend"
              name="trend"
              type="monotone"
              stroke="var(--color-trend)"
              strokeWidth={1.5}
              strokeDasharray="5 5"
              dot={false}
              isAnimationActive={false}
            />
            <Line
              dataKey="total"
              type="monotone"
              stroke="var(--color-total)"
              strokeWidth={2}
              dot={false}
            />
          </LineChart>
        </ChartContainer>
      </CardContent>
    </Card>
  )
}

