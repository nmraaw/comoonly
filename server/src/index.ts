import { app } from './app.ts'
import { config } from './config.ts'
import { seedIfEmpty } from './db/seed.ts'
import { scanSources } from './modules/events/events.finder.ts'
import { tidyEvents } from './modules/events/events.service.ts'

// Entry point: `npm run server`. The app starts empty; real people sign up.
// SEED_DEMO=1 fills an empty database with sample people and groups (handy for a quick local try-out).
if (process.env.SEED_DEMO === '1') seedIfEmpty()

// Every 12 hours: delete stale drafts, then look for new events (they wait in the review queue).
// Only in production (or with AUTO_FIND=1): during development the server restarts on every save,
// which would hit the event sites and your free AI quota over and over.
async function findEvents() {
  console.log('Tidied events', tidyEvents())
  try {
    console.log('Event finder', JSON.stringify(await scanSources()))
  } catch (err) {
    console.error('Event finder failed', err)
  }
}
if (config.isProd || process.env.AUTO_FIND === '1') {
  setTimeout(findEvents, 60_000) // a minute after start, so a crash-and-restart loop can't spam the sites
  setInterval(findEvents, 12 * 3_600_000)
}

app.listen(config.port, () => {
  console.log(`Comoonly API on http://localhost:${config.port}`)
})
