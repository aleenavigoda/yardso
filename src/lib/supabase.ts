import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Override the redirect URL for development
    redirectTo: window.location.origin,
    // Add retry configuration
    autoRefreshToken: true,
    persistSession: true,
    detectSessionInUrl: true
  },
  // Add global configuration for better error handling
  global: {
    headers: {
      'x-client-info': 'yard-app'
    }
  }
})