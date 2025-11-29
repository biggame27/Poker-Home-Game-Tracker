'use client'

import { useEffect, useMemo, useState, type ReactNode } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar'
import { Input } from '@/components/ui/input'
import { RunningTotalsChart } from '@/components/RunningTotalsChart'
import { getGamesByUser, getGroups } from '@/lib/supabase/storage'
import type { Game, Group, GameSession } from '@/types'
import { Calendar, TrendingUp, Wallet, Trophy, Users, Swords, Flame, Award, Medal, BarChart2 } from 'lucide-react'
import Link from 'next/link'

function formatCurrency(value: number) {
  const sign = value < 0 ? '-' : ''
  return `${sign}$${Math.abs(value).toFixed(2)}`
}

type HistoryRow = {
  id: string
  date: string
  groupName: string
  buyIn: number
  profit: number
}

export default function ProfilePage() {
  const { user, isLoaded } = useUser()
  const [games, setGames] = useState<Game[]>([])
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)
  const [historySearch, setHistorySearch] = useState('')

  useEffect(() => {
    const loadData = async () => {
      if (!user?.id) return
      setLoading(true)
      try {
        const [userGames, userGroups] = await Promise.all([
          getGamesByUser(user.id),
          getGroups(user.id),
        ])
        setGames(userGames)
        setGroups(userGroups)
      } catch (err) {
        console.error('Error loading profile data', err)
      } finally {
        setLoading(false)
      }
    }

    if (isLoaded && user?.id) {
      loadData()
    }
  }, [isLoaded, user?.id])

  const sessions = useMemo<GameSession[]>(() => {
    if (!user?.id) return []
    return games.flatMap((game) =>
      game.sessions.filter((s) => s.userId === user.id)
    )
  }, [games, user?.id])

  const stats = useMemo(() => {
    const profits = sessions.map((s) => s.profit ?? (s.endAmount - s.buyIn))
    const totalProfit = profits.reduce((sum, p) => sum + p, 0)
    const totalSessions = sessions.length
    const wins = sessions.filter((s) => (s.profit ?? (s.endAmount - s.buyIn)) > 0).length
    const winRate = totalSessions > 0 ? (wins / totalSessions) * 100 : 0
    const biggestWin = profits.length ? Math.max(...profits) : 0
    const biggestLoss = profits.length ? Math.min(...profits) : 0

    return { totalProfit, totalSessions, winRate, biggestWin, biggestLoss, wins }
  }, [sessions])

  const matchups = useMemo(() => {
    if (!user?.id) return []

    const opponents: Record<string, { name: string; games: number; userProfit: number; opponentProfit: number }> = {}

    games.forEach((game) => {
      const userSession = game.sessions.find((s) => s.userId === user.id)
      if (!userSession) return
      const userProfit = userSession.profit ?? (userSession.endAmount - userSession.buyIn)

      game.sessions.forEach((session) => {
        if (session.userId === user.id) return
        const key = session.userId || session.playerName
        if (!key) return
        const oppProfit = session.profit ?? (session.endAmount - session.buyIn)
        if (!opponents[key]) {
          opponents[key] = {
            name: session.playerName || 'Opponent',
            games: 0,
            userProfit: 0,
            opponentProfit: 0,
          }
        }
        opponents[key].games += 1
        opponents[key].userProfit += userProfit
        opponents[key].opponentProfit += oppProfit
      })
    })

    return Object.entries(opponents).map(([id, value]) => ({
      id,
      ...value,
      net: value.userProfit - value.opponentProfit,
    }))
  }, [games, user?.id])

  const bestMatchups = [...matchups]
    .filter((m) => m.games > 0)
    .sort((a, b) => b.net - a.net)
    .slice(0, 3)

  const closestRivals = [...matchups]
    .filter((m) => m.games > 0)
    .sort((a, b) => {
      if (b.games !== a.games) return b.games - a.games
      return Math.abs(a.net) - Math.abs(b.net)
    })
    .slice(0, 3)

  const badges = useMemo(() => {
    if (!user?.id || sessions.length === 0) return []

    const daySet = Array.from(
      new Set(
        games
          .filter((g) => g.sessions.some((s) => s.userId === user.id))
          .map((g) => new Date(g.date).toISOString().split('T')[0])
      )
    ).sort()

    let longestStreak = 0
    let currentStreak = 0
    let prevDate: Date | null = null

    daySet.forEach((dateStr) => {
      const date = new Date(dateStr)
      if (prevDate) {
        const diff = (date.getTime() - prevDate.getTime()) / (1000 * 60 * 60 * 24)
        currentStreak = diff === 1 ? currentStreak + 1 : 1
      } else {
        currentStreak = 1
      }
      longestStreak = Math.max(longestStreak, currentStreak)
      prevDate = date
    })

    const badgesList: { title: string; description: string; icon: ReactNode }[] = []

    if (longestStreak >= 3) {
      badgesList.push({
        title: 'Hot Streak',
        description: `${longestStreak}-day play streak`,
        icon: <Flame className="h-4 w-4 text-orange-500" />,
      })
    }

    if (stats.totalSessions >= 10) {
      badgesList.push({
        title: 'Regular',
        description: `${stats.totalSessions} sessions logged`,
        icon: <Award className="h-4 w-4 text-amber-500" />,
      })
    }

    if (stats.wins >= 5) {
      badgesList.push({
        title: 'Winner Circle',
        description: `${stats.wins} winning sessions`,
        icon: <Trophy className="h-4 w-4 text-green-600" />,
      })
    }

    if (stats.winRate >= 60 && stats.totalSessions >= 5) {
      badgesList.push({
        title: 'Sharpshooter',
        description: `Win rate ${stats.winRate.toFixed(1)}%`,
        icon: <Medal className="h-4 w-4 text-blue-600" />,
      })
    }

    if (badgesList.length === 0) {
      badgesList.push({
        title: 'Getting Started',
        description: 'Play more games to earn badges!',
        icon: <Award className="h-4 w-4 text-muted-foreground" />,
      })
    }

    return badgesList
  }, [games, sessions, stats.totalSessions, stats.wins, stats.winRate, user?.id])

  const historyRows = useMemo(() => {
    if (!user?.id) return []
    return games
      .map((game) => {
        const session = game.sessions.find((s) => s.userId === user.id)
        if (!session) return null
        const profit = session.profit ?? (session.endAmount - session.buyIn)
        const groupName = groups.find((g) => g.id === game.groupId)?.name || 'Unknown group'
        return {
          id: game.id,
          date: game.date,
          groupName,
          buyIn: session.buyIn,
          profit,
        } as HistoryRow
      })
      .filter((row): row is HistoryRow => Boolean(row))
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
  }, [games, groups, user?.id])

  const filteredHistory = useMemo(() => {
    const query = historySearch.trim().toLowerCase()
    const filtered = query
      ? historyRows.filter((row) => {
          const dateText = new Date(row.date).toLocaleDateString().toLowerCase()
          return (
            row.groupName.toLowerCase().includes(query) ||
            dateText.includes(query)
          )
        })
      : historyRows
    return filtered.slice(0, 5)
  }, [historyRows, historySearch])

  const groupBreakdown = useMemo(() => {
    if (!user?.id) return []

    return groups.map((group) => {
      const gamesInGroup = games.filter((g) => g.groupId === group.id)
      const sessionsInGroup = gamesInGroup
        .flatMap((g) => g.sessions.filter((s) => s.userId === user.id))

      const profit = sessionsInGroup.reduce((sum, s) => sum + (s.profit ?? (s.endAmount - s.buyIn)), 0)

      // Compute leaderboard within this group
      const memberProfits: Record<string, number> = {}
      gamesInGroup.forEach((g) => {
        g.sessions.forEach((s) => {
          const key = s.userId || s.playerName
          if (!key) return
          const p = s.profit ?? (s.endAmount - s.buyIn)
          memberProfits[key] = (memberProfits[key] || 0) + p
        })
      })

      const sorted = Object.entries(memberProfits)
        .sort((a, b) => b[1] - a[1])
        .map(([id, profitVal], idx) => ({
          id,
          profit: profitVal,
          rank: idx + 1,
        }))

      const myRankEntry = sorted.find((entry) => entry.id === user.id || entry.id === (user.fullName || user.username))
      const myRank = myRankEntry?.rank ?? null

      return {
        id: group.id,
        name: group.name,
        profit,
        gamesPlayed: gamesInGroup.length,
        rank: myRank,
        totalPlayers: sorted.length,
      }
    })
    .sort((a, b) => b.gamesPlayed - a.gamesPlayed)
  }, [games, groups, user?.id, user?.fullName, user?.username])


  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading profile...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <Card>
          <CardContent className="p-6">
            <p className="text-muted-foreground">You need to sign in to view your profile.</p>
            <div className="mt-4">
              <Link href="/">
                <Button>Go to dashboard</Button>
              </Link>
            </div>
          </CardContent>
        </Card>
      </div>
    )
  }

  const joinDate = user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'
  const bio =
    (user.publicMetadata as Record<string, any>)?.bio ||
    (user.privateMetadata as Record<string, any>)?.bio ||
    'No bio provided yet.'

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-6xl mx-auto p-4 md:p-8 space-y-8">
        <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-4">
          <div className="flex items-center gap-4">
            <Avatar className="h-16 w-16">
              <AvatarImage src={user.imageUrl || undefined} alt={user.fullName || 'User avatar'} />
              <AvatarFallback>
                {user.fullName?.[0] || user.username?.[0] || '?'}
              </AvatarFallback>
            </Avatar>
            <div>
              <h1 className="text-3xl font-bold tracking-tight">
                {user.fullName || user.username || 'Player'}
              </h1>
              <p className="text-muted-foreground">{bio}</p>
              <div className="flex items-center gap-2 text-sm text-muted-foreground mt-2">
                <Calendar className="h-4 w-4" />
                <span>Joined {joinDate}</span>
              </div>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Total Profit
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className={`text-3xl font-bold ${stats.totalProfit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                {formatCurrency(stats.totalProfit)}
              </div>
              <CardDescription>Across all sessions</CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Trophy className="h-4 w-4" />
                Total Sessions
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.totalSessions}</div>
              <CardDescription>Games you played</CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <TrendingUp className="h-4 w-4" />
                Win Rate
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{stats.winRate.toFixed(1)}%</div>
              <CardDescription>Sessions with profit</CardDescription>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium flex items-center gap-2">
                <Wallet className="h-4 w-4" />
                Biggest Win / Loss
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-lg font-semibold text-green-600">
                {formatCurrency(stats.biggestWin)}
              </div>
              <div className="text-sm text-red-600">
                {formatCurrency(stats.biggestLoss)}
              </div>
              <CardDescription>Best and worst session</CardDescription>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Badges</CardTitle>
            <CardDescription>Milestones for streaks, wins, and attendance</CardDescription>
          </CardHeader>
          <CardContent>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
              {badges.map((badge, idx) => (
                <div key={idx} className="flex items-start gap-3 rounded-lg border p-3">
                  <div className="mt-1">{badge.icon}</div>
                  <div>
                    <p className="font-semibold leading-tight">{badge.title}</p>
                    <p className="text-sm text-muted-foreground">{badge.description}</p>
                  </div>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>

        <div className="space-y-4">
          <div>
            <CardTitle>Performance Charts</CardTitle>
            <CardDescription>Your profit trends over time and per game</CardDescription>
          </div>
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            <RunningTotalsChart
              games={games}
              cumulative
              userId={user.id}
              title="Overall Running Total"
              description="Your bankroll over time"
            />
            <RunningTotalsChart
              games={games}
              cumulative={false}
              userId={user.id}
              title="Per-Game Totals"
              description="Profit/loss by game date"
            />
          </div>
        </div>

        <Card>
          <CardHeader>
            <CardTitle>Groups</CardTitle>
            <CardDescription>Groups you belong to</CardDescription>
          </CardHeader>
          <CardContent>
            {groups.length === 0 ? (
              <div className="text-muted-foreground">You are not in any groups yet.</div>
            ) : (
              <div className="space-y-3">
                {groups.map((group) => (
                  <div
                    key={group.id}
                    className="flex items-center justify-between p-3 border rounded-lg"
                  >
                    <div>
                      <p className="font-semibold">{group.name}</p>
                      {group.description && (
                        <p className="text-sm text-muted-foreground">{group.description}</p>
                      )}
                      <div className="flex items-center gap-1 text-xs text-muted-foreground mt-1">
                        <Users className="h-3 w-3" />
                        <span>{group.members.length} members</span>
                      </div>
                    </div>
                    <Link href={`/groups/${group.id}`}>
                      <Button variant="outline" size="sm">
                        View
                      </Button>
                    </Link>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <BarChart2 className="h-4 w-4" />
              <CardTitle>Group Breakdown</CardTitle>
            </div>
            <CardDescription>Your profit and rank within each group</CardDescription>
          </CardHeader>
          <CardContent>
            {groupBreakdown.length === 0 ? (
              <div className="text-muted-foreground">No group performance data yet.</div>
            ) : (
              <div className="space-y-3">
                {groupBreakdown.map((group) => (
                  <div
                    key={group.id}
                    className="flex flex-col gap-2 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-semibold">{group.name}</p>
                      <p className="text-xs text-muted-foreground">
                        {group.gamesPlayed} game{group.gamesPlayed === 1 ? '' : 's'} played
                      </p>
                    </div>
                    <div className="flex items-center gap-4">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Profit: </span>
                        <span className={`font-semibold ${group.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(group.profit)}
                        </span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Rank: </span>
                        {group.rank ? (
                          <span className="font-semibold">
                            #{group.rank} / {group.totalPlayers}
                          </span>
                        ) : (
                          <span className="text-muted-foreground">N/A</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
              <div>
                <CardTitle>Game History</CardTitle>
                <CardDescription>Every game you’ve played with buy-in and profit</CardDescription>
              </div>
              <div className="w-full md:w-64">
                <Input
                  value={historySearch}
                  onChange={(e) => setHistorySearch(e.target.value)}
                  placeholder="Search by group or date"
                />
              </div>
            </div>
          </CardHeader>
          <CardContent>
            {historyRows.length === 0 ? (
              <div className="text-muted-foreground">No games yet.</div>
            ) : (
              <div className="space-y-3">
                {filteredHistory.length === 0 && (
                  <div className="text-muted-foreground text-sm">No games match that search.</div>
                )}
                {filteredHistory.map((row) => (
                  <div
                    key={row.id}
                    className="flex flex-col gap-1 rounded-lg border p-3 md:flex-row md:items-center md:justify-between"
                  >
                    <div>
                      <p className="font-semibold">
                        {new Date(row.date).toLocaleDateString()}
                      </p>
                      <p className="text-sm text-muted-foreground">{row.groupName}</p>
                    </div>
                    <div className="flex items-center gap-6">
                      <div className="text-sm">
                        <span className="text-muted-foreground">Buy-In: </span>
                        <span className="font-medium">{formatCurrency(row.buyIn)}</span>
                      </div>
                      <div className="text-sm">
                        <span className="text-muted-foreground">Profit: </span>
                        <span className={`font-medium ${row.profit >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                          {formatCurrency(row.profit)}
                        </span>
                      </div>
                    </div>
                  </div>
                ))}
                {historyRows.length > 5 && (
                  <p className="text-xs text-muted-foreground">
                    Showing the first 5 of {historyRows.length} games.
                  </p>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader className="flex flex-col gap-2">
            <div className="flex items-center gap-2">
              <Swords className="h-4 w-4" />
              <CardTitle>Performance vs Friends</CardTitle>
            </div>
            <CardDescription>Best matchups and toughest rivals based on shared games</CardDescription>
          </CardHeader>
          <CardContent>
            {matchups.length === 0 ? (
              <div className="text-muted-foreground">No head-to-head data yet.</div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Best Matchups</h3>
                  {bestMatchups.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No positive matchups yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {bestMatchups.map((opp) => (
                        <div key={opp.id} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{opp.name}</p>
                            <p className="text-xs text-muted-foreground">{opp.games} shared games</p>
                          </div>
                          <div className="text-right">
                            <p className="font-semibold text-green-600">{formatCurrency(opp.net)}</p>
                            <p className="text-xs text-muted-foreground">
                              You: {formatCurrency(opp.userProfit)}
                              {' · '}
                              Them: {formatCurrency(opp.opponentProfit)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
                <div className="border rounded-lg p-4">
                  <h3 className="font-semibold mb-3">Rivals (most frequent & close)</h3>
                  {closestRivals.length === 0 ? (
                    <p className="text-sm text-muted-foreground">No rivalry data yet.</p>
                  ) : (
                    <div className="space-y-3">
                      {closestRivals.map((opp) => (
                        <div key={opp.id} className="flex items-center justify-between">
                          <div>
                            <p className="font-medium">{opp.name}</p>
                            <p className="text-xs text-muted-foreground">
                              {opp.games} shared games · Net: {formatCurrency(opp.net)}
                            </p>
                          </div>
                          <div className="text-right">
                            <p className={`font-semibold ${opp.net >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                              {formatCurrency(opp.net)}
                            </p>
                            <p className="text-xs text-muted-foreground">
                              You: {formatCurrency(opp.userProfit)}
                              {' · '}
                              Them: {formatCurrency(opp.opponentProfit)}
                            </p>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
