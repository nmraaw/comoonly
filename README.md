# Comoonly

Small groups, actual plans. Find people nearby who want to do the same thing, ask to join their group,
then chat, plan activities and share to-dos together. An event finder collects upcoming events
(hackathons, workshops, competitions) so people can find others to go with.

- **Frontend:** React + Vite (`src/`)
- **Backend:** Node.js + Express, TypeScript run directly by Node (no build step), built-in SQLite, Zod (`server/`)

## Run it on your computer

Needs Node.js 24 or newer.

```bash
npm install
cp .env.example .env      # then edit .env if you like
npm run server            # backend on http://localhost:3001 (restarts when you save)
npm run dev               # in a second terminal: the website, opens on http://localhost:5173
```

Open the website, sign up, and create your profile. The database is the file `server/data/comoonly.db`;
delete it to start fresh. To try the app with sample people and groups instead, start the backend with
`SEED_DEMO=1 npm run server` on an empty database (every sample person's password is `comoonly-demo`).

```bash
npm test                  # backend tests
npm run lint
```

## How the code is organised

```
server/src/
  index.ts  app.ts  config.ts      start the server, wire features together, settings
  db/                              connection, schema.sql (all tables), seed (sample data)
  middleware/                      login check, error handling
  modules/<feature>/               one folder per feature:
    *.routes.ts                    HTTP only: read request, call service, send response
    *.service.ts                   the logic and database queries
    *.schema.ts                    what valid input looks like (Zod)
```

Features: `auth` (sign up, log in), `people` (profiles, connections), `groups` (feed, create, saved),
`requests` (ask to join, host accepts/declines), `chat` (group and private messages),
`workspace` (activities, to-dos), `events` (event finder, review queue, "find people to go with").

The frontend reaches the backend through `src/api.ts`. Shared app state (who's logged in, groups,
memberships) lives in `src/state/MockProvider.tsx`; each screen loads its own data with `useApi()`.

## Event finder

1. `server/src/modules/events/sources.json` lists the public pages to check. Edit it any time.
2. An admin opens **Discover → Events → Review new events** and presses **Find new events**.
3. Each page is read for schema.org event data (JSON-LD, which most event sites include for search
   engines). If a page has none and an AI provider is set in `.env`, the AI reads the page text instead.
4. Every result is checked; anything malformed or already past is thrown away. New ones wait as drafts.
5. The admin fixes, publishes or rejects each one. Nothing is published automatically.
6. Published events show their official registration link and **Find people to go with**, which opens
   one shared group (with chat) per event.

Admins are the emails in `ADMIN_EMAILS`. The AI is optional and free options work: Groq's free tier,
or Ollama running on your own computer (see `.env.example`). Before adding a source, check that site
allows automated reading (its terms of use and robots.txt).

## Put it online

The production server serves both the API and the built website from one address, so logins just work.

```bash
npm install
npm run build             # builds the website into dist/
npm start                 # production mode on $PORT (default 3001)
```

On a host such as Render or Railway: build command `npm install && npm run build`, start command
`npm start`. SQLite is a file, so attach a **persistent disk** and set `DB_PATH` to a file on it
(for example `/var/data/comoonly.db`); without it, data is lost on every deploy. Set `ADMIN_EMAILS`
(and the AI settings, if used) in the host's environment settings. The site must be served over https,
because the login cookie is marked Secure in production.
