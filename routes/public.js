// Serves the static event content (JSON files in /data). No auth required.
// These are read once and cached in-memory; editing a file + restarting the
// app refreshes them (documented "edit JSON -> restart" flow).
const fs = require('fs');
const path = require('path');
const express = require('express');

const router = express.Router();
const DATA_DIR = path.join(__dirname, '..', 'data');

function serveJson(file) {
  return (req, res) => {
    try {
      const raw = fs.readFileSync(path.join(DATA_DIR, file), 'utf8');
      res.type('application/json').send(raw);
    } catch (e) {
      res.status(500).json({ error: `Could not load ${file}` });
    }
  };
}

router.get('/rundown', serveJson('rundown.json'));
router.get('/visits', serveJson('visits.json'));
router.get('/speakers', serveJson('speakers.json'));
router.get('/checkin', serveJson('checkin.json'));
router.get('/contact', serveJson('contact.json'));

module.exports = router;
