'use client'

import { useState, useEffect } from 'react'
import { useUser } from '@clerk/nextjs'

interface UserNameProps {
  userId?: string
  userName?: string
  fallback?: string
  className?: string
}

/**
 * Component that displays a user's name using Clerk's user data when available.
 * Falls back to stored userName or provided fallback.
 * Uses fullName, firstName, lastName from Clerk when available.
 */
export function UserName({ userId, userName, fallback = 'Unknown', className }: UserNameProps) {
  const { user: currentUser, isLoaded } = useUser()
  const [displayName, setDisplayName] = useState<string>(userName || fallback)

  useEffect(() => {
    if (!isLoaded) return

    // If this is the current user, use Clerk's data directly
    if (userId && currentUser?.id === userId) {
      const name = currentUser.fullName || 
                   (currentUser.firstName && currentUser.lastName ? `${currentUser.firstName} ${currentUser.lastName}`.trim() : '') ||
                   currentUser.firstName || 
                   currentUser.lastName || 
                   currentUser.emailAddresses?.[0]?.emailAddress || 
                   userName || 
                   fallback
      setDisplayName(name)
      return
    }

    // If we have a userId but it's not the current user, fetch from API
    if (userId && userId !== currentUser?.id) {
      const fetchUserName = async () => {
        try {
          const response = await fetch(`/api/users/${userId}`)
          if (response.ok) {
            const data = await response.json()
            // If API returns an error, fall back to userName
            if (data.error) {
              setDisplayName(userName || fallback)
              return
            }
            const name = data.fullName || 
                         (data.firstName && data.lastName ? `${data.firstName} ${data.lastName}`.trim() : '') ||
                         data.firstName || 
                         data.lastName || 
                         data.displayName || 
                         userName || 
                         fallback
            setDisplayName(name)
          } else {
            // Fallback to stored userName
            setDisplayName(userName || fallback)
          }
        } catch (error) {
          console.error('Error fetching user name:', error)
          // Silently fall back to stored userName
          setDisplayName(userName || fallback)
        }
      }
      fetchUserName()
    } else {
      // No userId, use stored userName or fallback
      setDisplayName(userName || fallback)
    }
  }, [userId, userName, fallback, currentUser, isLoaded])

  return <span className={className}>{displayName}</span>
}

