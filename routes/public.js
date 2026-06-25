// Serves static event content (JSON files in /data).
// Files are read ONCE at startup and served from memory — no per-request disk I/O.
const fs = require('fs');
const path = require('path');
const express = require('express');

const router = express.Router();
const DATA_DIR = path.join(__dirname, '..', 'data');

// Pre-load all files into memory at boot time.
const _cache = {};
['rundown.json', 'visits.json', 'speakers.json', 'checkin.json', 'contact.json', 'hotels.json'].forEach((file) => {
  try {
    _cache[file] = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
  } catch (e) {
    _cache[file] = null;
    console.warn(`[data] Could not load ${file}:`, e.message);
  }
});

function serveJson(file) {
  return (req, res) => {
    const data = _cache[file];
    if (!data) return res.status(500).json({ error: `Could not load ${file}` });
    res.setHeader('Content-Type', 'application/json');
    // Cache 5 min on client / CDN, serve stale up to 10 min while revalidating.
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.send(data);
  };
}

router.get('/rundown',  serveJson('rundown.json'));
router.get('/visits',   serveJson('visits.json'));
router.get('/speakers', serveJson('speakers.json'));
router.get('/checkin',  serveJson('checkin.json'));
router.get('/contact',  serveJson('contact.json'));
router.get('/hotel', (req, res) => {
  const raw = _cache['hotels.json'];
  if (!raw) return res.status(500).json({ error: 'Could not load hotels.json' });
  try {
    const data = JSON.parse(raw);
    const hotels = data.hotels || {};
    const hotel = Object.values(hotels)[0] || null;
    res.setHeader('Content-Type', 'application/json');
    res.setHeader('Cache-Control', 'public, max-age=300, stale-while-revalidate=600');
    res.json({ hotel });
  } catch (e) {
    res.status(500).json({ error: 'Malformed hotels.json' });
  }
});

module.exports = router;
