#!/usr/bin/env node
// seed-delegates.js — one-time delegate provisioning.
//
// Reads a CSV of delegates, then for each row:
//   1. Creates a Supabase Auth user (admin API) with an auto-generated password
//      and email_confirm=true (so "sign up" = first login; no self-registration).
//   2. Upserts their profile + hotel/booking details into the `delegates` table.
//   3. Appends email,password to an output CSV for distribution.
//
// Usage:
//   node scripts/seed-delegates.js delegates.csv [credentials-out.csv]
//
// Input CSV header (UTF-8, comma-separated):
//   SR No,Full Name,Passport,Nationality,Email,Password[,frankfurt_id,hotel_id,room,booking_ref,check_in,check_out,meals]
// "Full Name", "Email", and "Password" are required; the rest may be blank.
//
// Requires SUPABASE_URL + SUPABASE_SERVICE_ROLE_KEY in the environment (.env).
// The service-role key is server-only — never ship it to the browser.
require('dotenv').config();
const fs = require('fs');
const crypto = require('crypto');
const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY in .env');
  process.exit(1);
}

const inputPath = process.argv[2];
const outputPath = process.argv[3] || 'delegate-credentials.csv';
if (!inputPath) {
  console.error('Usage: node scripts/seed-delegates.js <delegates.csv> [credentials-out.csv]');
  process.exit(1);
}

const admin = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// Minimal CSV parser (handles simple quoted fields, no embedded newlines).
function parseCsv(text) {
  const lines = text.split(/\r?\n/).filter((l) => l.trim().length > 0);
  const header = splitCsvLine(lines[0]).map((h) => h.trim());
  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    header.forEach((h, i) => (row[h] = (cells[i] || '').trim()));
    return row;
  });
}

function splitCsvLine(line) {
  const out = [];
  let cur = '';
  let inQ = false;
  for (let i = 0; i < line.length; i++) {
    const c = line[i];
    if (c === '"') {
      if (inQ && line[i + 1] === '"') { cur += '"'; i++; }
      else inQ = !inQ;
    } else if (c === ',' && !inQ) {
      out.push(cur); cur = '';
    } else cur += c;
  }
  out.push(cur);
  return out;
}

function genPassword() {
  return crypto.randomBytes(12).toString('base64url').slice(0, 16);
}

function csvEscape(v) {
  const s = (v ?? '').toString();
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

async function main() {
  const rows = parseCsv(fs.readFileSync(inputPath, 'utf8'));
  if (rows.length === 0) {
    console.error('No rows found in input CSV.');
    process.exit(1);
  }

  const creds = [['email', 'password', 'name']];
  let created = 0;
  let failed = 0;

  for (const row of rows) {
    // Support both old header style (email/name) and new style (Email / Full Name)
    const email = (row['Email'] || row['email'] || '').toLowerCase();
    const name = row['Full Name'] || row['name'] || '';
    if (!email) {
      console.warn(`Skipping row with no email: ${JSON.stringify(row)}`);
      failed++;
      continue;
    }
    // Use pre-generated password from CSV if present, otherwise generate one.
    const password = (row['Password'] || row['password'] || '').trim() || genPassword();

    // 1. Create the auth user.
    const { data: userData, error: userErr } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (userErr) {
      console.error(`✗ ${email}: ${userErr.message}`);
      failed++;
      continue;
    }
    const userId = userData.user.id;

    // 2. Upsert the profile row.
    const profile = {
      id: userId,
      name: name || null,
      email,
      frankfurt_id: row.frankfurt_id || null,
      hotel_id: row.hotel_id || null,
      room: row.room || null,
      booking_ref: row.booking_ref || null,
      check_in: row.check_in || null,
      check_out: row.check_out || null,
      meals: row.meals || null,
    };
    const { error: profErr } = await admin.from('delegates').upsert(profile, { onConflict: 'id' });
    if (profErr) {
      console.error(`✗ ${email}: profile upsert failed — ${profErr.message}`);
      failed++;
      continue;
    }

    creds.push([email, password, name]);
    created++;
    console.log(`✓ ${email}`);
  }

  // 3. Write the credentials CSV (gitignored).
  fs.writeFileSync(outputPath, creds.map((r) => r.map(csvEscape).join(',')).join('\n'));
  console.log(`\nDone. Created ${created}, failed ${failed}.`);
  console.log(`Credentials written to ${outputPath} — distribute, then delete.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
