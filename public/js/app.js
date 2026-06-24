/* CSCD Delegate App — front-end controller (Credential / boarding-pass theme).
   No framework, no build step. Supabase Auth in the browser (anon key) + the
   app's own JSON/Supabase API. Responsive: mobile drawers / desktop 3-col. */
(function () {
  'use strict';

  let sb = null, session = null, config = {};
  let rundown = null, speakers = [], profile = {}, hotelData = null;
  let favourites = new Set();
  const READ_KEY = 'cscd_read_notifications';
  const THEME_KEY = 'cscd_theme';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const el = (id) => document.getElementById(id);
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function mapsLink(q) { return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null; }

  async function api(path, opts) {
    opts = opts || {};
    const headers = Object.assign({ 'Content-Type': 'application/json' }, opts.headers || {});
    if (session && session.access_token) headers.Authorization = 'Bearer ' + session.access_token;
    const res = await fetch('/api' + path, Object.assign({}, opts, { headers }));
    if (!res.ok) throw new Error((await res.json().catch(() => ({}))).error || res.status);
    return res.status === 204 ? null : res.json();
  }
  const getJson = (p) => fetch(p).then((r) => r.json());

  // ---- time helpers (event tz) ----
  function tzNow(tz) {
    const f = new Intl.DateTimeFormat('en-CA', { timeZone: tz, year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', hour12: false });
    const p = Object.fromEntries(f.formatToParts(new Date()).map((x) => [x.type, x.value]));
    return { date: `${p.year}-${p.month}-${p.day}`, minutes: +p.hour * 60 + +p.minute };
  }
  const toMin = (t) => { const [h, m] = String(t).split(':').map(Number); return h * 60 + m; };
  function split12(t) { const [h, m] = String(t).split(':').map(Number); return { hm: `${((h + 11) % 12) + 1}:${String(m).padStart(2, '0')}`, ap: h >= 12 ? 'PM' : 'AM' }; }
  function fmt12(t) { const s = split12(t); return `${s.hm} ${s.ap}`; }

  /* ===================== THEME ===================== */
  function applyTheme(t) { document.documentElement.setAttribute('data-theme', t); localStorage.setItem(THEME_KEY, t); }
  function toggleTheme() { applyTheme(document.documentElement.getAttribute('data-theme') === 'dark' ? 'light' : 'dark'); }
  applyTheme(localStorage.getItem(THEME_KEY) || 'light');

  /* ===================== AUTH ===================== */
  async function initSupabase() {
    config = await getJson('/api/config');
    const ev = config.eventName && config.eventName !== 'CSCD Delegate App' ? config.eventName : 'Jakarta 2026';
    ['side-event', 'top-event'].forEach((id) => { if (el(id)) el(id).textContent = ev; });
    if (!config.supabaseUrl || !config.supabaseAnonKey) {
      el('login-msg').textContent = 'Auth not configured yet.'; el('login-msg').className = 'form-msg error'; return;
    }
    sb = window.supabase.createClient(config.supabaseUrl, config.supabaseAnonKey);
    if (location.hash.includes('type=recovery')) {
      const { data } = await sb.auth.getSession(); session = data.session;
      showLogin(); swapForm('newpw'); return;
    }
    const { data } = await sb.auth.getSession(); session = data.session;
    session ? enterApp() : showLogin();
    sb.auth.onAuthStateChange((_e, s) => { session = s; });
  }
  function showLogin() { el('view-login').classList.remove('hidden'); el('view-app').classList.add('hidden'); }
  function swapForm(w) { ['login', 'reset', 'newpw'].forEach((k) => el(k + '-form').classList.toggle('hidden', k !== w)); }

  async function doLogin() {
    const m = el('login-msg'); m.textContent = ''; m.className = 'form-msg';
    const email = el('email').value.trim(), password = el('password').value;
    if (!email || !password) { m.textContent = 'Enter email and password.'; m.className = 'form-msg error'; return; }
    el('btn-login').disabled = true;
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    el('btn-login').disabled = false;
    if (error) { m.textContent = error.message; m.className = 'form-msg error'; return; }
    session = data.session; enterApp();
  }
  async function doSendReset() {
    const m = el('reset-msg'); const email = el('reset-email').value.trim();
    if (!email) { m.textContent = 'Enter your email.'; m.className = 'form-msg error'; return; }
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
    if (error) { m.textContent = error.message; m.className = 'form-msg error'; return; }
    m.textContent = 'If that email exists, a reset link is on its way.'; m.className = 'form-msg ok';
  }
  async function doSetPassword() {
    const m = el('newpw-msg'); const pw = el('new-password').value;
    if (pw.length < 8) { m.textContent = 'Use at least 8 characters.'; m.className = 'form-msg error'; return; }
    const { error } = await sb.auth.updateUser({ password: pw });
    if (error) { m.textContent = error.message; m.className = 'form-msg error'; return; }
    m.textContent = 'Password updated. Signing you in…'; m.className = 'form-msg ok';
    history.replaceState(null, '', location.pathname); setTimeout(enterApp, 800);
  }
  async function doLogout() { await sb.auth.signOut(); session = null; location.reload(); }

  /* ===================== BOOT ===================== */
  async function enterApp() {
    el('view-login').classList.add('hidden'); el('view-app').classList.remove('hidden');
    await Promise.all([loadProfile(), loadRundown(), loadFavourites(), loadHotel()]);
    const nm = (profile.name || 'Delegate');
    if (el('side-user')) el('side-user').innerHTML = `<b>${esc(nm)}</b><span>${esc(profile.email || '')}</span>`;
    if (el('menu-user')) el('menu-user').innerHTML = `${esc(nm)}<span>${esc(profile.email || '')}</span>`;
    switchScreen('dashboard');
    refreshNotifications();
    setInterval(refreshNotifications, 60000);
    setInterval(() => { if (current === 'rundown') renderRundown(); if (current === 'dashboard') renderDashboard(); }, 60000);
  }
  async function loadProfile() { try { profile = await api('/me/profile'); } catch (e) { profile = { name: 'Delegate' }; } }
  async function loadRundown() { try { rundown = await getJson('/api/rundown'); } catch (e) { rundown = { days: [] }; } }
  async function loadHotel() { try { hotelData = await api('/me/hotel'); } catch (e) { hotelData = null; } }
  function saveFavsLocal() { localStorage.setItem('cscd_favs', JSON.stringify([...favourites])); }
  function loadFavsLocal() { try { return new Set(JSON.parse(localStorage.getItem('cscd_favs') || '[]')); } catch (e) { return new Set(); } }
  async function loadFavourites() {
    favourites = loadFavsLocal();
    try { const { favourites: f } = await api('/favourites'); favourites = new Set((f || []).map((x) => x.session_id)); saveFavsLocal(); } catch (e) {}
  }

  /* ===================== NAV + PASS HERO ===================== */
  let current = 'dashboard';
  const rendered = {};
  function setActiveNav(name) { $$('[data-goto]').forEach((n) => { if (n.classList.contains('nav-link') || n.classList.contains('nav-item')) n.classList.toggle('active', n.dataset.goto === name); }); }

  function switchScreen(name) {
    current = name;
    $$('.screen').forEach((s) => s.classList.toggle('active', s.dataset.screen === name));
    setActiveNav(name);
    renderPass(name);
    if (name === 'dashboard') renderDashboard();
    if (name === 'rundown') renderRundown();
    if (name === 'visits' && !rendered.visits) renderVisits();
    if (name === 'speakers') renderSpeakers();
    if (name === 'hotel') renderHotel();
    if (name === 'schedule') renderSchedule();
    if (name === 'contact' && !rendered.contact) renderContact();
    if (window.innerWidth < 960) window.scrollTo(0, 0);
  }

  function passFields(arr) {
    el('pass-fields').innerHTML = arr.map((f) =>
      `<div class="pass-field"><div class="pass-field-label">${esc(f[0])}</div><div class="pass-field-value${f[2] ? ' signal' : ''}">${esc(f[1])}</div></div>`).join('');
  }
  function renderPass(name) {
    const nm = profile.name || 'Delegate';
    const tz = (rundown && rundown.timezone) || 'Asia/Jakarta';
    const today = tzNow(tz);
    const dayIdx = rundown && rundown.days ? rundown.days.findIndex((d) => d.date === today.date) : -1;
    const dayLabel = dayIdx >= 0 ? rundown.days[dayIdx].label : '—';
    const hotelName = hotelData && hotelData.hotel ? hotelData.hotel.name : '—';
    const room = hotelData && hotelData.delegate && hotelData.delegate.room ? hotelData.delegate.room : '';
    const fid = profile.frankfurt_id || '—';
    const sets = {
      dashboard: ['Delegate credential', nm, '', [['Delegate ID', fid], ['Hotel', room ? `${hotelName.split(' ')[0]} · ${room}` : hotelName], ['Status', dayIdx >= 0 ? `${dayLabel} · Live` : 'Event soon', true]]],
      rundown: ['Programme', `${dayLabel} Rundown`, '"The week, hour by hour."', [['Days', rundown && rundown.days ? String(rundown.days.length) : '—'], ['Timezone', (tz || '').replace('Asia/', '')], ['You are', nm.split(' ')[0], true]]],
      visits: ['Institutional visits', 'Visits & Programs', '"Where the delegation calls on the city."', [['Scope', 'All delegates'], ['Maps', 'Tap to open'], ['Status', 'See list', true]]],
      speakers: ['Voices of CSCD', 'Speakers', '"The people behind the sessions."', [['Sessions', 'Linked to rundown'], ['Tap', 'For bios'], ['You are', nm.split(' ')[0], true]]],
      hotel: ['Your stay', hotelName, '"Your base for the week."', [['Room', room || '—'], ['Booking', hotelData && hotelData.delegate ? (hotelData.delegate.booking_ref || '—') : '—'], ['Check-out', hotelData && hotelData.delegate ? (hotelData.delegate.check_out || '—') : '—', true]]],
      contact: ['Coordination', 'Contact us', '"We are here to help."', [['Reach', 'Email or call'], ['Venue', 'Open in Maps'], ['Feedback', 'Welcome', true]]],
      schedule: ['My Programme', 'My Schedule', '"Sessions you starred."', [['Starred', favourites.size ? `${favourites.size} session${favourites.size !== 1 ? 's' : ''}` : 'None yet'], ['Source', 'Rundown ☆'], ['Type', 'Personal only', true]]],
    };
    const s = sets[name] || sets.dashboard;
    el('pass-eyebrow').textContent = s[0];
    el('pass-title').textContent = s[1];
    el('pass-sub').textContent = s[2];
    el('pass-sub').style.display = s[2] ? '' : 'none';
    passFields(s[3]);
  }

  /* ===================== DASHBOARD ===================== */
  function findNext() {
    if (!rundown || !rundown.days) return null;
    const tz = rundown.timezone || 'Asia/Jakarta'; const { date, minutes } = tzNow(tz);
    for (const day of rundown.days) {
      if (day.date < date) continue;
      for (const it of day.items || []) if (day.date > date || toMin(it.time) >= minutes) return { day, it };
    }
    return null;
  }
  function findNow() {
    if (!rundown || !rundown.days) return null;
    const tz = rundown.timezone || 'Asia/Jakarta'; const { date, minutes } = tzNow(tz);
    for (const day of rundown.days) {
      if (day.date !== date) continue;
      const its = day.items || [];
      for (let i = 0; i < its.length; i++) {
        const start = toMin(its[i].time), end = i + 1 < its.length ? toMin(its[i + 1].time) : start + 90;
        if (minutes >= start && minutes < end) return { day, it: its[i] };
      }
    }
    return null;
  }
  function renderDashboard() {
    const now = findNow();
    el('dash-live').innerHTML = now
      ? `<div class="live-strip" data-goto="rundown"><div class="live-strip-tag"><span class="dot"></span>Happening now</div>
         <div class="live-strip-title">${esc(now.it.title)}</div><div class="live-strip-meta">${esc(now.it.venue || '')} · ${esc(fmt12(now.it.time))}</div></div>`
      : '';
    // up next (next 2 items)
    const ups = [];
    if (rundown && rundown.days) {
      const tz = rundown.timezone || 'Asia/Jakarta'; const { date, minutes } = tzNow(tz); let count = 0;
      for (const day of rundown.days) {
        if (day.date < date) continue;
        for (const it of day.items || []) {
          if ((day.date > date || toMin(it.time) >= minutes) && count < 2) { ups.push({ day, it }); count++; }
        }
        if (count >= 2) break;
      }
    }
    el('dash-next').innerHTML = ups.length
      ? ups.map(({ day, it }) => { const s = split12(it.time); return `<div class="next-item"><div class="next-time">${esc(s.hm)}<small>${esc(s.ap)} · ${esc(day.label)}</small></div>
        <div><div class="next-title">${esc(it.title)}</div><div class="next-venue">${esc(it.venue || '')}${it.gather_time ? ` · gather ${esc(fmt12(it.gather_time))}` : ''}</div></div></div>`; }).join('')
      : '<div class="next-venue">No upcoming items yet.</div>';
    // hotel
    if (hotelData && hotelData.hotel) {
      const d = hotelData.delegate;
      el('dash-hotel').innerHTML = `<div class="card-eyebrow">${esc(hotelData.hotel.name)}<span class="link">Check-in →</span></div>
        <div class="next-venue">${d.room ? 'Room ' + esc(d.room) : ''}${d.booking_ref ? ' · #' + esc(d.booking_ref) : ''}${d.check_out ? ' · out ' + esc(d.check_out) : ''}</div>`;
    } else {
      el('dash-hotel').innerHTML = `<div class="card-eyebrow">Your hotel<span class="link">View →</span></div><div class="next-venue">Details coming soon.</div>`;
    }
    el('dash-contact').innerHTML = `<div class="card-eyebrow">Contact &amp; support<span class="link">Open →</span></div><div class="next-venue">Coordination team, venue map, feedback.</div>`;
    const sc = favourites.size;
    if (el('dash-schedule')) el('dash-schedule').innerHTML = `<div class="card-eyebrow">My programme<span class="link">View →</span></div><div class="next-venue">${sc > 0 ? `★ ${sc} session${sc !== 1 ? 's' : ''} starred` : 'No sessions starred yet — tap ☆ in the Rundown.'}</div>`;
    // latest announcement
    el('dash-update').innerHTML = `<div class="ann-title">Latest update</div><div class="ann-body" id="dash-ann">—</div>`;
    api('/announcements').then(({ announcements }) => {
      const t = el('dash-ann'); if (!t) return;
      if (announcements && announcements.length) { const a = announcements[0]; t.innerHTML = `<strong>${esc(a.title)}</strong><br>${esc(a.body)}`; }
      else t.textContent = 'No announcements yet.';
    }).catch(() => {});
  }

  /* ===================== RUNDOWN ===================== */
  let activeDay = 0;
  const brassTypes = ['keynote', 'visit', 'plenary'];
  function renderRundown() {
    if (!rundown || !rundown.days || !rundown.days.length) {
      el('timeline').innerHTML = '<div class="empty">Agenda coming soon.</div>'; el('day-tabs').innerHTML = ''; return;
    }
    const tz = rundown.timezone || 'Asia/Jakarta'; const { date, minutes } = tzNow(tz);
    if (!renderRundown._init) { const i = rundown.days.findIndex((d) => d.date === date); activeDay = i >= 0 ? i : 0; renderRundown._init = true; }
    el('day-tabs').innerHTML = rundown.days.map((d, i) => `<button class="day-tab ${i === activeDay ? 'active' : ''}" data-day="${i}">${esc(d.label)}</button>`).join('');
    const day = rundown.days[activeDay]; const isToday = day.date === date;
    let nowIdx = -1;
    if (isToday) for (let i = 0; i < day.items.length; i++) { const st = toMin(day.items[i].time), en = i + 1 < day.items.length ? toMin(day.items[i + 1].time) : st + 90; if (minutes >= st && minutes < en) { nowIdx = i; break; } }
    el('timeline').innerHTML = day.items.map((it, i) => {
      const id = `${day.date}T${it.time}`, s = split12(it.time), starred = favourites.has(id);
      const typeCls = brassTypes.includes((it.type || '').toLowerCase()) ? 't-type' : 't-type subtle';
      const map = it.venue ? mapsLink(it.venue) : null;
      return `<div class="t-item ${i === nowIdx ? 'is-now' : ''}">
        <div class="t-time">${esc(s.hm)}<small>${esc(s.ap)}</small></div>
        <div class="t-dot"></div>
        <div class="t-content">
          <span class="${typeCls}">${esc(it.type || 'item')}</span>${i === nowIdx ? '<span class="live-pill"><span class="dot"></span>Live</span>' : ''}
          <div style="display:flex;align-items:flex-start;gap:8px"><div class="t-title">${esc(it.title)}</div><button class="star-btn" data-fav="${esc(id)}">${starred ? '★' : '☆'}</button></div>
          <div class="t-venue">${esc(it.venue || '')}</div>
          ${it.gather_time ? `<div class="t-gather">Gather ${esc(fmt12(it.gather_time))}</div>` : ''}
          <div class="t-actions">
            ${map ? `<a class="chip" href="${map}" target="_blank" rel="noopener">Open in Maps</a>` : ''}
            <a class="chip" href="${icsHref(day, it)}" download="${esc(it.title)}.ics">Add to calendar</a>
          </div>
        </div>
      </div>`;
    }).join('');
  }
  function icsHref(day, it) {
    const dt = day.date.replace(/-/g, ''); const [h, m] = it.time.split(':');
    const e = toMin(it.time) + 60; const eh = String(Math.floor(e / 60) % 24).padStart(2, '0'); const em = String(e % 60).padStart(2, '0');
    const body = ['BEGIN:VCALENDAR', 'VERSION:2.0', 'PRODID:-//CSCD//Delegate//EN', 'BEGIN:VEVENT', `DTSTART:${dt}T${h}${m}00`, `DTEND:${dt}T${eh}${em}00`, `SUMMARY:${it.title}`, `LOCATION:${it.venue || ''}`, 'END:VEVENT', 'END:VCALENDAR'].join('\r\n');
    return 'data:text/calendar;charset=utf-8,' + encodeURIComponent(body);
  }
  async function toggleFav(id, btn) {
    const adding = !favourites.has(id);
    if (adding) { favourites.add(id); btn.textContent = '★'; } else { favourites.delete(id); btn.textContent = '☆'; }
    saveFavsLocal();
    if (current === 'schedule') renderSchedule();
    try {
      if (adding) await api('/favourites', { method: 'POST', body: JSON.stringify({ session_id: id }) });
      else await api('/favourites/' + encodeURIComponent(id), { method: 'DELETE' });
    } catch (e) {}
  }

  /* ===================== VISITS ===================== */
  async function renderVisits() {
    rendered.visits = true; const root = el('visits-list');
    try {
      const { visits } = await getJson('/api/visits');
      if (!visits || !visits.length) { root.innerHTML = phVisits(); return; }
      root.innerHTML = visits.map((v) => { const map = mapsLink(v.map || v.address); return `<div class="tile">
        <div class="tile-title">${esc(v.place)}</div><div class="tile-meta">${esc(v.time || '')}</div>
        <div class="tile-body">${esc(v.address || '')}<br><br>${esc(v.description || '')}</div>
        ${map ? `<div class="t-actions" style="margin-top:12px"><a class="chip primary" href="${map}" target="_blank" rel="noopener">Open in Maps</a></div>` : ''}</div>`; }).join('');
    } catch (e) { root.innerHTML = '<div class="empty">Could not load visits.</div>'; }
  }
  function phVisits() { return `<div class="placeholder"><div class="ph-icon"><svg viewBox="0 0 24 24" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></div><p>Visit cards appear here once <b>visits.json</b> is final.</p></div>`; }

  /* ===================== SPEAKERS ===================== */
  async function renderSpeakers() {
    const root = el('speakers-list');
    if (rendered.speakers) { root.innerHTML = listSpeakers(); return; }
    try { const d = await getJson('/api/speakers'); speakers = d.speakers || []; rendered.speakers = true;
      root.innerHTML = speakers.length ? listSpeakers() : `<div class="placeholder"><div class="ph-icon"><svg viewBox="0 0 24 24" stroke-width="1.8"><circle cx="12" cy="8" r="3.2"/><path d="M5 21c0-4 3-6.5 7-6.5s7 2.5 7 6.5"/></svg></div><p>Speaker bios appear here once the <b>speaker list</b> is shared.</p></div>`;
    } catch (e) { root.innerHTML = '<div class="empty">Could not load speakers.</div>'; }
  }
  function listSpeakers() {
    return speakers.map((s, i) => { const ini = (s.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
      const av = s.photo ? `<img class="avatar" src="${esc(s.photo)}" alt="">` : `<div class="avatar">${esc(ini)}</div>`;
      return `<div class="tile spk" data-spk="${i}">${av}<div><div class="spk-name">${esc(s.name)}</div><div class="spk-title">${esc(s.title || '')}</div><div class="spk-topic">${esc(s.topic || '')}</div></div></div>`; }).join('');
  }
  function showSpeaker(i) {
    const s = speakers[i]; const ini = (s.name || '?').split(' ').map((w) => w[0]).join('').slice(0, 2).toUpperCase();
    const av = s.photo ? `<img class="avatar" style="width:64px;height:64px" src="${esc(s.photo)}" alt="">` : `<div class="avatar" style="width:64px;height:64px">${esc(ini)}</div>`;
    el('speakers-list').innerHTML = `<button class="back-btn" id="spk-back">‹ All speakers</button>
      <div class="tile"><div style="display:flex;gap:14px;align-items:center;margin-bottom:14px">${av}<div><div class="spk-name">${esc(s.name)}</div><div class="spk-title">${esc(s.title || '')}</div></div></div>
      <div class="tile-meta">Speaking on</div><div class="t-title" style="margin-bottom:6px">${esc(s.topic || '')}</div>
      <div class="spk-topic" style="margin-bottom:12px">${esc(s.session_time || '')}${s.session_venue ? ' · ' + esc(s.session_venue) : ''}</div>
      <div class="tile-body">${esc(s.bio || '')}</div></div>`;
    el('spk-back').onclick = () => renderSpeakers();
  }

  /* ===================== HOTEL ===================== */
  async function renderHotel() {
    const root = el('hotel-content'); root.innerHTML = '<div class="empty">Loading…</div>';
    if (!hotelData) { try { hotelData = await api('/me/hotel'); } catch (e) { hotelData = null; } }
    const checkin = await getJson('/api/checkin').catch(() => null);
    let html = '';
    if (hotelData && hotelData.hotel) {
      const h = hotelData.hotel, d = hotelData.delegate; const map = mapsLink(h.map || h.address);
      const tel = (h.contacts || []).find((c) => c.type === 'phone');
      html += `<div class="section-label">Your room</div><div class="hk-grid">
        ${field('Hotel', h.name)}${field('Room', d.room)}${field('Check-in', d.check_in)}${field('Check-out', d.check_out)}${field('Booking ref', d.booking_ref)}${field('Meals', d.meals)}</div>
        <div class="hk-actions">${map ? `<a class="hk-action primary" href="${map}" target="_blank" rel="noopener">Open in Maps</a>` : ''}${tel ? `<a class="hk-action" href="tel:${esc(tel.value)}">Call hotel</a>` : ''}</div>`;
      if (h.wifi) html += `<div class="section-label">WiFi</div><div class="card"><div class="meal-row"><span>Network</span><span>${esc(h.wifi)}</span></div></div>`;
    } else {
      html += `<div class="card"><div class="next-venue">Your hotel details will appear here once assigned.</div></div>`;
    }
    if (checkin) html += `<div class="section-label">${esc(checkin.title || 'Guided check-in')}</div><div class="card" style="padding:6px 18px">
      ${(checkin.steps || []).map((s) => `<div class="guide-step"><div class="guide-num">${esc(s.step)}</div><div class="guide-text"><b>${esc(s.title)}.</b> ${esc(s.detail)}</div></div>`).join('')}</div>
      ${checkin.bring && checkin.bring.length ? `<div class="card"><div class="card-eyebrow">Bring with you</div>${checkin.bring.map((b) => `<div class="meal-row"><span>${esc(b)}</span><span>✓</span></div>`).join('')}</div>` : ''}`;
    root.innerHTML = html;
  }
  function field(l, v) { return v ? `<div class="hk-field"><div class="hk-field-label">${esc(l)}</div><div class="hk-field-value">${esc(v)}</div></div>` : ''; }

  /* ===================== CONTACT ===================== */
  async function renderContact() {
    rendered.contact = true; const root = el('contact-content');
    try {
      const c = await getJson('/api/contact'); const map = mapsLink((c.venue && (c.venue.map || c.venue.address)) || '');
      const link = (x) => x.type === 'email' ? `mailto:${esc(x.value)}` : x.type === 'phone' ? `tel:${esc(x.value)}` : esc(x.value);
      let html = `<div class="tile"><div class="tile-title">${esc(c.org || 'CSCD')}</div>`;
      if (c.venue) html += `<div class="tile-body">${esc(c.venue.name || '')}<br>${esc(c.venue.address || '')}</div>${map ? `<div class="t-actions" style="margin-top:12px"><a class="chip primary" href="${map}" target="_blank" rel="noopener">Open in Maps</a></div>` : ''}`;
      html += `</div>`;
      if (c.contacts && c.contacts.length) html += `<div class="card"><div class="card-eyebrow">Reach us</div>${c.contacts.map((x) => `<div class="info-row"><span class="info-label">${esc(x.label)}</span><a class="info-val" href="${link(x)}">${esc(x.value)}</a></div>`).join('')}</div>`;
      if (c.socials && c.socials.length) html += `<div class="card"><div class="card-eyebrow">Online</div>${c.socials.map((x) => `<div class="info-row"><span class="info-label">${esc(x.label)}</span><a class="info-val" href="${esc(x.value)}" target="_blank" rel="noopener">Visit</a></div>`).join('')}</div>`;
      root.innerHTML = html;
    } catch (e) { root.innerHTML = '<div class="empty">Could not load contacts.</div>'; }
  }
  async function sendFeedback() {
    const m = el('fb-msg'); const comment = el('fb-comment').value.trim();
    if (!comment) { m.textContent = 'Write something first.'; m.className = 'form-msg error'; return; }
    try { await api('/feedback', { method: 'POST', body: JSON.stringify({ comment }) }); m.textContent = 'Thanks for the feedback!'; m.className = 'form-msg ok'; el('fb-comment').value = ''; }
    catch (e) { m.textContent = 'Could not send right now.'; m.className = 'form-msg error'; }
  }

  /* ===================== MY SCHEDULE ===================== */
  function renderSchedule() {
    const root = el('schedule-content');
    if (!rundown || !rundown.days) { root.innerHTML = schedEmpty(); return; }
    const groups = rundown.days.reduce((acc, day) => {
      const items = (day.items || []).filter((it) => favourites.has(`${day.date}T${it.time}`));
      if (items.length) acc.push({ day, items });
      return acc;
    }, []);
    if (!groups.length) { root.innerHTML = schedEmpty(); return; }
    const total = groups.reduce((n, g) => n + g.items.length, 0);
    let html = `<div class="sched-meta-row"><span class="sched-count-badge">★ ${total} session${total !== 1 ? 's' : ''}</span> across ${groups.length} day${groups.length !== 1 ? 's' : ''}</div>`;
    for (const { day, items } of groups) {
      html += `<div class="sched-day-section"><div class="sched-day-head"><span class="sched-day-label">${esc(day.label)}</span><span class="sched-day-date">${esc(day.date)}</span></div>`;
      for (const it of items) {
        const id = `${day.date}T${it.time}`; const s = split12(it.time);
        const isBrass = brassTypes.includes((it.type || '').toLowerCase());
        html += `<div class="sched-row">
          <div class="sched-time">${esc(s.hm)}<small>${esc(s.ap)}</small></div>
          <div class="sched-body">
            <span class="${isBrass ? 't-type' : 't-type subtle'}" style="font-size:.65rem;padding:2px 7px">${esc(it.type || 'item')}</span>
            <div class="sched-title">${esc(it.title)}</div>
            ${it.venue ? `<div class="sched-venue">${esc(it.venue)}</div>` : ''}
          </div>
          <button class="sched-remove star-btn" data-fav="${esc(id)}" title="Remove from My Schedule">★</button>
        </div>`;
      }
      html += '</div>';
    }
    root.innerHTML = html;
  }
  function schedEmpty() {
    return `<div class="sched-empty"><span class="sched-empty-icon">☆</span><p>Your personal schedule is empty.</p><small>Tap ☆ next to any session in the <b>Rundown</b> to add it here.</small></div>`;
  }

  /* ===================== NOTIFICATIONS ===================== */
  const getRead = () => { try { return new Set(JSON.parse(localStorage.getItem(READ_KEY) || '[]')); } catch (e) { return new Set(); } };
  const setRead = (s) => localStorage.setItem(READ_KEY, JSON.stringify([...s]));
  function computeReminders() {
    if (!rundown || !rundown.days) return [];
    const tz = rundown.timezone || 'Asia/Jakarta'; const { date, minutes } = tzNow(tz); const out = [];
    for (const day of rundown.days) { if (day.date !== date) continue; for (const it of day.items || []) { if (!it.notify) continue; const d = toMin(it.time) - minutes; if (d > 0 && d <= 60) out.push({ id: `rem-${day.date}T${it.time}`, title: `Starting soon: ${it.title}`, body: `${fmt12(it.time)} at ${it.venue || 'the venue'}${it.gather_time ? ` — gather ${fmt12(it.gather_time)}` : ''}.`, created_at: new Date().toISOString(), kind: 'reminder' }); } }
    return out;
  }
  let lastIds = new Set();
  async function refreshNotifications() {
    let anns = []; try { anns = (await api('/announcements')).announcements || []; } catch (e) {}
    const reminders = computeReminders();
    const items = [...anns.map((a) => ({ id: 'ann-' + a.id, title: a.title, body: a.body, created_at: a.created_at, pinned: a.pinned, kind: 'announcement' })), ...reminders];
    window._notif = items;
    const read = getRead(); const unread = items.filter((i) => !read.has(i.id));
    el('bell-dot').classList.toggle('show', unread.length > 0);
    for (const r of reminders) if (!lastIds.has(r.id) && !read.has(r.id)) { showModal(r.title, r.body); break; }
    lastIds = new Set(items.map((i) => i.id));
    renderUpdates();
  }
  function renderUpdates() {
    const read = getRead(); const items = window._notif || []; const body = el('updates-body');
    if (!items.length) { body.innerHTML = '<div class="empty">No updates yet.</div>'; return; }
    const icon = (k) => k === 'reminder' ? '<path d="M12 8v4l3 2"/><circle cx="12" cy="12" r="9"/>' : '<path d="M12 2L2 7l10 5 10-5-10-5z"/><path d="M2 17l10 5 10-5M2 12l10 5 10-5"/>';
    body.innerHTML = items.map((i) => { const unread = !read.has(i.id); const when = i.created_at ? new Date(i.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' }) : '';
      return `<div class="update-item ${unread ? 'unread' : ''}"><div class="u-dot-wrap"><div class="u-icon"><svg viewBox="0 0 24 24">${icon(i.kind)}</svg></div>${unread ? '<div class="u-unread-dot"></div>' : ''}</div>
      <div><div class="u-title">${esc(i.title)}</div><div class="u-body">${esc(i.body)}</div><div class="u-meta">${esc(when)} · ${i.kind === 'reminder' ? 'Reminder' : 'Announcement'}${i.pinned ? ' · Pinned' : ''}</div></div></div>`; }).join('');
  }
  function markAllRead() { const read = getRead(); (window._notif || []).forEach((i) => read.add(i.id)); setRead(read); el('bell-dot').classList.remove('show'); renderUpdates(); }

  /* ===================== DRAWERS / MODAL ===================== */
  function openDrawer(elm) { elm.classList.add('open'); el('backdrop').classList.add('open'); }
  function closeDrawers() { el('rail').classList.remove('open'); el('menu-drawer').classList.remove('open'); el('backdrop').classList.remove('open'); }
  function showModal(t, b) { el('modal-title').textContent = t; el('modal-body').textContent = b; el('modal-overlay').classList.add('show'); }
  function closeModal() { el('modal-overlay').classList.remove('show'); }

  /* ===================== EVENTS ===================== */
  function wire() {
    el('btn-login').onclick = doLogin;
    el('password').addEventListener('keydown', (e) => { if (e.key === 'Enter') doLogin(); });
    el('btn-forgot').onclick = () => swapForm('reset');
    el('btn-back-login').onclick = () => swapForm('login');
    el('btn-send-reset').onclick = doSendReset;
    el('btn-set-pw').onclick = doSetPassword;
    el('btn-feedback').onclick = sendFeedback;
    el('modal-ok').onclick = closeModal;

    $$('.js-theme').forEach((b) => b.onclick = toggleTheme);
    $$('.js-logout').forEach((b) => b.onclick = doLogout);
    $$('.js-bell').forEach((b) => b.onclick = () => { openDrawer(el('rail')); markAllRead(); });
    $$('.js-bell-close').forEach((b) => b.onclick = closeDrawers);
    el('btn-menu').onclick = () => openDrawer(el('menu-drawer'));
    $$('.js-menu-close').forEach((b) => b.onclick = closeDrawers);
    el('backdrop').onclick = closeDrawers;

    document.addEventListener('click', (e) => {
      const go = e.target.closest('[data-goto]'); if (go) { switchScreen(go.dataset.goto); closeDrawers(); return; }
      const day = e.target.closest('[data-day]'); if (day) { activeDay = +day.dataset.day; renderRundown(); return; }
      const fav = e.target.closest('[data-fav]'); if (fav) { e.preventDefault(); toggleFav(fav.dataset.fav, fav); return; }
      const spk = e.target.closest('[data-spk]'); if (spk) { showSpeaker(+spk.dataset.spk); return; }
    });
  }

  if ('serviceWorker' in navigator) {
    // Self-updating: when a new worker takes control, reload once so fresh
    // HTML/CSS/JS show immediately (no manual hard-refresh needed).
    let refreshing = false;
    navigator.serviceWorker.addEventListener('controllerchange', () => {
      if (refreshing) return;
      refreshing = true;
      window.location.reload();
    });
    window.addEventListener('load', async () => {
      try {
        const reg = await navigator.serviceWorker.register('/sw.js');
        reg.update();
        // If a new worker is already waiting, ask it to activate now.
        if (reg.waiting) reg.waiting.postMessage('skip-waiting');
        reg.addEventListener('updatefound', () => {
          const nw = reg.installing;
          if (nw) nw.addEventListener('statechange', () => {
            if (nw.state === 'installed' && reg.waiting) reg.waiting.postMessage('skip-waiting');
          });
        });
      } catch (e) { /* ignore */ }
    });
  }

  wire();
  initSupabase();
})();
