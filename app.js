// CSCD Delegate App — Express entry point (Hostinger Passenger startup file)
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
    eventName: process.env.EVENT_NAME || 'CSCD Delegate App',
  });
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
  console.log(`CSCD Delegate App listening on :${PORT}`);
  // Email reminder cron (no-op if Resend isn't configured yet).
  startReminderJob();
});

module.exports = app;
