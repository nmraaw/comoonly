# Running Comoonly: owner's guide

## 1. Where your users' data is stored

Everything (accounts, profiles, groups, chats, events, notifications) is in **one SQLite database
file** that your Node.js server reads and writes:

- **On your computer:** `server/data/comoonly.db`
- **Online (Railway):** `/data/comoonly.db` on a **volume**, Railway's name for a permanent disk that
  survives restarts and new deploys.

People's browsers never touch the file; they ask your server, and the server checks permissions first.
Passwords are stored as one-way hashes, never as text. The full table-by-table explanation is in
[DATABASE.md](DATABASE.md).

**Backups:** Me → Your dashboard → **Download a backup** saves a complete copy of the database. Do it
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

You're an admin because your email is in `ADMIN_EMAILS`. Admin tools appear only for you; for everyone
else the server refuses them even if they type the address.

| Where | What you can do |
|---|---|
| **Me → Your dashboard** | Totals (people, new this week, groups, live events, to review, open reports). **People**: everyone who signed up, with email and join date, and **Delete** for data-deletion requests. **Events**: all events and how many are going. **Reports**: what people reported; **Mark as handled**. **Download a backup**. |
| **Discover → Events → Review new events** | **Find new events** runs the event finder now. Fix, **Publish** or **Reject** each draft (found by the finder, suggested by people, or read from Instagram). **Add an event yourself**. |
| **Events → Suggest an event** | Paste an Instagram/TikTok link plus the caption or a poster screenshot; Gemini fills it in and it waits in your review queue. |

Things the server does on its own (online only): every 12 hours it looks for new events and deletes
drafts whose date or registration deadline has passed.

### Settings

On your computer they're in `.env` (never uploaded to GitHub); online they're Railway **Variables**.

| Setting | What it's for |
|---|---|
| `ADMIN_EMAILS` | Your email(s), comma-separated. Whoever signs up with one is an admin. |
| `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL` | Gemini, for reading event posts (see `.env.example`). |
| `INSTAGRAM_TOKEN`, `INSTAGRAM_USER_ID` | After Meta approves your app (see the README). |
| `DB_PATH` | Where the database file lives. Online: `/data/comoonly.db`. |

## 4. Putting the code on GitHub

GitHub keeps your code safe online, and Railway deploys from it. Your project already has Git history
(every change I made is a saved "commit"); this uploads it.

1. Create a free account at **github.com**.
2. Install **GitHub Desktop** from desktop.github.com and sign in with that account.
3. **File → Add local repository…** → choose the `comoonly` folder on your Desktop.
4. Click **Publish repository**. Name: `comoonly`. Keep **"Keep this code private"** ticked → **Publish**.
5. From now on, after changes are committed, click **Push origin** to upload them.

Never uploaded, on purpose: `.env` (your keys), `server/data` (users' data), `node_modules`, `dist`.
For the hackathon, judges need access: either untick "private" (Repository → Repository settings), or
invite them on github.com → your repo → Settings → Collaborators.

## 5. Putting the app online (Railway)

Railway's Hobby plan is about $5/month and includes $5 of usage, which a small app like this fits in
(check railway.com/pricing). It gives your app a permanent disk and an https address.

1. Go to **railway.com** → **Login with GitHub**. Choose the Hobby plan.
2. **New Project → Deploy from GitHub repo** → pick `comoonly` (allow Railway to see it if asked).
3. Open the service → **Settings**:
   - **Build command:** `npm ci --include=dev && npm run build`
   - **Start command:** `npm start`
   - **Healthcheck path:** `/api/health`
4. **Add a volume:** on the project canvas, right-click the service → **Attach volume** → mount path
   `/data`. This is where the database lives.
5. **Variables** tab → add:
   - `DB_PATH` = `/data/comoonly.db`
   - `ADMIN_EMAILS` = your email
   - `AI_BASE_URL`, `AI_API_KEY`, `AI_MODEL`: copy from your `.env`
6. **Settings → Networking → Generate Domain**. You get an address like
   `https://comoonly-production.up.railway.app`.
7. **Straight away, open that address and sign up with your `ADMIN_EMAILS` email.** Emails aren't
   verified, so be the first to register it before you share the link.
8. Share the link. Every time you **Push origin** in GitHub Desktop, Railway rebuilds and redeploys by
   itself. Database changes (new files in `server/src/db/migrations`) apply automatically on start.

Logs: Railway → your service → **Deployments** → the latest one → **View logs**.

The screens on Railway change from time to time; if a button has moved, the same words are usually
in its search box (top of the dashboard).
