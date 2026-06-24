# CSCD Delegate App — Build Plan

Mobile-first web app (runs in any browser, behaves like an app), for an ongoing CSCD event.
**Status: planning only — do not build until client data arrives.**

---

## 1. Goal & constraints

- A **Node.js web app** opened in a browser on mobile (primary) and laptop. Installable as a PWA ("Add to Home Screen") so it feels like an app — **not** a native app-store build (this constrains notifications; see §6b).
- Clean **minimalist** UI using the Jakarta 2026 palette (see [color.md](color.md)).
- **Bottom-nav tabs (5):** Dashboard · Rundown · Institutional Visits · Speakers · Hotel & Check-in. **Contact** and **Sign out** live in a **header hamburger menu** (declutters the bottom bar); a **notifications bell** (Updates feed) also sits in the header on every screen.
- Static event content lives in JSON; the dynamic parts are **auth, the logged-in delegate's hotel/check-in data, announcements, and in-app notifications**.
- Deploys to **Hostinger (WordPress Business) Node.js hosting on a CSCD subdomain**.

## 2. Tech stack

| Concern        | Choice | Why |
|----------------|--------|-----|
| Server         | **Node.js + Express** | Minimal, Hostinger-supported (Passenger, `app.js` startup file) |
| Frontend       | **Static HTML/CSS/JS** served by Express (one page, client-side tab switching) | Fast on mobile, no build step, matches existing template approach |
| Static content | **JSON files** in `/data` (rundown, visits, speakers, hotel reference, check-in template, contact) | Stays fast, offline-cacheable, file-editable |
| Dynamic data   | **Supabase (Postgres)** | Auth, feedback, favourites, announcements; managed from the dashboard |
| Auth           | **Supabase Auth** (email + password) | Native login, sessions, password reset — no custom JWT/bcrypt/reset code |
| Email          | **Resend API**, wired as Supabase **custom SMTP** | Credential + reset/auth emails; **1-hour-before reminder emails** (universal backstop) |
| Scheduler      | **`node-cron`** in the Express app | Fires the 1-hour-before reminder emails off the rundown |
| Storage        | **Supabase Storage** (optional) | Speaker photos / slides |
| Fonts          | Google Fonts: Cinzel, Cormorant Garamond, Lato | Match Jakarta page |
| Hardening      | `helmet`, `express-rate-limit`, HTTPS (host-provided), Supabase **Row Level Security** | Basic security |

**Hybrid model:** static event content stays in JSON (fast, offline); only the dynamic/per-user data lives in Supabase.

## 3. Project structure

```
delegate_app/
├─ app.js                  # Express entry (Hostinger startup file)
├─ package.json
├─ .env                    # SUPABASE_URL, SUPABASE_ANON_KEY, SUPABASE_SERVICE_ROLE_KEY, RESEND_API_KEY, APP_URL, FROM_EMAIL, NODE_ENV (not committed)
├─ /routes
│   ├─ public.js           # serves rundown/visits/speakers/contact JSON
│   ├─ me.js               # GET /me/hotel + /me/checkin (auth-gated) — the delegate's own data
│   └─ data.js             # announcements / notifications / feedback / favourites via Supabase
├─ /lib
│   ├─ supabase.js         # Supabase clients (anon for user, service-role for server) + requireAuth middleware
│   └─ reminders.js        # node-cron job: 1hr-before scan of rundown -> Resend reminder emails
├─ /scripts
│   ├─ seed-delegates.js   # CSV -> creates Supabase Auth users (admin API, autogen passwords); outputs email,password CSV; writes profile + hotel/checkin to tables
│   └─ send_credentials.py # Python + Resend API: emails each delegate their password (run later)
├─ /data
│   ├─ rundown.json        # days -> time-block items (time, title, venue, type, gather_time)
│   ├─ visits.json         # institutional visits & programs (grid items: place, time, address, desc)
│   ├─ speakers.json       # name, title, topic, session time/venue, bio, photo
│   ├─ hotels.json         # hotelId -> name, address, map, transport, contacts
│   ├─ checkin.json        # check-in step template (dummy now: reception steps, what to present)
│   └─ contact.json        # org contacts, emails, phones, socials, venue address
└─ /public
    ├─ index.html          # maximalist UI: login, 6 nav tabs, notifications bell + panel
    ├─ /css/app.css        # Jakarta palette, maximalist styling
    ├─ /js/app.js          # tab nav, fetch content, login, notifications/pop-ups
    ├─ /img                # logo, speaker photos
    └─ manifest.json       # PWA install
```

## 4. Surfaces (tabs + notifications)

Bottom nav holds the 5 primary tabs; the header carries a **notification bell** (Facebook-style: unread dot → opens the Updates panel as a right-side overlay) and a **hamburger menu** (left-side slide-in panel) holding **Contact us**, a CSCD website link, and **Sign out**. Contact remains a full screen — the menu just navigates to it.

1. **Dashboard** (post-login landing) — personalized for the delegate: greeting by name, **hotel summary**, **today's rundown at a glance** (next item highlighted), a **check-in CTA**, and the latest announcement. The "all your info in one place" welcome screen the client described.
2. **Rundown** — the core. A clean **vertical time-block timeline** for each day (`02:00 PM`, `02:30 PM`, `03:00 PM`…), each item: title, venue, type badge, optional "gather at" time. Day tabs. Live **Now/Next** highlight. Source: `rundown.json`.
3. **Institutional Visits & Programs** — **column/grid** layout of visit cards (place, time, address, short description, map link). One shared set for all delegates (no per-group split). Populated later. Source: `visits.json`.
4. **Speakers** — card list → detail (bio + their session time/venue). Source: `speakers.json`.
5. **Hotel & Check-in** — **login-gated.** The delegate's own hotel (name/address, check-in/out, room, booking ref, meals, WiFi, transport, emergency contacts) **plus the Guided Check-in** step-by-step card: *go to reception → present passport/ID → staff finds you on the list → state your program name → receive room allocation.* Dummy text now, real details later. Source: delegate row + `hotels.json` + `checkin.json`.
6. **Contact us** *(reached from the hamburger menu, not the bottom nav)* — CSCD coordination contacts, emails, phone, venue address/map, socials, plus the feedback form. Source: `contact.json`.

**Notifications bell / Updates panel** (header, all screens) — a scrollable feed combining (a) **admin announcements** ("gather in the lobby at 8:30 PM") and (b) **auto reminders** ("your 3:00 PM visit starts in 1 hour"). Unread badge count; tap an item to mark read. See §6b.

## 5. Auth & data flow (Supabase Auth)

**Decisions locked:** accounts are **pre-created by us** from the client's list — there is **no open self-registration** ("sign up" = the delegate's first login). The **rundown and institutional visits are shared by all delegates**; only hotel/check-in data is per-delegate.

1. Client sends delegate list: **name, email, Delegate/Frankfurt ID, hotel assignment** (+ booking details).
2. Run `seed-delegates.js` once → for each delegate, **creates a Supabase Auth user** (admin API) with an **auto-generated password**, and inserts their profile row (name, frankfurt_id, hotel_id, booking details) into the `delegates` table. Outputs an `email,password` CSV once for distribution.
3. **Send credentials (later):** `send_credentials.py` reads that CSV and emails each delegate their password via the **Resend API**. Separate Python step, run when participant emails are final.
4. **Login:** front end calls **Supabase Auth** (`signInWithPassword`); Supabase issues a JWT/session stored client-side.
5. **Hotel data:** `GET /me/hotel` → server `requireAuth` verifies the Supabase JWT → looks up that user's `delegates` row → returns their hotel record (joined with `hotels.json`). Row Level Security also restricts each delegate to their own row.
6. **Logout:** Supabase `signOut`.
7. Auth endpoints are rate-limited; passwords are managed entirely by Supabase (hashed, never in our files).

### Password reset (built-in)
- **Forgot password (logged out):** Supabase `resetPasswordForEmail` → emails a one-time reset link (via Resend SMTP) → reset page calls `updateUser({ password })`. No custom token/bcrypt code needed.
- **Change password (logged in):** `updateUser({ password })`.

## 5b. Supabase schema (tables + RLS)

- **`delegates`** — `id` (= auth user id, FK to `auth.users`), `name`, `email`, `frankfurt_id`, `hotel_id`, `room`, `booking_ref`, `check_in`, `check_out`, `meals`. *RLS: a delegate can read only their own row.*
- **`favourites`** — `id`, `user_id` (FK), `session_id`, `created_at`. *RLS: owner-only read/write.*
- **`feedback`** — `id`, `user_id` (nullable), `session_id` (nullable), `rating`, `comment`, `created_at`. *RLS: insert by authenticated users; read restricted to admins.*
- **`announcements`** — `id`, `title`, `body`, `active`, `pinned`, `created_at`. Admin-created Updates ("gather in the lobby at 8:30"). *RLS: public read of active rows; writes via dashboard/service role only.*

Server uses the **service-role key** (never exposed to the browser) for `seed-delegates.js` and admin reads; the browser uses the **anon key** under RLS.

Notes: the **rundown** and **institutional visits** are static JSON (not DB tables) — fast and editable by file. **Auto-reminders are computed from the rundown**, not stored as rows. The bell's **read/unread state is kept per device in `localStorage`** (no table needed now; can move to Supabase later if cross-device sync is wanted).

## 6. Design language (minimalist, professional)

- Base: cream `#F9F6F0` + near-black `#050505`/charcoal `#2C2825`, lots of whitespace.
- **Accent: electric yellow `#E6EB1C`, used sparingly** — the active bottom-nav indicator, one CTA, a slim "now" marker on the rundown, a soft inset text highlight, keynote/visit badge tints. Most surfaces stay cream/white/ink.
- **Pink `#EA0558` as a single signal** — essentially just the small unread dot on the bell / Updates items (and inline form errors). The app must read professional, not "pink".
- Type: **Cinzel** display headings (lighter 400/600 weights), **Cormorant Garamond** serif accents/quotes, **Lato** body/UI.
- Minimalism via whitespace, **hairline 1px dividers**, rounded corners, pill badges/tabs, and at most a very soft card shadow — **no heavy/offset block shadows**. Mobile-first, large tap targets, sticky bottom tab bar.

## 6b. Notifications & reminders (phased)

We are a **web app/PWA, not a native app** — this dictates what's possible. Three layers, built in priority order:

**Phase 1 — ship now (in-app, 100% reliable when app is open)**
- **Updates feed + notification bell** (header, all screens): merges admin `announcements` + computed reminders; unread badge; tap to mark read (localStorage).
- **Pop-up modals:** critical alerts shown as an overlay when the delegate has the app open.
- **In-app reminders:** while open, the client computes "1 hour before" items from the rundown and surfaces them in the bell + a pop-up.

**Phase 1 — universal backstop (works even when app is closed)**
- **Email reminder via Resend:** a `node-cron` job scans the rundown each minute; ~1 hour before each item it emails the relevant delegates ("your 3:00 PM visit starts in 1 hour"). This is the only channel that reaches **every** delegate regardless of device/permission/install — the dependable layer. WhatsApp group remains the client's primary coordination channel.

**Phase 2 — later, lowest priority**
- **Web Push** (service worker + VAPID + server send) so reminders buzz the phone even when the app is closed. Works well on Android; on iPhone only if the delegate "Adds to Home Screen" (iOS 16.4+). Deferred until everything else is done.

## 7. Deployment (Hostinger)

**Settled:** subdomain **`delegateapp.thecscd.org`** · sender **`noreply@thecscd.org`** (Resend, already set up — API key + reset/credential domain to be shared at the end) · header logo **`CSCD-logo-0155.png`** (wide transparent PNG; a square icon will be derived for the PWA).

- hPanel → **Setup Node.js App** → Node version, app root = this folder, **startup file `app.js`**, point to **`delegateapp.thecscd.org`**.
- `npm install` in hPanel, set env vars (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`, `APP_URL`, `FROM_EMAIL`), restart app.
- In the Supabase dashboard (project already created — `Delegate_app_cscd`): run the schema/RLS, set **custom SMTP = Resend** (so auth/reset emails come from `@thecscd.org`), and add the app URL to allowed redirect URLs.
- Express serves both API and `/public` static assets; host provides HTTPS.

## 8. Committed feature scope (beyond the core surfaces)

All of the following are in scope (multi-language toggle is explicitly **out**).

**Quick wins**
- **PWA install + offline cache:** `manifest.json` + icons (pin to home screen) and a service worker caching static content so rundown/speakers load on poor venue wifi.
- **Live "Now / Next" banner** on Rundown: auto-highlights the current and next item by time + venue.
- **Tap actions:** tap-to-call, tap-to-email, and **"Open in Google Maps"** (deep-links to the native Maps app) on the Hotel, each Institutional Visit, and Contact venue; **"Add to calendar" (.ics)** on each rundown item.
- **Venue/room map images** surfaced in Rundown/Speakers so delegates can find rooms.
- **Personal welcome:** logged-in header greets the delegate by name.

**Medium**
- **Search/filter** on Rundown & Speakers (by day, room, name).
- **"My schedule" / favourites:** star sessions, stored in **Supabase `favourites`** (synced across the delegate's devices).
- **Updates feed + notification bell** (now in core scope, §4/§6b): admin announcements from **Supabase `announcements`**, edited from the dashboard — no redeploy.
- **Practical info card:** local emergency numbers, embassy contacts, currency, weather, dress code, prayer times.

**Later / once materials exist**
- **QR code per delegate** generated from their ID (badge/check-in).
- **Feedback form** (per session or overall) → stored in **Supabase `feedback`**; reviewable from the dashboard.
- **Speaker slides/links** section.

**Operational**
- **Daily JSON backups** + a tiny **`/health`** endpoint to confirm the app is up.
- **Documented "edit JSON → restart app" flow** so non-devs can update content live.

> Note: multi-language toggle is intentionally excluded per decision.

## 9. Open items (need from client)

- Delegate list: **name, email, Delegate/Frankfurt ID, hotel assignment** + booking details.
- Hotel data: name, **full address + Google Maps link/coordinates**, check-in/out, room types, meals, WiFi, transport, emergency contacts.
- Final **rundown** (days, time blocks, **venues**, item types, any "gather at" times) and speaker list (bios, topics, photos, session slots).
- **Institutional Visits & Programs:** each visit's place, time, **address + map link**, and short description.
- **Guided Check-in** real wording (the reception/passport/program-name steps) — dummy placeholder used until provided.
- Who will **post announcements** during the event (so we set up their Supabase dashboard access), and confirm the **1-hour-before reminder** timing/wording + scope (all items vs only "notify" items) + **event time zone** (assume Jakarta WIB, UTC+7).
- Org contact details for the Contact section.
- Event name for the header (e.g. "YPDS Jakarta 2026").
- **Resend API key** — to be shared at the end (sender `noreply@thecscd.org` already configured).

### Settled
- Subdomain: **`delegateapp.thecscd.org`** · Sender: **`noreply@thecscd.org`** (Resend) · Logo: **`CSCD-logo-0155.png`**.
- Supabase project: **Delegate_app_cscd** (`govbfxytrdxpmutxbkds`, Frankfurt, `https://govbfxytrdxpmutxbkds.supabase.co`), MCP connected with **read-write** access (token to be rotated — see CLAUDE.md).
- Accounts pre-created (no self sign-up) · one shared rundown/visits · notifications = in-app + email now, Web Push later.
