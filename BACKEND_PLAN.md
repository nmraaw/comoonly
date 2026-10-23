# Comoonly backend plan (Node.js)

Deadline: submit Tue 27 Oct 2026. Started Fri 23 Oct. No hackathon rules beyond "Node.js backend".

## Stack
Node.js + Express + TypeScript (run with `tsx`), SQLite (built-in `node:sqlite`), Zod for validation,
session-cookie auth with hashed passwords, Claude API for event extraction. Backend lives in `server/`;
Vite forwards `/api` to it in development.

## Priorities and time (rough build time, excluding review)

| # | Piece | Priority | Time |
|---|-------|----------|------|
| 1 | Foundation: project, database schema, seed data, auth, error handling | P0 | 4-5 h |
| 2 | Groups: feed with filters/ordering, detail, create | P0 | 3 h |
| 3 | Join flow: request with intro, host accept/decline, spot counts | P0 | 3 h |
| 4 | AI event finder: sources, fetch, extract, review queue, publish | P0 | 7-8 h |
| 5 | Event groups: "find people to go with" + event chat | P0 | 2 h |
| 6 | In-app chat (group + direct) | P1 | 3 h |
| 7 | Frontend hookup (replace MockProvider with API) | P0 | 4 h |
| 8 | Workspace: activities + RSVP, to-dos | P1 | 2 h |
| 9 | Profiles and connections | P1 | 2 h |
| 10 | Report/block and restrictions | P2 | 2 h |
| 11 | Deployment, README, demo script, a few tests | P0/P2 | 4 h |

## Schedule
- Fri 23: 1, 2
- Sat 24: 3, start 4
- Sun 25: finish 4, 5, 6, 7
- Mon 26: 8, 9, 10, 11
- Tue 27: buffer and submit. If behind, drop 9 and 10 first.

## AI event finder (core feature)
1. `sources.json`: curated list of public pages/feeds (events, hackathons, workshops, competitions in Pakistan).
2. Fetch each source from Node, strip to readable text.
3. Claude extracts structured events (title, date, city, mode, category, description, official register link,
   source URL). Output is checked with Zod; anything malformed is discarded.
4. Saved as `draft`. Duplicates skipped by source URL + title/date.
5. Human review queue (admin only): approve, edit, or reject. Nothing is published automatically.
6. Published events appear in the feed with the official register link and "Find people to go with",
   which opens an event group with chat.
Every event keeps its source URL and links to the official registration.

## Code organisation
One folder per feature. Each has the same three kinds of file, each with one clear job:
- `*.routes.ts`: HTTP only (read request, call service, send response)
- `*.service.ts`: the logic and database queries
- `*.schema.ts`: Zod validation and types

```
server/src/
  index.ts  app.ts  config.ts
  db/         connection, schema.sql, seed
  middleware/ auth, validation, errors
  modules/
    auth/ groups/ requests/ events/ chat/ workspace/ people/ safety/
```
Rules: a file is ~40-150 lines; no one-line files; related things live together; Prettier formats everything;
comments explain why, not what. The frontend keeps its `useMock()` interface and gets an API-backed
provider, so UI components do not change.
