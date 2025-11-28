'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'
import { GroupForm } from '@/components/GroupForm'
import { JoinGroupForm } from '@/components/JoinGroupForm'
import { GroupCard } from '@/components/GroupCard'
import { getGroups } from '@/lib/supabase/storage'
import type { Group } from '@/types'
import { Users, Plus, UserPlus } from 'lucide-react'

export default function GroupsPage() {
  const { user, isLoaded } = useUser()
  const [groups, setGroups] = useState<Group[]>([])

  useEffect(() => {
    if (isLoaded && user?.id) {
      loadGroups()
    }
  }, [isLoaded, user?.id])

  const loadGroups = async () => {
    if (!user?.id) return
    try {
      const userGroups = await getGroups(user.id)
      setGroups(userGroups)
    } catch (error) {
      console.error('Error loading groups:', error)
    }
  }

  if (!isLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-7xl mx-auto p-4 md:p-8 space-y-8">
        {/* Header */}
        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Groups</h1>
          <p className="text-muted-foreground">
            Create or join poker groups to track games together
          </p>
        </div>

        {/* Create/Join Tabs */}
        <Card>
          <CardHeader>
            <CardTitle>Create or Join a Group</CardTitle>
            <CardDescription>
              Create a new group or join an existing one with an invite code
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Tabs defaultValue="create" className="w-full">
              <TabsList className="grid w-full grid-cols-2">
                <TabsTrigger value="create" className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Group
                </TabsTrigger>
                <TabsTrigger value="join" className="gap-2">
                  <UserPlus className="h-4 w-4" />
                  Join Group
                </TabsTrigger>
              </TabsList>
              <TabsContent value="create" className="mt-6">
                <GroupForm onSuccess={loadGroups} />
              </TabsContent>
              <TabsContent value="join" className="mt-6">
                <JoinGroupForm onSuccess={loadGroups} />
              </TabsContent>
            </Tabs>
          </CardContent>
        </Card>

        {/* User's Groups */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h2 className="text-2xl font-semibold">Your Groups</h2>
            <div className="flex items-center gap-2 text-sm text-muted-foreground">
              <Users className="h-4 w-4" />
              <span>{groups.length} group{groups.length !== 1 ? 's' : ''}</span>
            </div>
          </div>

          {groups.length > 0 ? (
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {groups.map((group) => (
                <GroupCard key={group.id} group={group} />
              ))}
            </div>
          ) : (
            <Card>
              <CardContent className="pt-6">
                <div className="flex flex-col items-center justify-center py-12 text-center">
                  <Users className="h-12 w-12 text-muted-foreground mb-4" />
                  <p className="text-lg font-medium mb-2">No groups yet</p>
                  <p className="text-muted-foreground">
                    Create your first group or join one above to get started!
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  )
}

