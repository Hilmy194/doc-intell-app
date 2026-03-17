const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
// Service Role Key bypasses RLS — required for backend storage/DB access
const SUPABASE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn('[supabase] SUPABASE_SERVICE_ROLE_KEY not set — storage may fail due to RLS');
}

module.exports = createClient(SUPABASE_URL, SUPABASE_KEY, { auth: { persistSession: false } });
