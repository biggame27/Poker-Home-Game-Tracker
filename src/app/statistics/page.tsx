'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { RunningTotalsChart } from '@/components/RunningTotalsChart'
import { OverallStats } from '@/components/OverallStats'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { getGames, getGamesByUser } from '@/lib/supabase/storage'
import type { Game } from '@/types'

export default function StatisticsPage() {
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
          <h1 className="text-4xl font-bold tracking-tight">Statistics</h1>
          <p className="text-muted-foreground">
            View detailed statistics and trends for your poker games
          </p>
        </div>

        <Tabs value={filter} onValueChange={(v) => setFilter(v as 'all' | 'individual')}>
          <TabsList>
            <TabsTrigger value="all">All Games</TabsTrigger>
            <TabsTrigger value="individual">Individual</TabsTrigger>
          </TabsList>
        </Tabs>

        {filteredGames.length > 0 ? (
          <>
            <OverallStats games={filteredGames} />

            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <RunningTotalsChart 
                games={filteredGames} 
                cumulative={false}
                title="Running Totals by Date"
                description="Profit/loss per game date"
              />
              <RunningTotalsChart 
                games={filteredGames} 
                cumulative={true}
                title="Overall Running Total"
                description="Cumulative profit/loss over time"
              />
            </div>
          </>
        ) : (
          <div className="flex items-center justify-center h-[400px] text-center">
            <div className="space-y-2">
              <p className="text-lg font-medium">No statistics available</p>
              <p className="text-muted-foreground">
                Add your first game to see statistics and charts
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}

