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

**Suggest an event:** anyone can share an event they saw on Instagram, TikTok, WhatsApp or a poster
(link + caption and/or screenshot). The AI reads it and it joins the review queue with "Suggested by".
We don't scrape Instagram or TikTok: their terms forbid it.

**Keeping it fresh:** the AI is told today's date (so "Sat 2 Nov" gets the right year). Events that are
over, past their registration deadline, or more than ~13 months away are dropped. In production the server
looks for new events every 12 hours and deletes drafts whose date or deadline has passed.

Admins are the emails in `ADMIN_EMAILS`. The AI is Google Gemini's free tier by default (see `.env.example`
for the 3-step setup); Groq or Ollama also work. Before adding a source, check that site allows automated
reading (its terms of use and robots.txt).

## Instagram reader (official API, off until you set it up)

Reads public posts with your hashtags, and the latest posts of organizer accounts you list, through Meta's
official Instagram API. Posts older than 7 days, posts already checked, and posts with no sign of an event
are skipped; the rest go to the AI and land in the review queue. Edit the lists in
`server/src/modules/events/instagram.json` (max 30 different hashtags a week; organizer accounts must be
business or creator accounts).

To switch it on (Meta changes these screens often, so follow their current docs if something differs):

1. In the Instagram app, switch your account to a **professional** (creator or business) account.
2. Create a **Facebook Page** and link your Instagram account to it.
3. At developers.facebook.com, create an app and add the **Instagram** product (with Facebook Login).
4. Request the permissions for **Hashtag Search** and **Business Discovery** (including "Instagram Public
   Content Access"), complete **business verification** and **App Review** (they ask for a screen recording
   of the app). This can take from days to a couple of months.
5. Put the access token and your Instagram account id in `.env` as `INSTAGRAM_TOKEN` and
   `INSTAGRAM_USER_ID`. Normal user tokens expire after about 60 days; a **System User** token from Meta
   Business Suite doesn't, so use that if you can.

It then runs with the rest of the event finder (every 12 hours in production, or **Find new events**).
It is tested against a stand-in for Meta's API, not the real one yet: expect small fixes on first real use.

## Put it online

Step-by-step for GitHub and hosting (Railway, with a permanent disk for the database), how to use
your admin tools, and where users' data is stored: **[docs/RUNNING.md](docs/RUNNING.md)**.
The data model and its design decisions: **[docs/DATABASE.md](docs/DATABASE.md)**.
