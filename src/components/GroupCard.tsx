'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { getGamesByGroup } from '@/lib/supabase/storage'
import type { Group } from '@/types'
import { Users, Calendar, ArrowRight } from 'lucide-react'
import { format } from 'date-fns'

interface GroupCardProps {
  group: Group
}

export function GroupCard({ group }: GroupCardProps) {
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    loadGames()
  }, [group.id])

  const loadGames = async () => {
    try {
      const groupGames = await getGamesByGroup(group.id)
      setGames(groupGames)
    } catch (error) {
      console.error('Error loading games:', error)
    } finally {
      setLoading(false)
    }
  }

  const totalGames = games.length
  const memberCount = group.members.length

  // Calculate total profit for the group
  const totalProfit = games.reduce((sum, game) => {
    return sum + game.sessions.reduce((s: number, session: any) => s + (session.profit || 0), 0)
  }, 0)

  return (
    <Card className="hover:shadow-md transition-shadow">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="mb-1">{group.name}</CardTitle>
            {group.description && (
              <CardDescription>{group.description}</CardDescription>
            )}
          </div>
        </div>
      </CardHeader>
      <CardContent>
        <div className="space-y-4">
          <div className="flex items-center gap-4 text-sm text-muted-foreground">
            <div className="flex items-center gap-1">
              <Users className="h-4 w-4" />
              <span>{memberCount} member{memberCount !== 1 ? 's' : ''}</span>
            </div>
            <div className="flex items-center gap-1">
              <Calendar className="h-4 w-4" />
              <span>{totalGames} game{totalGames !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {totalGames > 0 && (
            <div className="pt-2 border-t">
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">Total Profit</span>
                <span className={`font-semibold ${
                  totalProfit >= 0 ? 'text-green-600' : 'text-red-600'
                }`}>
                  ${totalProfit.toFixed(2)}
                </span>
              </div>
            </div>
          )}

          <Link href={`/groups/${group.id}`}>
            <Button variant="outline" className="w-full gap-2">
              View Group
              <ArrowRight className="h-4 w-4" />
            </Button>
          </Link>
        </div>
      </CardContent>
    </Card>
  )
}

