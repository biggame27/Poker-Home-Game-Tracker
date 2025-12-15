import { clerkClient } from '@clerk/nextjs/server'

export async function getUserDisplayName(userId: string): Promise<string> {
  try {
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    const firstName = user.firstName || ''
    const lastName = user.lastName || ''
    
    if (firstName || lastName) {
      return `${firstName} ${lastName}`.trim()
    }
    
    // Fallback to email if no name
    return user.emailAddresses[0]?.emailAddress || userId
  } catch (error) {
    console.error('Error fetching user:', error)
    return userId
  }
}

export async function getUserDisplayNames(userIds: string[]): Promise<Record<string, string>> {
  const names: Record<string, string> = {}
  
  try {
    const client = await clerkClient()
    const users = await client.users.getUserList({ userId: userIds })
    
    for (const user of users.data) {
      const firstName = user.firstName || ''
      const lastName = user.lastName || ''
      
      if (firstName || lastName) {
        names[user.id] = `${firstName} ${lastName}`.trim()
      } else {
        names[user.id] = user.emailAddresses[0]?.emailAddress || user.id
      }
    }
  } catch (error) {
    console.error('Error fetching users:', error)
  }
  
  return names
}

