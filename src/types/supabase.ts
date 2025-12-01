// TypeScript types for Supabase database
// These match the schema defined in supabase/schema.sql

export type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

export interface Database {
  public: {
    Tables: {
      users: {
        Row: {
          id: string
          clerk_id: string
          email: string | null
          full_name: string | null
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          clerk_id: string
          email?: string | null
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          clerk_id?: string
          email?: string | null
          full_name?: string | null
          created_at?: string
          updated_at?: string
        }
      }
      groups: {
        Row: {
          id: string
          name: string
          description: string | null
          invite_code: string
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          name: string
          description?: string | null
          invite_code: string
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          name?: string
          description?: string | null
          invite_code?: string
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      group_members: {
        Row: {
          id: string
          group_id: string
          user_id: string
          user_name: string
          role: 'owner' | 'member'
          joined_at: string
        }
        Insert: {
          id?: string
          group_id: string
          user_id: string
          user_name: string
          role: 'owner' | 'member'
          joined_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          user_id?: string
          user_name?: string
          role?: 'owner' | 'member'
          joined_at?: string
        }
      }
      games: {
        Row: {
          id: string
          group_id: string
          date: string
          notes: string | null
          status: 'open' | 'in-progress' | 'completed'
          created_by: string
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          group_id: string
          date: string
          notes?: string | null
          status?: 'open' | 'in-progress' | 'completed'
          created_by: string
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          group_id?: string
          date?: string
          notes?: string | null
          status?: 'open' | 'in-progress' | 'completed'
          created_by?: string
          created_at?: string
          updated_at?: string
        }
      }
      game_sessions: {
        Row: {
          id: string
          game_id: string
          player_name: string
          user_id: string | null
          buy_in: number
          end_amount: number
          profit: number
          created_at: string
          updated_at: string
        }
        Insert: {
          id?: string
          game_id: string
          player_name: string
          user_id?: string | null
          buy_in?: number
          end_amount?: number
          created_at?: string
          updated_at?: string
        }
        Update: {
          id?: string
          game_id?: string
          player_name?: string
          user_id?: string | null
          buy_in?: number
          end_amount?: number
          created_at?: string
          updated_at?: string
        }
      }
    }
  }
}



