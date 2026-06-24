// CIPES Delegate App — Express entry point (Hostinger Passenger startup file)
require('dotenv').config();

const path = require('path');
const express = require('express');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');

const publicRoutes = require('./routes/public');
const meRoutes = require('./routes/me');
const dataRoutes = require('./routes/data');
const { startReminderJob } = require('./lib/reminders');

const app = express();
const PORT = process.env.PORT || 3000;

// --- Security & performance -------------------------------------------------
// CSP is relaxed enough for the static front-end (inline bootstrap, Google
// Fonts, the Supabase REST/Auth endpoint) while still on by default elsewhere.
app.use(
  helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'", 'https://fonts.googleapis.com'],
        fontSrc: ["'self'", 'https://fonts.gstatic.com'],
        imgSrc: ["'self'", 'data:', 'https:'],
        connectSrc: ["'self'", 'https://*.supabase.co'],
        manifestSrc: ["'self'"],
        objectSrc: ["'none'"],
      },
    },
    crossOriginEmbedderPolicy: false,
  })
);
app.use(compression());
app.use(express.json({ limit: '100kb' }));

// Trust the host proxy (Passenger) so rate-limit / secure cookies behave.
app.set('trust proxy', 1);

// Rate-limit the API surface (static assets are untouched).
const apiLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 300,
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', apiLimiter);

// --- Config for the browser -------------------------------------------------
// Exposes ONLY the public, browser-safe values. The service-role key and
// Resend key never leave the server.
app.get('/api/config', (req, res) => {
  res.json({
    supabaseUrl: process.env.SUPABASE_URL || '',
    supabaseAnonKey: process.env.SUPABASE_ANON_KEY || '',
    eventName: process.env.EVENT_NAME || 'CIPES Delegate App',
  });
});

// --- ICS calendar event (opens native Calendar on iOS/macOS/desktop) --------
app.get('/api/ics', (req, res) => {
  const { title = 'Event', date = '', time = '09:00', venue = '', duration = '60' } = req.query;
  const dt = date.replace(/-/g, '');
  const [h, m] = time.split(':');
  const durMin = parseInt(duration, 10) || 60;
  const endTotalMin = parseInt(h, 10) * 60 + parseInt(m, 10) + durMin;
  const eh = String(Math.floor(endTotalMin / 60) % 24).padStart(2, '0');
  const em = String(endTotalMin % 60).padStart(2, '0');
  const uid = `${dt}-${h}${m}-cipes@thecipes.org`;
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//CIPES//YEF Frankfurt 2026//EN',
    'METHOD:PUBLISH',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTART:${dt}T${h}${m}00`,
    `DTEND:${dt}T${eh}${em}00`,
    `SUMMARY:${title}`,
    `LOCATION:${venue}`,
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');
  const filename = title.replace(/[^a-z0-9]/gi, '_').toLowerCase() + '.ics';
  res.setHeader('Content-Type', 'text/calendar; charset=utf-8; method=PUBLISH');
  res.setHeader('Content-Disposition', `inline; filename="${filename}"`);
  res.send(ics);
});

// --- Health -----------------------------------------------------------------
app.get('/health', (req, res) => {
  res.json({ ok: true, ts: new Date().toISOString() });
});

// --- API routes -------------------------------------------------------------
app.use('/api', publicRoutes);
app.use('/api/me', meRoutes);
app.use('/api', dataRoutes);

// --- Static front-end -------------------------------------------------------
app.use(
  express.static(path.join(__dirname, 'public'), {
    maxAge: '1h',
    setHeaders(res, filePath) {
      // Never cache the shell or the service worker so updates roll out.
      if (filePath.endsWith('index.html') || filePath.endsWith('sw.js')) {
        res.setHeader('Cache-Control', 'no-cache');
      }
    },
  })
);

// SPA fallback — any non-API GET returns the shell.
app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api')) return next();
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`CIPES Delegate App listening on :${PORT}`);
  // Email reminder cron (no-op if Resend isn't configured yet).
  startReminderJob();
});

module.exports = app;
