// Everything that differs between your laptop and a deployed server comes from environment variables.
const list = (value = '') => value.split(',').map((s) => s.trim().toLowerCase()).filter(Boolean)

export const config = {
  port: Number(process.env.PORT ?? 3001),
  // Relative to where you run `npm run server` (the project root). ':memory:' is used by tests.
  dbPath: process.env.DB_PATH ?? 'server/data/comoonly.db',
  isProd: process.env.NODE_ENV === 'production',
  sessionDays: 14,
  // People with these emails can review events found by the event finder, e.g. ADMIN_EMAILS=you@mail.com
  adminEmails: list(process.env.ADMIN_EMAILS),
  // Optional AI fallback for pages without structured event data. Any OpenAI-compatible endpoint works,
  // including free ones: Groq (https://api.groq.com/openai/v1), OpenRouter free models, or Ollama on your laptop
  // (http://localhost:11434/v1, no key). Leave AI_BASE_URL empty to use structured data only.
  ai: {
    baseUrl: process.env.AI_BASE_URL ?? '',
    apiKey: process.env.AI_API_KEY ?? '',
    model: process.env.AI_MODEL ?? '',
  },
}
