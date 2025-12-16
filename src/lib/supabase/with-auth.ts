import { auth } from '@clerk/nextjs/server'
import { createClient } from './server'

export async function getSupabaseWithAuth() {
  const { userId } = await auth()
  const supabase = await createClient()
  
  return { supabase, userId }
}










