// node-cron job: scans the rundown each minute and, ~1 hour before each
// `notify:true` item, emails all delegates a reminder via Resend.
//
// This is the universal backstop channel (works even when the app is closed).
// It is a no-op until RESEND_API_KEY is set AND the delegates table is populated.
//
// Reminders are computed from rundown.json, not stored as rows. A small
// in-memory set prevents re-sending within a single process lifetime.
const fs = require('fs');
const path = require('path');
const cron = require('node-cron');
const { serviceClient } = require('./supabase');

const RUNDOWN_PATH = path.join(__dirname, '..', 'data', 'rundown.json');
const LEAD_MINUTES = Number(process.env.REMINDER_LEAD_MINUTES || 60);
const FROM_EMAIL = process.env.FROM_EMAIL || 'noreply@thecscd.org';

let resend = null;
try {
  if (process.env.RESEND_API_KEY) {
    const { Resend } = require('resend');
    resend = new Resend(process.env.RESEND_API_KEY);
  }
} catch (e) {
  console.warn('[reminders] resend not available:', e.message);
}

const sent = new Set(); // keys: `${date}T${time}`

function loadRundown() {
  try {
    return JSON.parse(fs.readFileSync(RUNDOWN_PATH, 'utf8'));
  } catch (e) {
    console.error('[reminders] could not read rundown.json:', e.message);
    return null;
  }
}

// Returns the current time as minutes-since-midnight + date string in the
// rundown's timezone, using Intl so we don't depend on the server TZ.
function nowInZone(timeZone) {
  const fmt = new Intl.DateTimeFormat('en-CA', {
    timeZone,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hour12: false,
  });
  const parts = Object.fromEntries(fmt.formatToParts(new Date()).map((p) => [p.type, p.value]));
  return {
    date: `${parts.year}-${parts.month}-${parts.day}`,
    minutes: Number(parts.hour) * 60 + Number(parts.minute),
  };
}

function toMinutes(hhmm) {
  const [h, m] = String(hhmm).split(':').map(Number);
  return h * 60 + m;
}

async function getDelegateEmails() {
  if (!serviceClient) return [];
  const { data, error } = await serviceClient.from('delegates').select('email, name');
  if (error) {
    console.error('[reminders] could not load delegates:', error.message);
    return [];
  }
  return (data || []).filter((d) => d.email);
}

async function sendReminders(item, recipients) {
  if (!resend || recipients.length === 0) return;
  const subject = `Reminder: ${item.title} starts in ${LEAD_MINUTES} min`;
  const gather = item.gather_time ? ` Please gather at ${item.gather_time}.` : '';
  const body = `Your ${item.time} session "${item.title}" at ${item.venue || 'the venue'} starts in about ${LEAD_MINUTES} minutes.${gather}`;
  // Resend allows batching via multiple recipients; send individually to keep
  // delegate emails private (BCC-style) and simple.
  for (const r of recipients) {
    try {
      await resend.emails.send({
        from: `CSCD <${FROM_EMAIL}>`,
        to: r.email,
        subject,
        text: `Hi ${r.name || 'delegate'},\n\n${body}\n\n— CSCD`,
      });
    } catch (e) {
      console.error(`[reminders] send failed to ${r.email}:`, e.message);
    }
  }
  console.log(`[reminders] sent "${item.title}" to ${recipients.length} delegate(s)`);
}

async function tick() {
  const rundown = loadRundown();
  if (!rundown) return;
  const tz = rundown.timezone || 'Asia/Jakarta';
  const { date, minutes } = nowInZone(tz);

  for (const day of rundown.days || []) {
    if (day.date !== date) continue;
    for (const item of day.items || []) {
      if (!item.notify) continue;
      const key = `${day.date}T${item.time}`;
      if (sent.has(key)) continue;
      const lead = toMinutes(item.time) - LEAD_MINUTES;
      // Fire within a 1-minute window around the lead time.
      if (minutes === lead) {
        sent.add(key);
        const recipients = await getDelegateEmails();
        await sendReminders(item, recipients);
      }
    }
  }
}

function startReminderJob() {
  if (!resend) {
    console.log('[reminders] disabled (RESEND_API_KEY not set). Cron not started.');
    return;
  }
  cron.schedule('* * * * *', () => {
    tick().catch((e) => console.error('[reminders] tick error:', e));
  });
  console.log(`[reminders] cron started (lead ${LEAD_MINUTES} min).`);
}

module.exports = { startReminderJob, tick };
