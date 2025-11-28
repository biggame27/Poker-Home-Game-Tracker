'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Label } from '@/components/ui/label'
import { Button } from '@/components/ui/button'
import { 
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { getGroups } from '@/lib/supabase/storage'
import type { Group } from '@/types'
import { Plus } from 'lucide-react'
import Link from 'next/link'

interface GroupSelectorProps {
  value: string
  onValueChange: (value: string) => void
  required?: boolean
}

export function GroupSelector({ value, onValueChange, required }: GroupSelectorProps) {
  const { user } = useUser()
  const [groups, setGroups] = useState<Group[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (user?.id) {
      loadGroups()
    }
  }, [user?.id])

  const loadGroups = async () => {
    if (!user?.id) return
    try {
      const userGroups = await getGroups(user.id)
      setGroups(userGroups)
    } catch (error) {
      console.error('Error loading groups:', error)
    } finally {
      setLoading(false)
    }
  }

  if (loading) {
    return <div className="text-sm text-muted-foreground">Loading groups...</div>
  }

  if (groups.length === 0) {
    return (
      <div className="space-y-2">
        <Label>Group</Label>
        <div className="flex flex-col gap-2">
          <p className="text-sm text-muted-foreground">
            You need to create or join a group first
          </p>
          <Link href="/groups">
            <Button variant="outline" size="sm" className="gap-2 w-full">
              <Plus className="h-4 w-4" />
              Create or Join Group
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-2">
      <Label htmlFor="group">Group {required && '*'}</Label>
      <Select value={value} onValueChange={onValueChange} required={required}>
        <SelectTrigger id="group">
          <SelectValue placeholder="Select a group" />
        </SelectTrigger>
        <SelectContent>
          {groups.map((group) => (
            <SelectItem key={group.id} value={group.id}>
              {group.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  )
}

