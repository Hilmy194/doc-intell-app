// Supabase client singleton — shared across all services
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;

// Backend MUST use the Service Role Key so storage & DB operations
// bypass Row-Level Security policies. Never expose this key to the browser.
const SUPABASE_KEY =
  process.env.SUPABASE_SERVICE_ROLE_KEY ||
  process.env.SUPABASE_ANON_KEY;

if (!SUPABASE_URL || !SUPABASE_KEY) {
  console.error('[supabase] Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in environment');
  process.exit(1);
}

if (!process.env.SUPABASE_SERVICE_ROLE_KEY) {
  console.warn(
    '[supabase] WARNING: SUPABASE_SERVICE_ROLE_KEY is not set. ' +
    'Falling back to anon key — storage uploads may fail due to RLS policies.'
  );
}

const supabase = createClient(SUPABASE_URL, SUPABASE_KEY, {
  auth: { persistSession: false },
});

module.exports = supabase;
