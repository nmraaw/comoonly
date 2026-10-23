import { config } from '../../config.ts'
import { HttpError } from '../../middleware/errors.ts'
import { eventSchema, type EventInput } from './events.schema.ts'
import { saveEvent } from './events.service.ts'

export type Candidate = Record<string, unknown>
export type Source = { name: string; url: string; city?: string }

const DAY = 86_400_000

// Posters often say "Sat 2 Nov" with no year, so the AI must know what "today" is (in Pakistan).
// The weekday matters too: without it, "this Friday" posted on a Friday was read as the next day.
const today = () => {
  const zone = { timeZone: 'Asia/Karachi' }
  return `${new Date().toLocaleDateString('en-GB', { ...zone, weekday: 'long' })} ${new Date().toLocaleDateString('en-CA', zone)}`
}

const prompt = () => `Today is ${today()} in Pakistan. You extract upcoming events (events, hackathons, workshops,
competitions) from a web page or a social media post. Reply with ONLY a JSON array, no other text. Each item:
{"title": string, "date": ISO 8601 start date-time, "city": string ("" if online),
 "mode": "In person" | "Online" | "Hybrid", "category": "Hackathon" | "Workshop" | "Competition" | "Meetup" | "Event",
 "description": a short summary under 300 characters using only facts in the post, "registerUrl": the official registration link as a full URL or "",
 "deadline": last day to register as YYYY-MM-DD, or "" if not stated,
 "country": the country it takes place in (for online events, the organizer's country), or "" if unclear}
A date without a year means its next occurrence after today. Only include events that are really there.
Never invent links or dates. Reply [] if there are none.`

// Sends text (and optionally an image) to the configured AI and returns the events it found.
// Works with any OpenAI-compatible provider: Gemini, Groq, Ollama... (see .env.example).
export async function askAi(content: string | object[]): Promise<Candidate[]> {
  const res = await fetch(`${config.ai.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: {
      'content-type': 'application/json',
      ...(config.ai.apiKey && { authorization: `Bearer ${config.ai.apiKey}` }),
    },
    body: JSON.stringify({
      model: config.ai.model,
      temperature: 0,
      messages: [
        { role: 'system', content: prompt() },
        { role: 'user', content },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  }).catch((err) => {
    if (err.name === 'TimeoutError') throw new HttpError(504, 'The AI took too long to answer. Please try again.')
    throw err
  })
  if (!res.ok) throw new HttpError(502, `The AI service answered ${res.status}. Try again in a minute.`)
  const reply = String((await res.json()).choices?.[0]?.message?.content ?? '')
  try {
    const items = JSON.parse(reply.slice(reply.indexOf('['), reply.lastIndexOf(']') + 1))
    return Array.isArray(items) ? items : []
  } catch {
    return [] // the AI didn't answer with a list: treat it as "nothing found"
  }
}

// Keeps only well-formed events that are still worth showing: not over, registration still open,
// and not absurdly far away (a sign the AI guessed the wrong year).
export function cleanEvents(candidates: Candidate[], source: Source): EventInput[] {
  const now = Date.now()
  return candidates.flatMap((c) => {
    // The source's city is a fallback for in-person events only; an online event isn't "in Lahore".
    const city = c.city || (c.mode === 'Online' ? '' : source.city) || ''
    const parsed = eventSchema.safeParse({ ...c, city, sourceUrl: source.url })
    if (!parsed.success) return []
    // "2026-11-15T00:00:00" means no time was given: keep just the day, so no fake "00:00" is shown.
    const date = parsed.data.date.replace(/T00:00(:00(\.0+)?)?Z?$/, '')
    const { deadline } = parsed.data
    const starts = Date.parse(date)
    const open = !deadline || Date.parse(deadline) + DAY > now // the deadline day itself still counts
    // A day of slack: an event dated just "today" counts as midnight, which has already passed.
    return starts >= now - DAY && starts < now + 400 * DAY && open ? [{ ...parsed.data, date }] : []
  })
}

// A post (Instagram, TikTok, a WhatsApp poster...): caption and/or image → events saved as drafts for review.
// Used by "Suggest an event", and later by the Instagram reader.
// Pakistan's main cities, for when the AI names the city but leaves the country blank.
const PAKISTAN_CITIES = new Set([
  'karachi',
  'lahore',
  'islamabad',
  'rawalpindi',
  'faisalabad',
  'multan',
  'peshawar',
  'quetta',
  'sialkot',
  'gujranwala',
  'hyderabad',
  'abbottabad',
  'bahawalpur',
  'sargodha',
  'sukkur',
  'larkana',
  'sheikhupura',
  'gujrat',
  'mardan',
  'kasur',
  'rahim yar khan',
  'sahiwal',
  'okara',
  'wah cantt',
  'dera ghazi khan',
  'mirpur khas',
  'nawabshah',
  'mingora',
  'swat',
  'chiniot',
  'jhang',
  'jhelum',
  'muzaffarabad',
  'gilgit',
  'skardu',
  'hunza',
  'murree',
  'gwadar',
  'taxila',
  'mirpur',
  'chitral',
])

// Kept if the country is Pakistan, or the city is a Pakistani city.
function inPakistan(c: Candidate) {
  if (/^(pakistan|pk)$/i.test(String(c.country ?? '').trim())) return true
  return PAKISTAN_CITIES.has(
    String(c.city ?? '')
      .toLowerCase()
      .trim(),
  )
}

// `pakistanOnly` (used by the Instagram reader): drop events the AI places outside Pakistan, or can't place.
// Instagram doesn't share a post's location through the API, so the AI judges it from venue, city, prices etc.
export async function eventsFromPost(
  post: { postUrl: string; text: string; image?: string },
  suggestedBy?: string,
  pakistanOnly = false,
) {
  if (!config.ai.baseUrl) throw new HttpError(503, 'Event suggestions aren’t switched on yet. Please try again later.')
  const content = [
    { type: 'text', text: `Post: ${post.postUrl}\n\n${post.text || '(no caption: read the image)'}` },
    ...(post.image ? [{ type: 'image_url', image_url: { url: post.image } }] : []),
  ]
  // A poster often has no link; then the post itself is where people find out more.
  const candidates = (await askAi(content))
    .filter((c) => !pakistanOnly || inPakistan(c))
    .map((c) => ({ ...c, registerUrl: c.registerUrl || post.postUrl }))
  const events = cleanEvents(candidates, { name: 'post', url: post.postUrl })
  return { found: events.length, added: events.filter((e) => saveEvent(e, 'draft', suggestedBy)).length }
}
