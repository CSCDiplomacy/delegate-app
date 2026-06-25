#!/usr/bin/env node
// One-time script: reads delegates.csv, generates a password for each row,
// and writes the CSV back with a new "Password" column.
// Safe to re-run: if a "Password" column already exists, existing non-empty
// passwords are kept; only blank ones get a new value.

const fs = require('fs');
const crypto = require('crypto');
const path = require('path');

const csvPath = process.argv[2] || path.join(__dirname, '../delegates.csv');

function genPassword() {
  return crypto.randomBytes(12).toString('base64url').slice(0, 16);
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

function csvEscape(v) {
  const s = (v ?? '').toString();
  return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

const raw = fs.readFileSync(csvPath, 'utf8');
const lines = raw.split(/\r?\n/);

// Find first non-empty line as header
let headerIdx = 0;
while (headerIdx < lines.length && lines[headerIdx].trim() === '') headerIdx++;

const headerCells = splitCsvLine(lines[headerIdx]);

// Add Password column if missing
let pwdIdx = headerCells.findIndex(h => h.trim().toLowerCase() === 'password');
if (pwdIdx === -1) {
  headerCells.push('Password');
  pwdIdx = headerCells.length - 1;
}

const outLines = [];
outLines.push(headerCells.map(csvEscape).join(','));

for (let i = headerIdx + 1; i < lines.length; i++) {
  const line = lines[i];
  if (line.trim() === '') {
    // preserve trailing blank lines
    outLines.push('');
    continue;
  }
  const cells = splitCsvLine(line);
  // Pad to header length
  while (cells.length < headerCells.length) cells.push('');
  // Generate password if blank
  if (!cells[pwdIdx] || cells[pwdIdx].trim() === '') {
    cells[pwdIdx] = genPassword();
  }
  outLines.push(cells.map(csvEscape).join(','));
}

fs.writeFileSync(csvPath, outLines.join('\n'), 'utf8');
console.log(`Done. ${outLines.length - 1} rows written to ${csvPath}`);
