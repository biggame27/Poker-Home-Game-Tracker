'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Leaderboard } from '@/components/Leaderboard'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getGames, getGamesByUser } from '@/lib/supabase/storage'
import type { Game } from '@/types'

export default function LeaderboardPage() {
  const { user, isLoaded } = useUser()
  const [allGames, setAllGames] = useState<Game[]>([])
  const [filteredGames, setFilteredGames] = useState<Game[]>([])
  const [filter, setFilter] = useState<'all' | 'individual'>('all')
  const [loading, setLoading] = useState(true)
  const [loadingFiltered, setLoadingFiltered] = useState(false)

  useEffect(() => {
    if (isLoaded && user?.id) {
      loadGames()
    }
  }, [isLoaded, user?.id])

  const loadGames = async () => {
    if (!user?.id) return
    setLoading(true)
    try {
      const userGames = await getGames(user.id)
      setAllGames(userGames)
      setFilteredGames(userGames)
    } catch (error) {
      console.error('Error loading games:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (filter === 'individual' && user?.id) {
      loadIndividualGames()
    } else {
      setFilteredGames(allGames)
    }
  }, [filter, allGames, user?.id])

  const loadIndividualGames = async () => {
    if (!user?.id) return
    setLoadingFiltered(true)
    try {
      const individualGames = await getGamesByUser(user.id)
      setFilteredGames(individualGames)
    } catch (error) {
      console.error('Error loading individual games:', error)
    } finally {
      setLoadingFiltered(false)
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="flex flex-col items-center gap-3">
          <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
          <div className="text-muted-foreground">Loading leaderboard...</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Leaderboard</h1>
          <p className="text-muted-foreground">
            Player rankings based on total profit and performance
          </p>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'individual')}>
          <TabsList>
            <TabsTrigger value="all">All Players</TabsTrigger>
            <TabsTrigger value="individual">My Stats</TabsTrigger>
          </TabsList>
        </Tabs>

        {loadingFiltered ? (
          <div className="flex items-center justify-center h-[400px]">
            <div className="flex flex-col items-center gap-3">
              <div className="h-8 w-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
              <div className="text-muted-foreground">Loading stats...</div>
            </div>
          </div>
        ) : (
          <Leaderboard games={filteredGames} />
        )}
      </div>
    </div>
  )
}

