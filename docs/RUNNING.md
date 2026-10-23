# Running Comoonly: owner's guide

## 1. Where your users' data is stored

Everything (accounts, profiles, groups, chats, events, notifications) is in **one SQLite database
file** that your Node.js server reads and writes:

- **On your Mac:** `server/data/comoonly.db`. This is also where the live site's data lives while
  your Mac hosts it (section 5). It's never uploaded to GitHub.
- **If you later move to a paid host:** a file on that host's permanent disk, set with `DB_PATH`.

People's browsers never touch the file; they ask your server, and the server checks permissions first.
Passwords are stored as one-way hashes, never as text. The full table-by-table explanation is in
[DATABASE.md](DATABASE.md).

**Backups:** `/admin/` → Dashboard → **Download a backup** saves a complete copy of the database. Do it
weekly and before big changes, and keep it somewhere private: it contains everyone's data.

## 2. Running it on your computer

Two terminals, while you're developing:

```bash
npm run server      # the backend on http://localhost:3001 (restarts when you save)
npm run dev         # the website on http://localhost:5173: open this one
```

Or exactly like the live site, as one program on one address:

```bash
npm run build
npm start           # open http://localhost:3001
```

Checks before you share changes: `npm test`, `npm run lint`, `npm run format`.

## 3. Your admin side (the "server side" of the app)

Your admin tools are a **separate interface** at **`/admin/`** on your site (for example
`https://comoonly-production.up.railway.app/admin/`, or `http://localhost:5173/admin/` while developing).
It has its own login and its own code: the public app doesn't contain or link to it. Only accounts whose
email is in `ADMIN_EMAILS` get in, and the server refuses every admin request from anyone else.
Bookmark it.

| Where | What you can do |
|---|---|
| **/admin/ → Dashboard** | Totals (people, new this week, groups, live events, to review, open reports). **People**: everyone who signed up, with email and join date, and **Delete** for data-deletion requests. **Events**: all events and how many are going. **Reports**: what people reported; **Mark as handled**. **Download a backup**. |
| **/admin/ → Review events** | **Find new events** runs the event finder now. Fix, **Publish** or **Reject** each draft (found by the finder, suggested by people, or read from Instagram). **Add an event yourself**. |
| **Events → Suggest an event** | Paste an Instagram/TikTok link plus the caption or a poster screenshot; Gemini fills it in and it waits in your review queue. |

Things the server does on its own (online only): every 12 hours it looks for new events and deletes
drafts whose date or registration deadline has passed.

### Settings

They're in `.env` on your Mac (never uploaded to GitHub). Restart `npm run live` after changing them.

| Setting | What it's for |
|---|---|
| `ADMIN_EMAILS` | Your email(s), comma-separated. Whoever signs up with one is an admin. |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | Gemini, for reading event posts (see `.env.example`). |
| `INSTAGRAM_TOKEN`, `INSTAGRAM_USER_ID` | After Meta approves your app (see the README). |
| `DB_PATH` | Where the database file lives. Leave it out on your Mac; only needed on a paid host. |

## 4. Putting the code on GitHub

GitHub keeps your code safe online (and judges can read it there). Your project already has Git history
(every change I made is a saved "commit"); this uploads it.

1. Create a free account at **github.com**.
2. Install **GitHub Desktop** from desktop.github.com and sign in with that account.
3. **File → Add local repository…** → choose the `comoonly` folder on your Desktop.
4. Click **Publish repository**. Name: `comoonly`. Keep **"Keep this code private"** ticked → **Publish**.
5. From now on, after changes are committed, click **Push origin** to upload them.

Never uploaded, on purpose: `.env` (your keys), `server/data` (users' data), `node_modules`, `dist`.
For the hackathon, judges need access: either untick "private" (Repository → Repository settings), or
invite them on github.com → your repo → Settings → Collaborators.

## 5. Putting the app online for free, from your Mac

Your Mac runs the app and stores the data (`server/data/comoonly.db`). A free **tunnel** gives it a
public `https://` address, so people can reach it without you opening anything on your router.

**Good to know:** the site is online only while your Mac is on, awake and connected. Keep it plugged
in with the lid open. `npm run live` stops the Mac from sleeping while it runs. When you outgrow this,
a paid host (e.g. Railway, about $5/month) can take over: copy the database file across and set `DB_PATH`.

### Step 1: start the app in live mode

Stop the development servers first (`npm run server` / `npm run dev` use the same port), then:

```bash
npm run live
```

This builds the website, starts the server on port 3001 and keeps the Mac awake. Leave that
Terminal window open. Check `http://localhost:3001` works.

### Step 2: give it a public address with Tailscale Funnel (free, address never changes)

1. Download Tailscale from **tailscale.com/download/macos**. Use the **standalone** download, not the
   App Store version. Install it, open it, and sign in (Google is fine). The free Personal plan is enough.
2. In a **second** Terminal window:

   ```bash
   /Applications/Tailscale.app/Contents/MacOS/Tailscale funnel --bg 3001
   ```

   The first time, it prints a link to switch on Funnel (and HTTPS) for your account. Open it, allow
   it, and run the command again.
3. It prints your public address, like `https://your-mac.tail1234.ts.net`. That's your site, and it
   stays the same every time, so it's safe to share, bookmark and give to Meta for app review.
   Your admin interface is that address + `/admin/`.
4. To take the site offline: `/Applications/Tailscale.app/Contents/MacOS/Tailscale funnel reset`.

`--bg` keeps sharing after you close the window. After a restart, run `npm run live` again;
Tailscale usually resumes the funnel by itself (if not, repeat step 2.2).

### Quick alternative for a one-off demo: Cloudflare quick tunnel (no account)

Download `cloudflared-darwin-amd64.tgz` from github.com/cloudflare/cloudflared/releases, unpack it, then:

```bash
./cloudflared tunnel --url http://localhost:3001
```

It prints a `https://….trycloudflare.com` address. It's free and instant, but **the address changes
every time** and it's meant for testing, so use Tailscale for anything people should bookmark.

### Before you share the link

1. Open your public address and **sign up with both admin emails** (`ADMIN_EMAILS` in `.env`) before
   anyone else can register them; emails aren't verified.
2. Back up regularly: `/admin/` → Dashboard → **Download a backup**. Your Mac's Time Machine also
   covers `server/data/`. A copy made before going live is at `server/data/backup-before-going-live.db`.
3. The two "(test account)" users are for trying things out; delete them in `/admin/` → People once
   real people join. Their logins are in your private `.env`.
