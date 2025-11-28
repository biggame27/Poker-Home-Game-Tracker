'use client'

import { useState } from 'react'
import { useUser } from '@clerk/nextjs'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { getGroupByInviteCode, joinGroup } from '@/lib/supabase/storage'
import { UserPlus } from 'lucide-react'

export function JoinGroupForm({ onSuccess }: { onSuccess?: () => void }) {
  const { user } = useUser()
  const router = useRouter()
  const [inviteCode, setInviteCode] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    if (!user?.id || !inviteCode.trim()) return

    setLoading(true)
    setError(null)

    try {
      const code = inviteCode.trim().toUpperCase()
      const group = await getGroupByInviteCode(code)

      if (!group) {
        setError('Invalid invite code. Please check and try again.')
        return
      }

      // Check if user is already a member
      const isMember = group.members.some(m => m.userId === user.id)
      if (isMember) {
        setError('You are already a member of this group.')
        return
      }

      // Join group
      const userName = user.fullName || user.emailAddresses[0]?.emailAddress || 'Unknown'
      const success = await joinGroup(group.id, user.id, userName)
      
      if (!success) {
        setError('Failed to join group. Please try again.')
        return
      }

      // Reset form
      setInviteCode('')
      setError(null)

      if (onSuccess) {
        onSuccess()
      } else {
        router.push(`/groups/${group.id}`)
      }
    } catch (error) {
      console.error('Error joining group:', error)
      setError('Failed to join group. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="space-y-2">
        <Label htmlFor="inviteCode">Invite Code</Label>
        <Input
          id="inviteCode"
          value={inviteCode}
          onChange={(e) => {
            setInviteCode(e.target.value.toUpperCase())
            setError(null)
          }}
          placeholder="Enter 6-character code"
          maxLength={6}
          className="uppercase"
          required
        />
        {error && (
          <p className="text-sm text-destructive">{error}</p>
        )}
        <p className="text-xs text-muted-foreground">
          Ask a group member for the invite code
        </p>
      </div>

      <Button type="submit" disabled={loading} className="w-full gap-2">
        <UserPlus className="h-4 w-4" />
        {loading ? 'Joining...' : 'Join Group'}
      </Button>
    </form>
  )
}

