'use client'

import { Suspense, useState } from 'react'
import { SimpleGameForm } from '@/components/SimpleGameForm'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { useRouter, useSearchParams } from 'next/navigation'

function NewGameContent() {
  const router = useRouter()
  const searchParams = useSearchParams()
  const groupId = searchParams.get('groupId') || undefined
  const [gameType, setGameType] = useState<'personal' | 'group'>(groupId ? 'group' : 'personal')

  const handleSuccess = () => {
    // Redirect to group page if groupId exists, otherwise dashboard
    if (groupId) {
      router.push(`/groups/${groupId}`)
    } else {
      router.push('/')
    }
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-4xl mx-auto p-4 md:p-8">
        <div className="space-y-6">
          <div className="space-y-2">
            <h1 className="text-4xl font-bold tracking-tight">Add New Game</h1>
            <p className="text-muted-foreground">
              Enter the details of your poker game session
            </p>
          </div>

          <Card>
            <CardHeader>
              <CardTitle>Game Details</CardTitle>
              <CardDescription>
                Fill in the information for all players in this game
              </CardDescription>
            </CardHeader>
            <CardContent>
              <Tabs value={gameType} onValueChange={(value) => setGameType(value as 'personal' | 'group')} className="w-full">
                <TabsList className="grid w-full grid-cols-2 mb-6">
                  <TabsTrigger value="personal">Personal Game</TabsTrigger>
                  <TabsTrigger value="group">Group Game</TabsTrigger>
                </TabsList>
                <TabsContent value="personal">
                  <SimpleGameForm onSuccess={handleSuccess} gameType="personal" />
                </TabsContent>
                <TabsContent value="group">
                  <SimpleGameForm onSuccess={handleSuccess} defaultGroupId={groupId} gameType="group" />
                </TabsContent>
              </Tabs>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

export default function NewGamePage() {
  return (
    <Suspense fallback={
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    }>
      <NewGameContent />
    </Suspense>
  )
}
