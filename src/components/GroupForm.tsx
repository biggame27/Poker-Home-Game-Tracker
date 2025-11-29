'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { createGroup, generateInviteCode } from '@/lib/supabase/storage'
import { Users } from 'lucide-react'
import { toast } from '@/lib/toast'

export function GroupForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useUser()
  const router = useRouter()
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [loading, setLoading] = useState(false)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id || !name.trim()) return

    setLoading(true)
    try {
      const inviteCode = await generateInviteCode()
      const userName = user.fullName || user.emailAddresses[0]?.emailAddress || 'Unknown'
      
      const newGroup = await createGroup(
        name.trim(),
        description.trim() || undefined,
        user.id,
        userName,
        inviteCode
      )

      if (!newGroup) {
        toast.error('Failed to create group. Please try again.')
        return
      }

      // Reset form
      setName('')
      setDescription('')
      
      toast.success('Group created successfully!')

      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/groups/${newGroup.id}`)
      }
    } catch (error) {
      console.error('Error creating group:', error)
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="name">Group Name *</Label>
        <Input
          id="name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="e.g., Friday Night Poker"
          required
        />
      </div>

      <div className="space-y-2">
        <Label htmlFor="description">Description (optional)</Label>
        <Textarea
          id="description"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          placeholder="Describe your poker group..."
          rows={3}
        />
      </div>

      <Button type="submit" disabled={loading} className="w-full gap-2">
        <Users className="h-4 w-4" />
        {loading ? 'Creating...' : 'Create Group'}
      </Button>
    </form>
  )
}

