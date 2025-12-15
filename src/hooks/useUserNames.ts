import { useState, useEffect } from 'react'

export function useUserNames(userIds: string[]) {
  const [userNames, setUserNames] = useState<Record<string, string>>({})
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    if (userIds.length === 0) {
      setLoading(false)
      return
    }

    const fetchUserNames = async () => {
      try {
        const names: Record<string, string> = {}
        
        // Fetch names for each user
        await Promise.all(
          userIds.map(async (userId) => {
            try {
              const response = await fetch(`/api/users/${userId}`)
              if (response.ok) {
                const data = await response.json()
                names[userId] = data.displayName || userId
              } else {
                names[userId] = userId
              }
            } catch (error) {
              console.error(`Error fetching user ${userId}:`, error)
              names[userId] = userId
            }
          })
        )
        
        setUserNames(names)
      } catch (error) {
        console.error('Error fetching user names:', error)
      } finally {
        setLoading(false)
      }
    }

    fetchUserNames()
  }, [userIds.join(',')])

  return { userNames, loading }
}

