# Comoonly

Find your kind of people. Comoonly is for everyone who has interests but no community: it connects
people who like the same things, online or in real life. Talk in communities, team up on ideas (or revive
someone's unfinished one), and when you want to, go to real events together so you're never alone.

**Live app:** https://comoonly.onrender.com (admin: `/admin/`). Sign up with your email (a 6-digit code
is emailed), pick your interests, and Comoonly shows you who and what fits you.

**What it does**
- **Communities:** around any interest (16 to pick from, or your own). "For you" matching with a reason
  ("You like Drawing · Lahore"), alerts when a new one starts nearby, upcoming events for each one.
- **The Idea Graveyard:** post an idea you couldn't finish (how far it got, why it stopped, what it needs).
  Others offer help or adopt it; the original creator stays credited and its story is kept.
- **Chat that keeps people coming back:** polls, icebreakers, photos, voice messages, a
  pinned plan.
- **Events:** found by an AI from Instagram and event sites, or snapped from a poster with your camera;
  checked by an admin. Prices, budget filter, "✨ Plan my weekend".
- **Going together:** a general chat per event, **crews** of 2 to 5 (women-only optional), and
  "✨ Find me a crew", which matches people going alone by shared interests. Ride together, split costs,
  "Still coming?" and "I'm here" on the day, a show-up score, and a shareable crew memory card.
- **Trust and safety:** email-verified sign-up, ✓ Verified profiles, message requests, block and report.
- **Admin:** dashboard, review queue, posters.

**Built with**
- **Frontend:** React + Vite + TypeScript (`src/`), mobile first.
- **Backend:** Node.js 24 + Express, TypeScript run directly by Node, Zod validation (`server/`).
- **Database:** SQLite with versioned migrations, foreign keys, CHECK rules and a trigger
  ([docs/DATABASE.md](docs/DATABASE.md)). Locally a file; online the same SQLite hosted on Turso.
- **Hosting:** Render (free) + Turso (free); email through a Gmail Apps Script relay.
- **Tests:** 27 API and database tests, run on both SQLite libraries (`npm test`, `npm run test:libsql`).

## Run it on your computer

Needs Node.js 24 or newer.

```bash
npm install
cp .env.example .env      # then edit .env if you like
npm run server            # backend on http://localhost:3001 (restarts when you save)
npm run dev               # in a second terminal: the website, opens on http://localhost:5173
```

Open the website, sign up, and create your profile (without email settings, sign-up codes are printed in the
backend's log). The database is the file `server/data/comoonly.db`;
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
  db/                              connection (local SQLite or Turso), migrations/ (all tables), seed (sample data)
  middleware/                      login check, error handling
  modules/<feature>/               one folder per feature:
    *.routes.ts                    HTTP only: read request, call service, send response
    *.service.ts                   the logic and database queries
    *.schema.ts                    what valid input looks like (Zod)
```

Features: `auth` (sign up with email code, log in, password reset), `people` (profiles, socials, connections),
`groups` (feed, create, saved, photos), `requests` (ask to join, host accepts/declines), `chat` (private,
group and crew chats, voice messages), `events` (event finder, review queue, going, crews), `notifications`,
`safety` (block, report), `admin`. Pictures and voice notes: `server/src/photos.ts`.

The frontend reaches the backend through `src/api.ts`. Shared app state (who's logged in, groups,
memberships) lives in `src/state/AppProvider.tsx`; each screen loads its own data with `useApi()`.
New to the code? Start with **[docs/Comoonly code guide.pdf](docs/Comoonly%20code%20guide.pdf)**.

## Event finder

1. `server/src/modules/events/sources.json` lists the public pages to check. Edit it any time.
2. An admin opens the admin interface at **/admin/ → Review events** and presses **Find new events**.
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


