import { createClient } from '@supabase/supabase-js';

let rawUrl = (import.meta.env.VITE_SUPABASE_URL || '').trim();
const supabaseKey = (import.meta.env.VITE_SUPABASE_ANON_KEY || '').trim();

if (rawUrl) {
  if (!rawUrl.startsWith('http')) {
    rawUrl = 'https://' + rawUrl;
  }
  if (rawUrl.endsWith('/rest/v1/')) {
    rawUrl = rawUrl.replace('/rest/v1/', '');
  } else if (rawUrl.endsWith('/rest/v1')) {
    rawUrl = rawUrl.replace('/rest/v1', '');
  }
}

export const isSupabaseConfigured = !!(
  rawUrl && 
  rawUrl.startsWith('https://') &&
  supabaseKey && 
  supabaseKey.length > 20 &&
  !rawUrl.includes('YOUR_')
);

export const supabase = isSupabaseConfigured
  ? createClient(rawUrl, supabaseKey)
  : null;
