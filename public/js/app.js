/* CIPES Delegate App — front-end controller (Credential / boarding-pass theme).
   No framework, no build step. Supabase Auth in the browser (anon key) + the
   app's own JSON/Supabase API. Responsive: mobile drawers / desktop 3-col. */
(function () {
  'use strict';

  let sb = null, session = null, config = {};
  let rundown = null, speakers = [], profile = {}, hotelData = null;
  let favourites = new Set();
  const READ_KEY = 'cipes_read_notifications';
  const THEME_KEY = 'cipes_theme';

  const $ = (s) => document.querySelector(s);
  const $$ = (s) => Array.from(document.querySelectorAll(s));
  const el = (id) => document.getElementById(id);
  function esc(s) {
    return String(s == null ? '' : s).replace(/[&<>"']/g, (c) =>
      ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  }
  function mapsLink(q) { return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : null; }

  /* ---- SVG icon paths (24×24 Feather-style) ---- */
  const P = {
    mapPin:   '<path d="M21 10c0 7-9 13-9 13S3 17 3 10a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>',
    calendar: '<rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/>',
    mic:      '<path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><line x1="12" y1="19" x2="12" y2="22"/>',
    coffee:   '<path d="M18 8h1a4 4 0 0 1 0 8h-1"/><path d="M2 8h16v9a4 4 0 0 1-4 4H6a4 4 0 0 1-4-4V8z"/><line x1="6" y1="2" x2="6" y2="5"/><line x1="10" y1="2" x2="10" y2="5"/><line x1="14" y1="2" x2="14" y2="5"/>',
    users:    '<path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87"/><path d="M16 3.13a4 4 0 0 1 0 7.75"/>',
    wrench:   '<path d="M14.7 6.3a1 1 0 0 0 0 1.4l1.6 1.6a1 1 0 0 0 1.4 0l3.77-3.77a6 6 0 0 1-7.94 7.94l-6.91 6.91a2.12 2.12 0 0 1-3-3l6.91-6.91a6 6 0 0 1 7.94-7.94l-3.76 3.76z"/>',
    chat:     '<path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"/>',
    award:    '<circle cx="12" cy="8" r="6"/><path d="M15.477 12.89L17 22l-5-3-5 3 1.523-9.11"/>',
    clock:    '<circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/>',
    mail:     '<path d="M4 4h16c1.1 0 2 .9 2 2v12a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V6c0-1.1.9-2 2-2z"/><polyline points="22,6 12,13 2,6"/>',
    phone:    '<path d="M22 16.9v3a2 2 0 0 1-2.2 2 19.8 19.8 0 0 1-8.6-3 19.5 19.5 0 0 1-6-6 19.8 19.8 0 0 1-3-8.6A2 2 0 0 1 4.1 2h3a2 2 0 0 1 2 1.7c.1.9.3 1.8.6 2.6a2 2 0 0 1-.5 2.1L8 9.6a16 16 0 0 0 6 6l1.2-1.2a2 2 0 0 1 2.1-.5c.8.3 1.7.5 2.6.6a2 2 0 0 1 1.7 2z"/>',
    globe:    '<circle cx="12" cy="12" r="10"/><line x1="2" y1="12" x2="22" y2="12"/><path d="M12 2a15.3 15.3 0 0 1 4 10 15.3 15.3 0 0 1-4 10 15.3 15.3 0 0 1-4-10 15.3 15.3 0 0 1 4-10z"/>',
    building: '<rect x="4" y="2" width="16" height="20" rx="1"/><path d="M9 22V12h6v10"/><line x1="9" y1="7" x2="11" y2="7"/><line x1="13" y1="7" x2="15" y2="7"/><line x1="9" y1="11" x2="11" y2="11"/><line x1="13" y1="11" x2="15" y2="11"/>',
    door:     '<path d="M3 22h18M5 22V5a2 2 0 0 1 2-2h10a2 2 0 0 1 2 2v17"/><circle cx="15" cy="12" r=".5" fill="currentColor"/>',
    logIn:    '<path d="M15 3h4a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2h-4"/><polyline points="10 17 15 12 10 7"/><line x1="15" y1="12" x2="3" y2="12"/>',
    logOut:   '<path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/>',
    wifi:     '<path d="M5 12.55a11 11 0 0 1 14.08 0"/><path d="M1.42 9a16 16 0 0 1 21.16 0"/><path d="M8.53 16.11a6 6 0 0 1 6.95 0"/><line x1="12" y1="20" x2="12.01" y2="20"/>',
    hash:     '<line x1="4" y1="9" x2="20" y2="9"/><line x1="4" y1="15" x2="20" y2="15"/><line x1="10" y1="3" x2="8" y2="21"/><line x1="16" y1="3" x2="14" y2="21"/>',
  };
  function ic(path, w) { return `<svg viewBox="0 0 24 24" width="${w||14}" height="${w||14}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${path}</svg>`; }
  function typeIcon(t) { const m={meal:P.coffee,keynote:P.mic,visit:P.mapPin,social:P.users,workshop:P.wrench,panel:P.chat,ceremony:P.award}; return ic(m[(t||'').toLowerCase()]||P.clock,10); }

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
    const ev = config.eventName && config.eventName !== 'CIPES Delegate App' ? config.eventName : 'Frankfurt 2026';
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

  const SPINNER = `<svg class="btn-spinner" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" stroke-linecap="round"><circle cx="12" cy="12" r="9" stroke-opacity=".25"/><path d="M12 3a9 9 0 0 1 9 9"/></svg>`;
  function btnLoad(id, label) {
    const b = el(id); b.disabled = true;
    b.dataset.label = b.innerHTML;
    b.innerHTML = `${SPINNER}${label || ''}`;
  }
  function btnReset(id) {
    const b = el(id); b.disabled = false;
    if (b.dataset.label) { b.innerHTML = b.dataset.label; delete b.dataset.label; }
  }

  async function doLogin() {
    const m = el('login-msg'); m.textContent = ''; m.className = 'form-msg';
    const email = el('email').value.trim(), password = el('password').value;
    if (!email || !password) { m.textContent = 'Enter email and password.'; m.className = 'form-msg error'; return; }
    btnLoad('btn-login', 'Signing in…');
    const { data, error } = await sb.auth.signInWithPassword({ email, password });
    btnReset('btn-login');
    if (error) { m.textContent = error.message; m.className = 'form-msg error'; return; }
    session = data.session; enterApp();
  }
  async function doSendReset() {
    const m = el('reset-msg'); const email = el('reset-email').value.trim();
    if (!email) { m.textContent = 'Enter your email.'; m.className = 'form-msg error'; return; }
    btnLoad('btn-send-reset', 'Sending…');
    const { error } = await sb.auth.resetPasswordForEmail(email, { redirectTo: location.origin });
    btnReset('btn-send-reset');
    if (error) { m.textContent = error.message; m.className = 'form-msg error'; return; }
    m.textContent = 'If that email exists, a reset link is on its way.'; m.className = 'form-msg ok';
  }
  async function doSetPassword() {
    const m = el('newpw-msg'); const pw = el('new-password').value;
    if (pw.length < 8) { m.textContent = 'Use at least 8 characters.'; m.className = 'form-msg error'; return; }
    btnLoad('btn-set-pw', 'Updating…');
    const { error } = await sb.auth.updateUser({ password: pw });
    btnReset('btn-set-pw');
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
    const initialTab = NAV_ORDER.includes(location.hash.slice(1)) ? location.hash.slice(1) : 'dashboard';
    switchScreen(initialTab);
    refreshNotifications();
    setInterval(refreshNotifications, 60000);
    setInterval(() => { if (current === 'rundown') renderRundown(); if (current === 'dashboard') renderDashboard(); }, 60000);
    renderClock();
    setInterval(renderClock, 1000);
  }
  async function loadProfile() { try { profile = await api('/me/profile'); } catch (e) { profile = { name: 'Delegate' }; } }
  async function loadRundown() { try { rundown = await getJson('/api/rundown'); } catch (e) { rundown = { days: [] }; } }
  async function loadHotel() { try { hotelData = await getJson('/api/hotel'); } catch (e) { hotelData = null; } }
  function saveFavsLocal() { localStorage.setItem('cipes_favs', JSON.stringify([...favourites])); }
  function loadFavsLocal() { try { return new Set(JSON.parse(localStorage.getItem('cipes_favs') || '[]')); } catch (e) { return new Set(); } }
  async function loadFavourites() {
    favourites = loadFavsLocal();
    try { const { favourites: f } = await api('/favourites'); favourites = new Set((f || []).map((x) => x.session_id)); saveFavsLocal(); } catch (e) {}
  }

  /* ===================== NAV + PASS HERO ===================== */
  let current = 'dashboard';
  const rendered = {};
  const NAV_ORDER = ['dashboard', 'rundown', 'visits', 'speakers', 'schedule', 'hotel', 'contact'];
  function setActiveNav(name) { $$('[data-goto]').forEach((n) => { if (n.classList.contains('nav-link') || n.classList.contains('nav-item')) n.classList.toggle('active', n.dataset.goto === name); }); }

  function switchScreen(name, { pushHistory = true } = {}) {
    if (!NAV_ORDER.includes(name)) name = 'dashboard';
    const fromIdx = NAV_ORDER.indexOf(current);
    const toIdx   = NAV_ORDER.indexOf(name);
    const goingLeft = toIdx < fromIdx;
    current = name;
    $$('.screen').forEach((s) => {
      const active = s.dataset.screen === name;
      s.classList.remove('active', 'dir-left');
      if (active) {
        s.classList.add('active');
        if (goingLeft) s.classList.add('dir-left');
      }
    });
    setActiveNav(name);
    renderPass(name);
    el('pass').classList.toggle('pass--compact', name !== 'dashboard');
    if (name === 'dashboard') renderDashboard();
    if (name === 'rundown') renderRundown();
    if (name === 'visits' && !rendered.visits) renderVisits();
    if (name === 'speakers') renderSpeakers();
    if (name === 'hotel') renderHotel();
    if (name === 'schedule') renderSchedule();
    if (name === 'contact' && !rendered.contact) renderContact();
    if (window.innerWidth < 960) window.scrollTo(0, 0);
    if (pushHistory) history.pushState({ tab: name }, '', '#' + name);
  }

  window.addEventListener('popstate', (e) => {
    const tab = e.state?.tab || (location.hash.slice(1)) || 'dashboard';
    if (NAV_ORDER.includes(tab)) switchScreen(tab, { pushHistory: false });
  });

  function passFields(arr) {
    el('pass-fields').innerHTML = arr.map((f) =>
      `<div class="pass-field"><div class="pass-field-label">${esc(f[0])}</div><div class="pass-field-value${f[2] ? ' signal' : ''}">${esc(f[1])}</div></div>`).join('');
  }
  function renderPass(name) {
    const nm = profile.name || 'Delegate';
    const tz = (rundown && rundown.timezone) || 'Europe/Berlin';
    const today = tzNow(tz);
    const dayIdx = rundown && rundown.days ? rundown.days.findIndex((d) => d.date === today.date) : -1;
    const dayLabel = dayIdx >= 0 ? rundown.days[dayIdx].label : '—';
    const hotelName = hotelData && hotelData.hotel ? hotelData.hotel.name : '—';
    const checkIn = hotelData && hotelData.hotel ? (hotelData.hotel.check_in || '—') : '—';
    const checkOut = hotelData && hotelData.hotel ? (hotelData.hotel.check_out || '—') : '—';
    const fid = profile.frankfurt_id || '—';
    const tzDisplay = (tz || '').replace('Europe/', '').replace('Asia/', '');
    const sets = {
      dashboard: ['Delegate credential', nm, '', [['Delegate ID', fid], ['Hotel', hotelName], ['Status', dayIdx >= 0 ? `${dayLabel} · Live` : 'Event soon', true]]],
      rundown: ['Programme', `${dayLabel} Rundown`, '"The week, hour by hour."', [['Days', rundown && rundown.days ? String(rundown.days.length) : '—'], ['Timezone', tzDisplay], ['You are', nm.split(' ')[0], true]]],
      visits: ['Institutional visits', 'Visits & Programs', '"Where the delegation calls on the city."', [['Scope', 'All delegates'], ['Maps', 'Tap to open'], ['Status', 'See list', true]]],
      speakers: ['CIPES Speakers', 'Speakers', '"The people behind the sessions."', [['Sessions', 'Linked to rundown'], ['Tap', 'For bios'], ['You are', nm.split(' ')[0], true]]],
      hotel: ['Your stay', hotelName, '"Your base for the week."', [['Check-in', checkIn], ['Check-out', checkOut], ['Booking', hotelData && hotelData.hotel ? (hotelData.hotel.booking_name || '—') : '—', true]]],
      contact: ['Coordination', 'Contact us', '"We are here to help."', [['Reach', 'Email or call'], ['Feedback', 'Welcome'], ['CIPES', 'YEF Frankfurt 2026', true]]],
      schedule: ['My Programme', 'My Schedule', '"Sessions you starred."', [['Starred', favourites.size ? `${favourites.size} session${favourites.size !== 1 ? 's' : ''}` : 'None yet'], ['Source', 'Rundown ☆'], ['Type', 'Personal only', true]]],
    };
    const s = sets[name] || sets.dashboard;
    el('pass-eyebrow').textContent = s[0];
    el('pass-title').textContent = s[1];
    el('pass-sub').textContent = s[2];
    el('pass-sub').style.display = s[2] ? '' : 'none';
    passFields(s[3]);
  }

  /* ===================== FRANKFURT CLOCK ===================== */
  const _clockTZ = 'Europe/Berlin';
  const _clockTimeFmt = new Intl.DateTimeFormat('en-GB', { timeZone: _clockTZ, hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false });
  const _clockDateFmt = new Intl.DateTimeFormat('en-GB', { timeZone: _clockTZ, day: 'numeric', month: 'short', year: 'numeric' });
  const _clockDayFmt  = new Intl.DateTimeFormat('en-GB', { timeZone: _clockTZ, weekday: 'long' });
  function renderClock() {
    const c = el('dash-clock'); if (!c) return;
    const now = new Date();
    const timeParts = Object.fromEntries(_clockTimeFmt.formatToParts(now).map((x) => [x.type, x.value]));
    const h = +timeParts.hour, m = timeParts.minute, s = timeParts.second;
    const ap = h >= 12 ? 'PM' : 'AM';
    const hh = String(((h + 11) % 12) + 1);
    c.innerHTML = `
      <div class="dash-clock-left">
        <div class="dash-clock-city">Frankfurt &nbsp;·&nbsp; CET/CEST</div>
        <div class="dash-clock-time">${hh}:${m}:${s}<small>${ap}</small></div>
      </div>
      <div class="dash-clock-right">
        <div class="dash-clock-date">${_clockDateFmt.format(now)}</div>
        <div class="dash-clock-day">${_clockDayFmt.format(now)}</div>
      </div>`;
  }

  /* ===================== DASHBOARD ===================== */
  function findNext() {
    if (!rundown || !rundown.days) return null;
    const tz = rundown.timezone || 'Europe/Berlin'; const { date, minutes } = tzNow(tz);
    for (const day of rundown.days) {
      if (day.date < date) continue;
      for (const it of day.items || []) if (day.date > date || toMin(it.time) >= minutes) return { day, it };
    }
    return null;
  }
  function findNow() {
    if (!rundown || !rundown.days) return null;
    const tz = rundown.timezone || 'Europe/Berlin'; const { date, minutes } = tzNow(tz);
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
      const tz = rundown.timezone || 'Europe/Berlin'; const { date, minutes } = tzNow(tz); let count = 0;
      for (const day of rundown.days) {
        if (day.date < date) continue;
        for (const it of day.items || []) {
          if ((day.date > date || toMin(it.time) >= minutes) && count < 2) { ups.push({ day, it }); count++; }
        }
        if (count >= 2) break;
      }
    }
    const typeAccent = { visit: '#001224', keynote: '#001224', panel: '#001224', meal: '#7A5C2E', social: '#2D5A8E', workshop: '#4A3C70' };
    el('dash-next').innerHTML = ups.length
      ? ups.map(({ day, it }, idx) => {
        const s = split12(it.time); const accent = typeAccent[(it.type || '').toLowerCase()] || '#555';
        const isPrimary = idx === 0;
        const cardStyle = isPrimary ? `background:#001224;border-color:#001224;color:#F9F9F9` : '';
        const timeStyle = isPrimary ? 'color:#D1C5A9' : '';
        const venueStyle = isPrimary ? 'color:rgba(229,219,194,0.75)' : '';
        return `<div class="next-card" data-goto="rundown" style="${cardStyle}">
          ${!isPrimary ? `<div class="next-card-bar" style="background:${accent}"></div>` : ''}
          <div class="next-card-left">
            <div class="next-card-time" style="${timeStyle}">${esc(s.hm)}<small>${esc(s.ap)}</small></div>
            ${isPrimary ? `<div class="next-soon" style="color:#D1C5A9"><span class="next-soon-dot" style="background:#D1C5A9"></span>Soon</div>` : `<div class="next-day-lbl">${esc(day.label)}</div>`}
          </div>
          <div class="next-card-body">
            <div class="next-card-title">${esc(it.title)}</div>
            <div class="next-card-venue" style="${venueStyle}">${esc(it.venue || '')}${it.gather_time ? ` · gather ${esc(fmt12(it.gather_time))}` : ''}</div>
          </div>
          <div class="next-card-type" style="color:${isPrimary ? '#D1C5A9' : accent}">${typeIcon(it.type)}</div>
        </div>`;
      }).join('')
      : '<div class="next-venue" style="padding:8px 0">No upcoming items.</div>';
    // hotel (shared for all delegates)
    if (hotelData && hotelData.hotel) {
      const h = hotelData.hotel;
      el('dash-hotel').innerHTML = `<div class="card-eyebrow"><span style="display:flex;align-items:center;gap:5px">${ic(P.building,13)}${esc(h.name)}</span><span class="link">Check-in →</span></div>
        <div class="next-venue">${h.check_in ? 'In: ' + esc(h.check_in) : ''}${h.check_out ? ' · Out: ' + esc(h.check_out) : ''}</div>`;
    } else {
      el('dash-hotel').innerHTML = `<div class="card-eyebrow"><span style="display:flex;align-items:center;gap:5px">${ic(P.building,13)}Your hotel</span><span class="link">View →</span></div><div class="next-venue">Details coming soon.</div>`;
    }
    el('dash-contact').innerHTML = `<div class="card-eyebrow"><span style="display:flex;align-items:center;gap:5px">${ic(P.phone,13)}Contact &amp; support</span><span class="link">Open →</span></div><div class="next-venue">Coordination team, venue map, feedback.</div>`;
    const sc = favourites.size;
    if (el('dash-schedule')) el('dash-schedule').innerHTML = `<div class="card-eyebrow"><span style="display:flex;align-items:center;gap:5px">${ic(P.award,13)}My programme</span><span class="link">View →</span></div><div class="next-venue">${sc > 0 ? `★ ${sc} session${sc !== 1 ? 's' : ''} starred` : 'No sessions starred yet — tap ☆ in the Rundown.'}</div>`;
    // latest announcement — reuse already-fetched notifications if available
    el('dash-update').innerHTML = `<div class="ann-title">Latest update</div><div class="ann-body" id="dash-ann">—</div>`;
    const _renderAnn = () => {
      const t = el('dash-ann'); if (!t) return;
      const anns = (window._notif || []).filter((n) => n.kind === 'announcement');
      if (anns.length) { const a = anns[0]; t.innerHTML = `<strong>${esc(a.title)}</strong><br>${esc(a.body)}`; }
      else t.textContent = 'No announcements yet.';
    };
    if (window._notif) { _renderAnn(); }
    else { api('/announcements').then(({ announcements }) => {
      const t = el('dash-ann'); if (!t) return;
      if (announcements && announcements.length) { const a = announcements[0]; t.innerHTML = `<strong>${esc(a.title)}</strong><br>${esc(a.body)}`; }
      else t.textContent = 'No announcements yet.';
    }).catch(() => {}); }
  }

  /* ===================== RUNDOWN ===================== */
  let activeDay = 0;
  const brassTypes = ['keynote', 'visit', 'plenary'];
  function renderRundown() {
    if (!rundown || !rundown.days || !rundown.days.length) {
      el('timeline').innerHTML = '<div class="empty">Agenda coming soon.</div>'; el('day-tabs').innerHTML = ''; return;
    }
    const tz = rundown.timezone || 'Europe/Berlin'; const { date, minutes } = tzNow(tz);
    if (!renderRundown._init) { const i = rundown.days.findIndex((d) => d.date === date); activeDay = i >= 0 ? i : 0; renderRundown._init = true; }
    el('day-tabs').innerHTML = rundown.days.map((d, i) => `<button class="day-tab ${i === activeDay ? 'active' : ''}" data-day="${i}">${esc(d.label)}</button>`).join('');
    const day = rundown.days[activeDay]; const isToday = day.date === date;
    let nowIdx = -1;
    if (isToday) for (let i = 0; i < day.items.length; i++) { const st = toMin(day.items[i].time), en = i + 1 < day.items.length ? toMin(day.items[i + 1].time) : st + 90; if (minutes >= st && minutes < en) { nowIdx = i; break; } }
    if (!day.items || !day.items.length) { el('timeline').innerHTML = '<div class="empty" style="padding:40px 0;text-align:center">Programme coming soon.</div>'; return; }
    el('timeline').innerHTML = day.items.map((it, i) => {
      const id = `${day.date}T${it.time}`, s = split12(it.time), starred = favourites.has(id);
      const typeCls = brassTypes.includes((it.type || '').toLowerCase()) ? 't-type' : 't-type subtle';
      const map = it.venue ? mapsLink(it.venue) : null;
      return `<div class="t-item ${i === nowIdx ? 'is-now' : ''}">
        <div class="t-time">${esc(s.hm)}<small>${esc(s.ap)}</small></div>
        <div class="t-dot"></div>
        <div class="t-content">
          <span class="${typeCls}">${typeIcon(it.type)}${esc(it.type || 'item')}</span>${i === nowIdx ? '<span class="live-pill"><span class="dot"></span>Live</span>' : ''}
          <div style="display:flex;align-items:flex-start;gap:8px"><div class="t-title">${esc(it.title)}</div><button class="star-btn ${starred ? 'starred' : ''}" data-fav="${esc(id)}" title="${starred ? 'Remove from favourites' : 'Add to favourites'}"><span class="star-icon">${starred ? '★' : '☆'}</span><span class="star-label">${starred ? 'Saved' : 'Save'}</span></button></div>
          <div class="t-venue">${esc(it.venue || '')}</div>
          ${it.gather_time ? `<div class="t-gather">Gather ${esc(fmt12(it.gather_time))}</div>` : ''}
          <div class="t-actions">
            ${map ? `<a class="chip" href="${map}" target="_blank" rel="noopener">${ic(P.mapPin,12)}Open in Maps</a>` : ''}
            <button class="chip cal-btn" data-day="${esc(day.date)}" data-title="${esc(it.title)}" data-time="${esc(it.time)}" data-venue="${esc(it.venue||'')}" data-dur="${it.duration_min||60}">${ic(P.calendar,12)}Add to calendar</button>
          </div>
        </div>
      </div>`;
    }).join('');
  }
  function buildIcsContent(date, time, title, venue, durMin) {
    const dt = date.replace(/-/g, '');
    const [h, m] = time.split(':');
    const endMin = parseInt(h,10)*60 + parseInt(m,10) + (parseInt(durMin,10)||60);
    const eh = String(Math.floor(endMin/60)%24).padStart(2,'0');
    const em = String(endMin%60).padStart(2,'0');
    const uid = `${dt}-${h}${m}-cipes@thecipes.org`;
    return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//CIPES//YEF Frankfurt 2026//EN','METHOD:PUBLISH',
      'BEGIN:VEVENT',`UID:${uid}`,`DTSTART:${dt}T${h}${m}00`,`DTEND:${dt}T${eh}${em}00`,
      `SUMMARY:${title}`,`LOCATION:${venue}`,'END:VEVENT','END:VCALENDAR'].join('\r\n');
  }
  function addToCalendar(btn) {
    const { day: date, title, time, venue, dur } = btn.dataset;
    const isMobile = /iPhone|iPad|iPod|Android/i.test(navigator.userAgent);
    if (isMobile) {
      const ics = buildIcsContent(date, time, title, venue, dur);
      const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url; a.download = ''; a.click();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      return;
    }
    // Desktop: show picker dropdown
    const existing = document.querySelector('.cal-picker');
    if (existing) { existing.remove(); if (existing._src === btn) return; }
    const dt = date.replace(/-/g,'');
    const [h,m] = time.split(':');
    const endMin = parseInt(h,10)*60+parseInt(m,10)+(parseInt(dur,10)||60);
    const eh = String(Math.floor(endMin/60)%24).padStart(2,'0');
    const em = String(endMin%60).padStart(2,'0');
    const start = `${dt}T${h}${m}00Z`, end = `${dt}T${eh}${em}00Z`;
    const gcUrl = `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${encodeURIComponent(title)}&dates=${start}/${end}&location=${encodeURIComponent(venue)}`;
    const olUrl = `https://outlook.live.com/calendar/0/deeplink/compose?subject=${encodeURIComponent(title)}&startdt=${date}T${h}:${m}:00&enddt=${date}T${eh}:${em}:00&location=${encodeURIComponent(venue)}&path=/calendar/action/compose&rru=addevent`;
    const ics = buildIcsContent(date, time, title, venue, dur);
    const blob = new Blob([ics], { type: 'text/calendar;charset=utf-8' });
    const dlUrl = URL.createObjectURL(blob);
    const picker = document.createElement('div');
    picker.className = 'cal-picker'; picker._src = btn;
    picker.innerHTML = `<a href="${gcUrl}" target="_blank" rel="noopener">Google Calendar</a><a href="${olUrl}" target="_blank" rel="noopener">Outlook / Office 365</a><a href="${dlUrl}" download="${title.replace(/[^a-z0-9]/gi,'_').toLowerCase()}.ics">Download .ics</a>`;
    btn.parentNode.style.position = 'relative';
    btn.parentNode.appendChild(picker);
    const close = e => { if (!picker.contains(e.target) && e.target !== btn) { picker.remove(); document.removeEventListener('click', close); URL.revokeObjectURL(dlUrl); } };
    setTimeout(() => document.addEventListener('click', close), 0);
  }
  async function toggleFav(id, btn) {
    const adding = !favourites.has(id);
    if (adding) {
      favourites.add(id);
      btn.classList.add('starred');
      const ic = btn.querySelector('.star-icon'); if (ic) ic.textContent = '★';
      const lb = btn.querySelector('.star-label'); if (lb) lb.textContent = 'Saved';
    } else {
      favourites.delete(id);
      btn.classList.remove('starred');
      const ic = btn.querySelector('.star-icon'); if (ic) ic.textContent = '☆';
      const lb = btn.querySelector('.star-label'); if (lb) lb.textContent = 'Save';
    }
    saveFavsLocal();
    if (current === 'schedule') renderSchedule();
    try {
      if (adding) await api('/favourites', { method: 'POST', body: JSON.stringify({ session_id: id }) });
      else await api('/favourites/' + encodeURIComponent(id), { method: 'DELETE' });
    } catch (e) {}
  }

  /* ===================== SKELETON LOADER ===================== */
  function skeletonCard(lines) {
    const lns = (lines || [{ w: 'w70', h: 'h16' }, { w: 'w100', h: 'h12' }, { w: 'w45', h: 'h12' }])
      .map((l) => `<div class="skel ${l.h} ${l.w}"></div>`).join('');
    return `<div class="card">${lns}</div>`;
  }

  /* ===================== VISITS ===================== */
  async function renderVisits() {
    rendered.visits = true; const root = el('visits-list');
    root.innerHTML = skeletonCard() + skeletonCard() + skeletonCard();
    try {
      const { visits } = await getJson('/api/visits');
      if (!visits || !visits.length) { root.innerHTML = phVisits(); return; }
      root.innerHTML = visits.map((v) => { const map = mapsLink(v.map || v.address); return `<div class="tile">
        <div class="tile-title">${esc(v.place)}</div><div class="tile-meta">${esc(v.time || '')}</div>
        <div class="tile-body">${esc(v.address || '')}<br><br>${esc(v.description || '')}</div>
        ${map ? `<div class="t-actions" style="margin-top:12px"><a class="chip primary" href="${map}" target="_blank" rel="noopener">${ic(P.mapPin,12)}Open in Maps</a></div>` : ''}</div>`; }).join('');
    } catch (e) { root.innerHTML = '<div class="empty">Could not load visits.</div>'; }
  }
  function phVisits() { return `<div class="placeholder"><div class="ph-icon"><svg viewBox="0 0 24 24" stroke-width="1.8"><rect x="3" y="3" width="7" height="7" rx="1"/><rect x="14" y="3" width="7" height="7" rx="1"/><rect x="3" y="14" width="7" height="7" rx="1"/><rect x="14" y="14" width="7" height="7" rx="1"/></svg></div><p>Visit cards appear here once <b>visits.json</b> is final.</p></div>`; }

  /* ===================== SPEAKERS ===================== */
  async function renderSpeakers() {
    const root = el('speakers-list');
    if (rendered.speakers) { root.innerHTML = listSpeakers(); return; }
    root.innerHTML = [1,2,3].map(() => skeletonCard([{w:'w70',h:'h16'},{w:'w100',h:'h12'}])).join('');
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
    const root = el('hotel-content');
    root.innerHTML = skeletonCard([{w:'w100',h:'h28'},{w:'w70',h:'h12'},{w:'w45',h:'h12'}]) + skeletonCard();
    if (!hotelData) { try { hotelData = await getJson('/api/hotel'); } catch (e) { hotelData = null; } }
    const checkin = await getJson('/api/checkin').catch(() => null);
    let html = '';
    if (hotelData && hotelData.hotel) {
      const h = hotelData.hotel; const map = mapsLink(h.map || h.address);
      const tel = (h.contacts || []).find((c) => c.type === 'phone');
      html += `<div class="section-label">Your stay</div><div class="hk-grid">
        ${field('Hotel', h.name, P.building)}${field('Check-in', h.check_in, P.logIn)}${field('Check-out', h.check_out, P.logOut)}${field('Booking ref', h.booking_name, P.hash)}</div>
        <div class="hk-actions">${map ? `<a class="hk-action primary" href="${map}" target="_blank" rel="noopener">${ic(P.mapPin,15)}Open in Maps</a>` : ''}${tel ? `<a class="hk-action" href="tel:${esc(tel.value)}">${ic(P.phone,15)}Call hotel</a>` : ''}</div>`;
      if (h.wifi) html += `<div class="section-label">WiFi</div><div class="card"><div class="meal-row"><span style="display:flex;align-items:center;gap:7px">${ic(P.wifi,15)}Network</span><span>${esc(h.wifi)}</span></div></div>`;
    } else {
      html += `<div class="card"><div class="next-venue">Hotel details coming soon.</div></div>`;
    }
    if (checkin) html += `<div class="section-label">${esc(checkin.title || 'Guided check-in')}</div>
      ${checkin.check_in_note ? `<div class="card" style="padding:10px 18px"><div class="next-venue" style="font-size:0.85rem">${esc(checkin.check_in_note)}</div></div>` : ''}
      <div class="card" style="padding:6px 18px">
      ${(checkin.steps || []).map((s) => `<div class="guide-step"><div class="guide-num">${esc(s.step)}</div><div class="guide-text"><b>${esc(s.title)}.</b> ${esc(s.detail)}</div></div>`).join('')}</div>
      ${checkin.bring && checkin.bring.length ? `<div class="card"><div class="card-eyebrow">Bring with you</div>${checkin.bring.map((b) => `<div class="meal-row"><span>${esc(b)}</span><span>✓</span></div>`).join('')}</div>` : ''}`;
    root.innerHTML = html;
  }
  function field(l, v, iconPath) { if (!v) return ''; const ico = iconPath ? `<svg class="hk-field-icon" viewBox="0 0 24 24">${iconPath}</svg>` : ''; return `<div class="hk-field">${ico}<div class="hk-field-label">${esc(l)}</div><div class="hk-field-value">${esc(v)}</div></div>`; }

  /* ===================== CONTACT ===================== */
  async function renderContact() {
    rendered.contact = true; const root = el('contact-content');
    try {
      const c = await getJson('/api/contact'); const map = mapsLink((c.venue && (c.venue.map || c.venue.address)) || '');
      const link = (x) => x.type === 'email' ? `mailto:${esc(x.value)}` : x.type === 'phone' ? `tel:${esc(x.value)}` : esc(x.value);
      let html = `<div class="tile"><div class="tile-title">${esc(c.org || 'CIPES')}</div>`;
      if (c.venue) html += `<div class="tile-body">${esc(c.venue.name || '')}<br>${esc(c.venue.address || '')}</div>${map ? `<div class="t-actions" style="margin-top:12px"><a class="chip primary" href="${map}" target="_blank" rel="noopener">Open in Maps</a></div>` : ''}`;
      html += `</div>`;
      const cIcons = { email: P.mail, phone: P.phone, whatsapp: P.phone };
      if (c.contacts && c.contacts.length) html += `<div class="card"><div class="card-eyebrow">Reach us</div>${c.contacts.map((x) => `<div class="info-row"><span class="info-label">${ic(cIcons[(x.type||'').toLowerCase()]||P.globe,15)}${esc(x.label)}</span><a class="info-val" href="${link(x)}">${esc(x.value)}</a></div>`).join('')}</div>`;
      if (c.socials && c.socials.length) html += `<div class="card"><div class="card-eyebrow">Online</div>${c.socials.map((x) => `<div class="info-row"><span class="info-label">${ic(P.globe,15)}${esc(x.label)}</span><a class="info-val" href="${esc(x.value)}" target="_blank" rel="noopener">Visit</a></div>`).join('')}</div>`;
      root.innerHTML = html;
    } catch (e) { root.innerHTML = '<div class="empty">Could not load contacts.</div>'; }
  }
  async function sendFeedback() {
    const m = el('fb-msg'); const comment = el('fb-comment').value.trim();
    if (!comment) { m.textContent = 'Write something first.'; m.className = 'form-msg error'; return; }
    btnLoad('btn-feedback', 'Sending…');
    try { await api('/feedback', { method: 'POST', body: JSON.stringify({ comment }) }); m.textContent = 'Thanks for the feedback!'; m.className = 'form-msg ok'; el('fb-comment').value = ''; }
    catch (e) { m.textContent = 'Could not send right now.'; m.className = 'form-msg error'; }
    finally { btnReset('btn-feedback'); }
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
    const tz = rundown.timezone || 'Europe/Berlin'; const { date, minutes } = tzNow(tz); const out = [];
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

    // password visibility toggles
    function makeEyeToggle(btnId, inputId) {
      const btn = el(btnId); if (!btn) return;
      btn.onclick = () => {
        const inp = el(inputId);
        inp.type = inp.type === 'password' ? 'text' : 'password';
        btn.setAttribute('aria-label', inp.type === 'password' ? 'Show password' : 'Hide password');
        btn.querySelector('svg').innerHTML = inp.type === 'password'
          ? '<path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/>'
          : '<path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/>';
      };
    }
    makeEyeToggle('btn-pw-eye', 'password');
    makeEyeToggle('btn-new-pw-eye', 'new-password');

    $$('.js-theme').forEach((b) => b.onclick = toggleTheme);
    $$('.js-logout').forEach((b) => b.onclick = doLogout);
    $$('.js-bell').forEach((b) => b.onclick = () => { openDrawer(el('rail')); markAllRead(); });
    $$('.js-bell-close').forEach((b) => b.onclick = closeDrawers);
    el('btn-menu').onclick = () => openDrawer(el('menu-drawer'));
    $$('.js-menu-close').forEach((b) => b.onclick = closeDrawers);
    el('backdrop').onclick = closeDrawers;

    // swipe to close drawers (right-side rail: swipe right; left-side menu: swipe left)
    function addSwipeClose(elm, closeDir) {
      let sx = null;
      elm.addEventListener('touchstart', (e) => { sx = e.touches[0].clientX; }, { passive: true });
      elm.addEventListener('touchend', (e) => {
        if (sx === null) return;
        const dx = e.changedTouches[0].clientX - sx;
        if (closeDir === 'right' && dx > 60) closeDrawers();
        if (closeDir === 'left'  && dx < -60) closeDrawers();
        sx = null;
      }, { passive: true });
    }
    addSwipeClose(el('rail'),        'right'); // updates rail: swipe right to close
    addSwipeClose(el('menu-drawer'), 'left');  // menu drawer: swipe left to close

    document.addEventListener('click', (e) => {
      const cal = e.target.closest('.cal-btn'); if (cal) { e.preventDefault(); addToCalendar(cal); return; }
      const go = e.target.closest('[data-goto]'); if (go) { switchScreen(go.dataset.goto); closeDrawers(); return; }
      const day = e.target.closest('.day-tab[data-day]'); if (day) { activeDay = +day.dataset.day; renderRundown(); return; }
      const fav = e.target.closest('[data-fav]'); if (fav) { e.preventDefault(); toggleFav(fav.dataset.fav, fav); return; }
      const spk = e.target.closest('[data-spk]'); if (spk) { showSpeaker(+spk.dataset.spk); return; }
    });
  }


  wire();
  initSupabase();
})();
