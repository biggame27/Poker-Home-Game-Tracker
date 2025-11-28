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

  useEffect(() => {
    if (isLoaded && user?.id) {
      loadGames()
    }
  }, [isLoaded, user?.id])

  const loadGames = async () => {
    if (!user?.id) return
    try {
      const userGames = await getGames(user.id)
      setAllGames(userGames)
      setFilteredGames(userGames)
    } catch (error) {
      console.error('Error loading games:', error)
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
    try {
      const individualGames = await getGamesByUser(user.id)
      setFilteredGames(individualGames)
    } catch (error) {
      console.error('Error loading individual games:', error)
    }
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

        <Leaderboard games={filteredGames} />
      </div>
    </div>
  )
}

