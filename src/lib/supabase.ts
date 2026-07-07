import { createClient } from '@supabase/supabase-js';

const supabaseUrl = ((import.meta as any).env.VITE_SUPABASE_URL || '').trim();
const supabaseKey = ((import.meta as any).env.VITE_SUPABASE_ANON_KEY || '').trim();

// Ensure the URL is valid, non-placeholder, and starts with https://
export const isSupabaseConfigured = !!(
  supabaseUrl &&
  supabaseKey &&
  supabaseUrl.startsWith('https://') &&
  !supabaseUrl.includes('YOUR_') &&
  !supabaseUrl.includes('MY_') &&
  supabaseUrl !== 'undefined' &&
  supabaseUrl !== 'null' &&
  supabaseKey !== 'undefined' &&
  supabaseKey !== 'null'
);

// Safely initialize the Supabase client
export const supabase = isSupabaseConfigured
  ? createClient(supabaseUrl, supabaseKey)
  : null;

