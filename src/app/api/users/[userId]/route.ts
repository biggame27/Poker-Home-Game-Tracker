import { NextRequest, NextResponse } from 'next/server'
import { clerkClient } from '@clerk/nextjs/server'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ userId: string }> }
) {
  try {
    const { userId } = await params
    if (!userId) {
      return NextResponse.json(
        { error: 'User ID is required' },
        { status: 400 }
      )
    }

    console.log('Fetching user:', userId)
    const user = await clerkClient.users.getUser(userId)
    console.log('User fetched:', { firstName: user.firstName, lastName: user.lastName, email: user.emailAddresses[0]?.emailAddress })
    
    const firstName = user.firstName || ''
    const lastName = user.lastName || ''
    const displayName = firstName || lastName 
      ? `${firstName} ${lastName}`.trim()
      : user.emailAddresses[0]?.emailAddress || userId
    
    return NextResponse.json({
      displayName,
      firstName,
      lastName,
      email: user.emailAddresses[0]?.emailAddress
    })
  } catch (error: any) {
    console.error('Error fetching user:', error)
    console.error('Error details:', error?.message, error?.stack)
    return NextResponse.json(
      { error: 'Failed to fetch user', details: error?.message },
      { status: 500 }
    )
  }
}

