// Dynamic data backed by Supabase: announcements (Updates feed),
// favourites (My schedule), and feedback.
//
// Reads/writes go through the service-role client on the server, but every
// per-user query is explicitly scoped by req.user.id. RLS remains the
// backstop for any direct browser access with the anon key.
const express = require('express');
const { requireAuth, serviceClient } = require('../lib/supabase');

const router = express.Router();

function ensureDb(res) {
  if (!serviceClient) {
    res.status(503).json({ error: 'Database not configured' });
    return false;
  }
  return true;
}

// --- Announcements (Updates feed) — public read of active rows --------------
router.get('/announcements', async (req, res) => {
  if (!ensureDb(res)) return;
  const { data, error } = await serviceClient
    .from('announcements')
    .select('id, title, body, pinned, created_at')
    .eq('active', true)
    .order('pinned', { ascending: false })
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ announcements: data || [] });
});

// --- Favourites (My schedule) — owner only ---------------------------------
router.get('/favourites', requireAuth, async (req, res) => {
  if (!ensureDb(res)) return;
  const { data, error } = await serviceClient
    .from('favourites')
    .select('id, session_id, created_at')
    .eq('user_id', req.user.id);
  if (error) return res.status(500).json({ error: error.message });
  res.json({ favourites: data || [] });
});

router.post('/favourites', requireAuth, async (req, res) => {
  if (!ensureDb(res)) return;
  const sessionId = (req.body && req.body.session_id || '').toString().slice(0, 200);
  if (!sessionId) return res.status(400).json({ error: 'session_id required' });
  const { data, error } = await serviceClient
    .from('favourites')
    .insert({ user_id: req.user.id, session_id: sessionId })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

router.delete('/favourites/:sessionId', requireAuth, async (req, res) => {
  if (!ensureDb(res)) return;
  const { error } = await serviceClient
    .from('favourites')
    .delete()
    .eq('user_id', req.user.id)
    .eq('session_id', req.params.sessionId);
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

// --- Usage tracking — fire-and-forget event log ----------------------------
// Records logins, PDF downloads and screen views. Scoped to the caller; the
// browser never reads this back. Best-effort: never blocks the UI.
const TRACK_TYPES = new Set(['login', 'pdf_download', 'screen_view']);
router.post('/track', requireAuth, async (req, res) => {
  if (!ensureDb(res)) return;
  const body = req.body || {};
  const eventType = (body.event_type || '').toString();
  if (!TRACK_TYPES.has(eventType)) {
    return res.status(400).json({ error: 'invalid event_type' });
  }
  const detail = body.detail != null ? body.detail.toString().slice(0, 300) : null;
  const { error } = await serviceClient
    .from('usage_events')
    .insert({ user_id: req.user.id, email: req.user.email, event_type: eventType, detail });
  if (error) return res.status(500).json({ error: error.message });
  res.status(204).end();
});

// --- Feedback — authenticated insert ---------------------------------------
router.post('/feedback', requireAuth, async (req, res) => {
  if (!ensureDb(res)) return;
  const body = req.body || {};
  const rating = Number.isInteger(body.rating) ? body.rating : null;
  const comment = (body.comment || '').toString().slice(0, 2000);
  const sessionId = (body.session_id || '').toString().slice(0, 200) || null;
  if (rating === null && !comment) {
    return res.status(400).json({ error: 'rating or comment required' });
  }
  const { data, error } = await serviceClient
    .from('feedback')
    .insert({ user_id: req.user.id, session_id: sessionId, rating, comment })
    .select()
    .single();
  if (error) return res.status(500).json({ error: error.message });
  res.status(201).json(data);
});

module.exports = router;
