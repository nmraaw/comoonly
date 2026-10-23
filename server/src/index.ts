import { app } from './app.ts'
import { config } from './config.ts'
import { seedIfEmpty } from './db/seed.ts'

// Entry point: `npm run server`. The app starts empty; real people sign up.
// SEED_DEMO=1 fills an empty database with sample people and groups (handy for a quick local try-out).
if (process.env.SEED_DEMO === '1') seedIfEmpty()

app.listen(config.port, () => {
  console.log(`Comoonly API on http://localhost:${config.port}`)
})
