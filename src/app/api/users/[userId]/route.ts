import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  let userId: string | undefined
  try {
    const resolvedParams = await params
    userId = resolvedParams.userId
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    console.log('Fetching user:', userId)
    
    // Use Clerk client instance
    const client = await clerkClient()
    const user = await client.users.getUser(userId)
    
    // Get first and last name from Clerk user object
    const firstName = user.firstName || ''
    const lastName = user.lastName || ''
    
    // Try fullName as fallback, or use email, or finally userId
    let displayName = ''
    if (firstName || lastName) {
      displayName = `${firstName} ${lastName}`.trim()
    } else if (user.fullName) {
      displayName = user.fullName
    } else {
      // Fallback to email or username if available
      displayName = user.emailAddresses[0]?.emailAddress || 
                   user.username || 
                   userId
    }
    
    console.log('User fetched:', { 
      firstName, 
      lastName, 
      fullName: user.fullName,
      displayName,
      email: user.emailAddresses[0]?.emailAddress 
    })
    
    return NextResponse.json({
      displayName,
      firstName,
      lastName,
      fullName: user.fullName || displayName,
      email: user.emailAddresses[0]?.emailAddress
    })
  } catch (error: any) {
    console.error('Error fetching user:', error)
    console.error('Error details:', {
      message: error?.message,
      status: error?.status,
      statusText: error?.statusText,
      errors: error?.errors,
      stack: error?.stack
    })
    
    // Return a more helpful error message
    const errorMessage = error?.message || 'Unknown error occurred'
    const errorStatus = error?.status || 500
    
    return NextResponse.json(
      { 
        error: 'Failed to fetch user', 
        details: errorMessage,
        userId: userId
      },
      { status: errorStatus >= 400 && errorStatus < 600 ? errorStatus : 500 }
    )
  }
}

