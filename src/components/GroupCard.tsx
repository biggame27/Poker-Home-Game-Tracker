'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { deleteGroup, getGamesByGroup, updateGroup } from '@/lib/supabase/storage'
import type { Group } from '@/types'
import { Users, Calendar, ArrowRight, EllipsisVertical, Pencil, Trash2 } from 'lucide-react'
import { format } from 'date-fns'
import { useUser } from '@clerk/nextjs'

interface GroupCardProps {
  group: Group
  onChange?: () => void
}

export function GroupCard({ group, onChange }: GroupCardProps) {
  const [games, setGames] = useState<any[]>([])
  const [loading, setLoading] = useState(true)
  const [menuOpen, setMenuOpen] = useState(false)
  const [working, setWorking] = useState<'rename' | 'delete' | null>(null)
  const { user } = useUser()
  const menuRef = useRef<HTMLDivElement | null>(null)

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
  const isOwner = user?.id === group.createdBy

  useEffect(() => {
    if (!menuOpen) return
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }
    document.addEventListener('mousedown', handleClickOutside)
    document.addEventListener('keydown', handleEscape)
    return () => {
      document.removeEventListener('mousedown', handleClickOutside)
      document.removeEventListener('keydown', handleEscape)
    }
  }, [menuOpen])

  const handleRename = async () => {
    if (!isOwner) return
    const nextName = typeof window !== 'undefined'
      ? window.prompt('Rename group to:', group.name)
      : null
    if (!nextName || nextName.trim() === '' || nextName === group.name) {
      setMenuOpen(false)
      return
    }
    setWorking('rename')
    try {
      const updated = await updateGroup({ ...group, name: nextName.trim() })
      if (updated) {
        onChange?.()
      } else {
        alert('Failed to rename group. Please try again.')
      }
    } catch (error) {
      console.error('Error renaming group:', error)
      alert('Failed to rename group. Please try again.')
    } finally {
      setWorking(null)
      setMenuOpen(false)
    }
  }

  const handleDelete = async () => {
    if (!isOwner) return
    const confirmed = typeof window === 'undefined'
      ? true
      : window.confirm('Delete this group and all its games? This cannot be undone.')
    if (!confirmed) {
      setMenuOpen(false)
      return
    }

    setWorking('delete')
    try {
      const success = await deleteGroup(group.id, user?.id || '')
      if (success) {
        onChange?.()
      } else {
        alert('Failed to delete group. Please try again.')
      }
    } catch (error) {
      console.error('Error deleting group:', error)
      alert('Failed to delete group. Please try again.')
    } finally {
      setWorking(null)
      setMenuOpen(false)
    }
  }

  return (
    <Card className="hover:shadow-md transition-shadow relative">
      <CardHeader>
        <div className="flex items-start justify-between">
          <div className="flex-1">
            <CardTitle className="mb-1">{group.name}</CardTitle>
            {group.description && (
              <CardDescription>{group.description}</CardDescription>
            )}
          </div>
          {isOwner && (
            <div className="relative" ref={menuRef}>
              <Button
                variant="ghost"
                size="icon"
                className="h-9 w-9"
                onClick={() => setMenuOpen(prev => !prev)}
                aria-label="Group actions"
                disabled={working !== null}
              >
                <EllipsisVertical className="h-4 w-4" />
              </Button>
              {menuOpen && (
                <div className="absolute right-0 mt-2 w-44 rounded-md border bg-background shadow-lg z-10">
                  <button
                    className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm hover:bg-muted"
                    onClick={handleRename}
                    disabled={working === 'rename'}
                  >
                    <Pencil className="h-4 w-4" />
                    {working === 'rename' ? 'Renaming...' : 'Rename'}
                  </button>
                  <button
                    className="w-full flex items-center gap-2 text-left px-3 py-2 text-sm text-red-600 hover:bg-muted"
                    onClick={handleDelete}
                    disabled={working === 'delete'}
                  >
                    <Trash2 className="h-4 w-4" />
                    {working === 'delete' ? 'Deleting...' : 'Delete'}
                  </button>
                </div>
              )}
            </div>
          )}
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

