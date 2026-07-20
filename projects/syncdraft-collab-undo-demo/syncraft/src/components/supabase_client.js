
// import { createClient } from '@supabase/supabase-js'
// const supabaseUrl = 'https://kxxahdmrllsqgwzwfwbq.supabase.co'
// const supabaseKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imt4eGFoZG1ybGxzcWd3endmd2JxIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTY1NTU5NjksImV4cCI6MjA3MjEzMTk2OX0.HxEP81wyoEiFRh3np6e2Tt-SwWxpeHy6BTuPxipqeWk'
// export const supabase = createClient(supabaseUrl, supabaseKey)


import { createClient } from "@supabase/supabase-js"

const supabaseUrl = process.env.REACT_APP_SUPABASE_URL
const supabaseAnonKey = process.env.REACT_APP_SUPABASE_ANON_KEY

let supabase

if (supabaseUrl && supabaseAnonKey) {
  supabase = createClient(supabaseUrl, supabaseAnonKey)
} else {
  // Fallback mock client for local UI preview without real Supabase auth
  supabase = {
    auth: {
      getSession: async () => ({ data: { session: null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe: () => {} } } }),
    },
  }
}

export { supabase }
