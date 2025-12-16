'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { updateUserName, getGroupById } from '@/lib/supabase/storage'
import { ArrowLeft } from 'lucide-react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'

export default function SettingsPage() {
  const { user, isLoaded } = useUser()
  const router = useRouter()
  const [userName, setUserName] = useState('')
  const [saving, setSaving] = useState(false)
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (isLoaded && user?.id) {
      loadCurrentName()
    }
  }, [isLoaded, user?.id])

  const loadCurrentName = async () => {
    if (!user?.id) return
    
    try {
      // Get user's name from their first group membership
      const supabase = (await import('@/lib/supabase/client')).createClient()
      const { data } = await supabase
        .from('group_members')
        .select('user_name')
        .eq('user_id', user.id)
        .limit(1)
        .single()
      
      if (data?.user_name) {
        setUserName(data.user_name)
      } else {
        // Fallback to Clerk name
        const name = user.fullName || 
                     (user.firstName && user.lastName ? `${user.firstName} ${user.lastName}`.trim() : '') ||
                     user.firstName || 
                     user.lastName || 
                     user.emailAddresses?.[0]?.emailAddress || 
                     'User'
        setUserName(name)
      }
    } catch (error) {
      console.error('Error loading user name:', error)
      // Fallback to Clerk name
      const name = user?.fullName || 
                   (user?.firstName && user?.lastName ? `${user.firstName} ${user.lastName}`.trim() : '') ||
                   user?.firstName || 
                   user?.lastName || 
                   user?.emailAddresses?.[0]?.emailAddress || 
                   'User'
      setUserName(name)
    } finally {
      setLoading(false)
    }
  }

  const handleSave = async () => {
    if (!user?.id) return
    
    const trimmed = userName.trim()
    if (!trimmed || trimmed.length === 0) {
      setMessage({ type: 'error', text: 'Name cannot be empty' })
      return
    }

    setSaving(true)
    setMessage(null)

    try {
      const success = await updateUserName(user.id, trimmed)
      if (success) {
        setMessage({ type: 'success', text: 'Name updated successfully!' })
        // Refresh the page after a short delay
        setTimeout(() => {
          router.refresh()
        }, 1000)
      } else {
        setMessage({ type: 'error', text: 'Failed to update name. Please try again.' })
      }
    } catch (error) {
      console.error('Error updating name:', error)
      setMessage({ type: 'error', text: 'An error occurred while updating your name.' })
    } finally {
      setSaving(false)
    }
  }

  if (!isLoaded || loading) {
    return (
      <div className="flex min-h-screen items-center justify-center">
        <div className="text-muted-foreground">Loading...</div>
      </div>
    )
  }

  if (!user) {
    return (
      <div className="min-h-screen bg-background">
        <div className="max-w-7xl mx-auto p-4 md:p-8">
          <Card>
            <CardContent className="pt-6">
              <p className="text-muted-foreground">Please sign in to access settings.</p>
            </CardContent>
          </Card>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-background">
      <div className="max-w-2xl mx-auto p-4 md:p-8 space-y-8">
        {/* Header */}
        <div className="flex items-center gap-4">
          <Link href="/">
            <Button variant="ghost" size="sm" className="gap-2">
              <ArrowLeft className="h-4 w-4" />
              Back
            </Button>
          </Link>
        </div>

        <div className="space-y-2">
          <h1 className="text-4xl font-bold tracking-tight">Settings</h1>
          <p className="text-muted-foreground">
            Manage your account settings
          </p>
        </div>

        {/* Name Settings */}
        <Card>
          <CardHeader>
            <CardTitle>Display Name</CardTitle>
            <CardDescription>
              This name will be shown across all your groups and games
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="userName">Your Name</Label>
              <Input
                id="userName"
                value={userName}
                onChange={(e) => {
                  setUserName(e.target.value)
                  setMessage(null)
                }}
                placeholder="Enter your name"
                disabled={saving}
              />
            </div>
            
            {message && (
              <div className={`text-sm ${
                message.type === 'success' ? 'text-green-600' : 'text-red-600'
              }`}>
                {message.text}
              </div>
            )}

            <Button 
              onClick={handleSave} 
              disabled={saving || !userName.trim()}
              className="w-full sm:w-auto"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  )
}


