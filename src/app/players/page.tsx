'use client'

import { useState } from 'react'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'
import { searchPlayers } from '@/lib/supabase/storage'
import type { PlayerProfile } from '@/types'
import { Search, User } from 'lucide-react'
import Link from 'next/link'

export default function PlayersPage() {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<PlayerProfile[]>([])
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSearch = async () => {
    setError(null)
    setLoading(true)
    try {
      const data = await searchPlayers(query)
      setResults(data)
    } catch (err) {
      console.error('Error searching players', err)
      setError('Unable to search right now. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 md:p-8 space-y-6">
        <div className="space-y-2">
          <h1 className="text-3xl font-bold tracking-tight">Find Players</h1>
          <p className="text-muted-foreground">Search the player directory to view profiles.</p>
        </div>

        <Card>
          <CardHeader className="flex flex-col gap-2 md:flex-row md:items-center md:justify-between">
            <div>
              <CardTitle>Search</CardTitle>
              <CardDescription>Search by name or email</CardDescription>
            </div>
            <div className="flex w-full flex-col gap-2 md:flex-row md:w-auto">
              <Input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Enter name or email"
                className="md:w-72"
                onKeyDown={(e) => {
                  if (e.key === 'Enter') handleSearch()
                }}
              />
              <Button onClick={handleSearch} disabled={loading}>
                <Search className="h-4 w-4 mr-2" />
                {loading ? 'Searching...' : 'Search'}
              </Button>
            </div>
          </CardHeader>
          <CardContent>
            {error && <p className="text-sm text-red-600">{error}</p>}
            {results.length === 0 && !loading && !error && (
              <p className="text-sm text-muted-foreground">No players found. Try a different search.</p>
            )}
            <div className="space-y-3">
              {results.map((player) => (
                <Link key={player.id} href={`/players/${player.clerkId}`}>
                  <div className="flex items-center justify-between rounded-lg border p-3 hover:bg-muted/50 transition">
                    <div className="flex items-center gap-3">
                      <div className="h-9 w-9 rounded-full bg-muted flex items-center justify-center">
                        <User className="h-4 w-4 text-muted-foreground" />
                      </div>
                      <div>
                        <p className="font-semibold">{player.fullName}</p>
                        <p className="text-sm text-muted-foreground">{player.email || 'No email'}</p>
                      </div>
                    </div>
                    <div className="text-xs text-muted-foreground">
                      ID: {player.clerkId}
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
