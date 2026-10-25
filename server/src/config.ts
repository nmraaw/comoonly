// Everything that differs between your laptop and a deployed server comes from environment variables.
const list = (value = '') =>
  value
    .split(',')
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean)

export const config = {
  port: Number(process.env.PORT ?? 3001),
  // Relative to where you run `npm run server` (the project root). ':memory:' is used by tests.
  dbPath: process.env.DB_PATH ?? 'server/data/comoonly.db',
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
