# Putting Comoonly online: Render + Turso

**Goal:** a public https link that works when your Mac is off, for free, with no card, and without losing data.

- **Render** runs the app (website + API), free plan. Its disk is wiped on every restart, so no data lives there.
- **Turso** keeps the database (a hosted SQLite), free plan. Data stays there permanently.
- **UptimeRobot** visits the app every 5 minutes so Render's free server never falls asleep.
- **GitHub** (a *private* repository) holds the code; Render builds the app from it.

Your Mac version keeps working exactly as now until the very last step, and is the way back if anything goes wrong.

---

## How the switch works (the setting)

The app picks its database from settings (environment variables):

| Setting | Where | What it does |
|---|---|---|
| *(nothing set)* | your Mac, tests | the local file `server/data/comoonly.db`, as always |
| `DB_DRIVER=libsql` | tests only | same local file/memory, but through Turso's `libsql` library (to check compatibility) |
| `TURSO_DATABASE_URL` + `TURSO_AUTH_TOKEN` | Render | a local copy that reads fast, with every write sent to Turso |

Nothing changes on your Mac unless you set those.

---

## Checklist

Tick each step. **Steps marked 🛑 wait for your approval.**

### A. Before anything goes online (done on the Mac, safe)
- [ ] A1. All tests pass with the normal database: `npm test`.
- [ ] A2. All tests pass through Turso's library: `npm run test:libsql`.
- [ ] A3. The Mac app still starts and works as before.

### B. Accounts (you, about 20 minutes, all free, no card)
- [ ] B1. **GitHub:** create a **private** repository called `comoonly`. *(Private: the code and, later, nothing personal is public.)*
- [ ] B2. **Turso:** sign up at turso.tech with GitHub. Create a database called `comoonly` in the region closest to Render's (e.g. Frankfurt with Render Frankfurt). Create a **token** for it. Keep the **database URL** (`libsql://comoonly-….turso.io`) and the **token**; they're passwords, never post them.
- [ ] B3. **Render:** sign up at render.com with GitHub. Don't create anything yet.
- [ ] B4. **UptimeRobot:** sign up at uptimerobot.com. Don't create anything yet.

### C. Code to GitHub (Claude, after you create the repository)
- [ ] C1. Push the code to your private repository. `.env` and `server/data/` (keys and real data) are never pushed; that's already set in `.gitignore`.

### D. 🛑 Copy the real data to Turso (only after your approval)
- [ ] D1. Pick a quiet time. Tell beta users the app will pause for ~15 minutes.
- [ ] D2. Stop the Mac app, so nobody writes while copying.
- [ ] D3. Make a backup copy of `server/data/comoonly.db` (kept on your Mac; it's the rollback).
- [ ] D4. Make one clean copy of the database (`VACUUM INTO`), with the app stopped.
- [ ] D5. Copy it into the (empty) Turso database: `node --env-file=<Turso settings> server/scripts/copy-to-turso.ts <copy.db>`. It creates the tables, copies every row, and checks counts and picture sizes match. It refuses to run if Turso already has people in it.
- [ ] D6. The script's last line must say "All … tables match". Anything else: stop, nothing is switched yet.
- [ ] D7. Start the Mac app again (still the live link until step F).

### E. 🛑 Deploy on Render (only after your approval)
- [ ] E1. In Render: **New → Blueprint**, pick the repository. It reads `render.yaml` (free plan, Node 24, health check).
- [ ] E2. Fill in the secret settings in Render's dashboard: `TURSO_DATABASE_URL`, `TURSO_AUTH_TOKEN`, `ADMIN_EMAILS`, `AI_API_KEY`, `AI_MODEL`, `INSTAGRAM_TOKEN`, `INSTAGRAM_USER_ID` (and `EMAIL_USER` / `EMAIL_APP_PASSWORD` if set up).
- [ ] E3. Wait for "Live". Open `https://<name>.onrender.com/api/health` → `{"ok":true}`.
- [ ] E4. Log in as yourself; check events with posters, a profile photo, a chat, a voice message, a crew.
- [ ] E5. Make one test change (e.g. edit your bio), restart the service in Render (**Manual Deploy → Restart**), and check the change is still there. *This proves the data survives restarts.*
- [ ] E6. In UptimeRobot: **New monitor → HTTP(s)**, URL `https://<name>.onrender.com/api/health`, every **5 minutes**.

### F. 🛑 Switch the public link (only after your approval)
- [ ] F1. Share the Render link with beta users and put it in the hackathon submission.
- [ ] F2. Turn off the Mac app and Tailscale Funnel (`tailscale funnel --https=443 off`), so there's one app, not two copies drifting apart.

### G. During judging (27 Oct – 1 Nov)
- [ ] G1. Don't push code updates unless something is broken. Each one restarts the app (data is safe, but a deploy that fails leaves the old version running).
- [ ] G2. Glance at UptimeRobot once a day: it emails you if the app is down.

---

## Rollback plan (how to go back)

**Before step F (nothing switched yet):** nothing to undo. The Mac app is still the live one. Delete the Render service and the Turso database if you like.

**After step F, if the Render version misbehaves:**
1. Start the Mac app again (`npm run live`) and turn the Tailscale link back on (`tailscale funnel --bg 3001`).
2. Share the Tailscale link again (and update the submission if needed).
3. **Data:** anything done on Render since the switch lives in Turso, not on the Mac. To bring it back, export it from Turso (`turso db shell comoonly .dump > comoonly.sql`, then load it into a new local file) **before** pointing people back at the Mac. If you don't need it, the Mac still has everything up to the switch.
4. Keep the backup from step D3 untouched until judging is over.

**If Turso has a problem but Render is fine:** Render shows the error in its logs; the app won't start without its database. Roll back as above.

**If a code update breaks the Render app:** in Render, open the service → **Events** → pick the last working deploy → **Rollback**. Data isn't affected (it's in Turso).

---

## Known limits on this setup
- Each save (a message, a crew, a photo) travels to Turso: about 30–150 ms. Reading is local and fast.
- The admin "Download a backup" button is switched off on Render (it can't make a file from Turso there). Back up with `turso db shell comoonly .dump` instead.
- Sign-up codes still go to the log until Gmail is set up (`EMAIL_USER`, `EMAIL_APP_PASSWORD`).
