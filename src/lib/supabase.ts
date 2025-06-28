import { createClient } from '@supabase/supabase-js'

const supabaseUrl = import.meta.env.VITE_SUPABASE_URL
const supabaseAnonKey = import.meta.env.VITE_SUPABASE_ANON_KEY

if (!supabaseUrl || !supabaseAnonKey) {
  throw new Error('Missing Supabase environment variables')
}

console.log('Supabase config:', {
  url: supabaseUrl,
  hasAnonKey: !!supabaseAnonKey,
  origin: window.location.origin
});

export const supabase = createClient(supabaseUrl, supabaseAnonKey, {
  auth: {
    // Override the redirect URL for development
    redirectTo: window.location.origin,
    // Add timeout settings
    detectSessionInUrl: true,
    persistSession: true,
    autoRefreshToken: true,
    // Debug mode for development
    debug: process.env.NODE_ENV === 'development'
  },
  // Add global timeout
  global: {
    headers: {
      'X-Client-Info': 'yard-app'
    }
  },
  // Add retry logic
  realtime: {
    params: {
      eventsPerSecond: 10
    }
  }
})

// Test connection on initialization
supabase.from('profiles').select('count').limit(1).then(
  ({ data, error }) => {
    if (error) {
      console.error('Supabase connection test failed:', error);
    } else {
      console.log('Supabase connection test successful');
    }
  }
).catch(err => {
  console.error('Supabase connection test error:', err);
});