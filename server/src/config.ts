// Everything that differs between your laptop and a deployed server comes from environment variables.
const list = (value = '') =>
  value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

export const config = {
  port: Number(process.env.PORT ?? 3001),
  // Turso (hosted SQLite, for Render): with these set, writes go to Turso and a local copy serves reads.
  // Empty = the local file below, as always. See docs/DEPLOY_RENDER_TURSO.md.
  turso: {
    url: process.env.TURSO_DATABASE_URL ?? '',
    token: process.env.TURSO_AUTH_TOKEN ?? '',
  },
  // Which SQLite library: Node's built-in (default) or Turso's 'libsql' (always used with Turso; set
  // DB_DRIVER=libsql to try it on a local file, as `npm run test:libsql` does).
  dbDriver: process.env.TURSO_DATABASE_URL ? 'libsql' : (process.env.DB_DRIVER ?? 'sqlite'),
  // Relative to where you run `npm run server` (the project root). ':memory:' is used by tests.
  // With Turso it's only the local copy, kept apart so it can never be mistaken for the real local database.
  dbPath:
    process.env.DB_PATH ?? (process.env.TURSO_DATABASE_URL ? 'server/data/turso-copy.db' : 'server/data/comoonly.db'),
  isProd: process.env.NODE_ENV === 'production',
  sessionDays: 14,
  // People with these emails can review events found by the event finder, e.g. ADMIN_EMAILS=you@mail.com
  adminEmails: list(process.env.ADMIN_EMAILS),
  // The Gmail that sends sign-up codes. Empty = codes are printed in the server log instead.
  email: {
    user: process.env.EMAIL_USER ?? '',
    pass: process.env.EMAIL_APP_PASSWORD ?? '',
  },
  // The AI that reads event posts and pages without structured data. Any OpenAI-compatible endpoint works:
  // Google Gemini's free tier is the default in .env.example; Groq or Ollama also work. Empty = AI off.
  ai: {
    baseUrl: process.env.AI_BASE_URL ?? '',
    apiKey: process.env.AI_API_KEY ?? '',
    model: process.env.AI_MODEL ?? '',
  },
  // Instagram's official API (Hashtag Search + Business Discovery). Empty = the Instagram reader is off.
  // You get both values after Meta approves your app; see README "Instagram reader".
  instagram: {
    // Meta retires API versions about two years after release; bump this when they warn you.
    apiUrl: process.env.INSTAGRAM_API_URL ?? 'https://graph.facebook.com/v23.0',
    token: process.env.INSTAGRAM_TOKEN ?? '',
    userId: process.env.INSTAGRAM_USER_ID ?? '', // your Instagram professional account's id
  },
}
