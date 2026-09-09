import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

export const supabaseConfigured = Boolean(supabaseUrl && supabaseAnonKey)
export const supabase = supabaseConfigured ? createClient(supabaseUrl, supabaseAnonKey) : null

export type UserRole = 'owner' | 'user'

export async function getUserRole(userId: string | undefined): Promise<UserRole> {
  if (!supabase || !userId) return 'user'

  const { data, error } = await supabase.from('profiles').select('role').eq('id', userId).maybeSingle()
  if (error) {
    const message = [error.message, error.details, error.hint, error.code].filter(Boolean).join(' — ')
    throw new Error(message || 'Unable to load account role.')
  }
  return data?.role === 'owner' ? 'owner' : 'user'
}
