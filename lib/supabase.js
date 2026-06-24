// Supabase clients + auth middleware.
// - `anonClient`     : public key, used to verify a delegate's JWT.
// - `serviceClient`  : SECRET service-role key, server-only, bypasses RLS.
//                      Used by seed-delegates.js and trusted server reads.
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_ANON_KEY = process.env.SUPABASE_ANON_KEY;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function makeClient(key, label) {
  if (!SUPABASE_URL || !key) {
    console.warn(`[supabase] ${label} client not configured (missing URL or key).`);
    return null;
  }
  return createClient(SUPABASE_URL, key, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
}

const anonClient = makeClient(SUPABASE_ANON_KEY, 'anon');
const serviceClient = makeClient(SUPABASE_SERVICE_ROLE_KEY, 'service-role');

// Express middleware: verifies the Bearer JWT and attaches req.user.
async function requireAuth(req, res, next) {
  if (!anonClient) {
    return res.status(503).json({ error: 'Auth not configured' });
  }
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) {
    return res.status(401).json({ error: 'Missing token' });
  }
  try {
    const { data, error } = await anonClient.auth.getUser(token);
    if (error || !data || !data.user) {
      return res.status(401).json({ error: 'Invalid token' });
    }
    req.user = data.user;
    req.accessToken = token;
    next();
  } catch (err) {
    console.error('[auth] verification failed', err);
    res.status(401).json({ error: 'Auth failed' });
  }
}

module.exports = { anonClient, serviceClient, requireAuth };
