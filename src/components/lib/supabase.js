import { createClient } from '@supabase/supabase-js'

const supabaseUrl = 'https://udvultgvkyeyiytievlx.supabase.co'
const supabaseAnonKey = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVkdnVsdGd2a3lleWl5dGlldmx4Iiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTg4NDU0MDIsImV4cCI6MjA3NDQyMTQwMn0.sdsp848nsHcWuO9RCBWlxLsSn-l_O-LSgA0erjaoy3I'

export const supabase = createClient(supabaseUrl, supabaseAnonKey)
