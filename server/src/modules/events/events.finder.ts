import { readFileSync } from 'node:fs'
import { config } from '../../config.ts'
import { eventSchema, type EventInput } from './events.schema.ts'
import { saveEvent } from './events.service.ts'

type Source = { name: string; url: string; city?: string }
type Candidate = Record<string, unknown>

// Many event sites embed machine-readable event data (schema.org JSON-LD) for search engines. Read that first.
export function eventsFromJsonLd(html: string, pageUrl: string): Candidate[] {
  const found: Candidate[] = []
  for (const [, raw] of html.matchAll(/<script[^>]*application\/ld\+json[^>]*>([\s\S]*?)<\/script>/gi)) {
    let data: unknown
    try {
      data = JSON.parse(raw)
    } catch {
      continue // one broken block shouldn't stop the rest of the page
    }
    walk(data, (node) => {
      const types = [node['@type']].flat()
      if (types.some((t) => typeof t === 'string' && t.endsWith('Event'))) found.push(fromSchemaOrg(node, pageUrl))
    })
  }
  return found
}

// Events can sit anywhere: top level, inside @graph, inside an ItemList... so visit every object.
function walk(node: unknown, visit: (n: any) => void) {
  if (Array.isArray(node)) return node.forEach((n) => walk(n, visit))
  if (!node || typeof node !== 'object') return
  visit(node)
  Object.values(node).forEach((v) => walk(v, visit))
}

function fromSchemaOrg(e: any, pageUrl: string): Candidate {
  const place = [e.location].flat()[0] ?? {}
  const online = String(e.eventAttendanceMode ?? '').includes('Online') || place['@type'] === 'VirtualLocation'
  const mixed = String(e.eventAttendanceMode ?? '').includes('Mixed')
  const link = [e.offers].flat()[0]?.url ?? e.url ?? pageUrl
  const description = stripTags(String(e.description ?? '')).slice(0, 1000)
  return {
    title: stripTags(String(e.name ?? '')),
    date: e.startDate,
    city: place.address?.addressLocality ?? '',
    mode: mixed ? 'Hybrid' : online ? 'Online' : 'In person',
    category: guessCategory(`${e.name} ${description}`),
    description,
    registerUrl: URL.parse(link, pageUrl)?.href ?? '', // a broken link fails validation, dropping only this event
  }
}

function guessCategory(text: string) {
  if (/hackathon/i.test(text)) return 'Hackathon'
  if (/workshop|bootcamp|training/i.test(text)) return 'Workshop'
  if (/competition|contest|challenge/i.test(text)) return 'Competition'
  if (/conference|summit|meetup/i.test(text)) return 'Meetup'
  return 'Event'
}

function stripTags(html: string) {
  return html.replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim()
}

const PROMPT = `You extract upcoming events (events, hackathons, workshops, competitions) from a web page.
Reply with ONLY a JSON array, no other text. Each item:
{"title": string, "date": ISO 8601 start date-time, "city": string ("" if online),
 "mode": "In person" | "Online" | "Hybrid", "category": "Hackathon" | "Workshop" | "Competition" | "Meetup" | "Event",
 "description": short summary under 300 characters, "registerUrl": the official registration link as a full URL}
Only include events that are really on the page. Never invent links or dates. Reply [] if there are none.`

// Fallback for pages without structured data. Only runs when an AI provider is configured (see config.ts).
async function eventsFromAi(html: string, pageUrl: string): Promise<Candidate[]> {
  if (!config.ai.baseUrl) return []
  const res = await fetch(`${config.ai.baseUrl.replace(/\/$/, '')}/chat/completions`, {
    method: 'POST',
    headers: { 'content-type': 'application/json', ...(config.ai.apiKey && { authorization: `Bearer ${config.ai.apiKey}` }) },
    body: JSON.stringify({
      model: config.ai.model,
      temperature: 0,
      messages: [
        { role: 'system', content: PROMPT },
        { role: 'user', content: `Page: ${pageUrl}\n\n${stripTags(html).slice(0, 12_000)}` },
      ],
    }),
    signal: AbortSignal.timeout(60_000),
  })
  if (!res.ok) throw new Error(`AI provider answered ${res.status}`)
  const reply = String((await res.json()).choices?.[0]?.message?.content ?? '')
  const items = JSON.parse(reply.slice(reply.indexOf('['), reply.lastIndexOf(']') + 1) || '[]')
  return Array.isArray(items) ? items : []
}

// Checks every candidate; keeps only well-formed events that haven't happened yet.
export function cleanEvents(candidates: Candidate[], source: Source): EventInput[] {
  const now = Date.now()
  return candidates.flatMap((c) => {
    // The source's city is a fallback for in-person events only; an online event isn't "in Lahore".
    const city = c.city || (c.mode === 'Online' ? '' : source.city) || ''
    const parsed = eventSchema.safeParse({ ...c, city, sourceUrl: source.url })
    return parsed.success && Date.parse(parsed.data.date) >= now ? [parsed.data] : []
  })
}

async function fetchPage(url: string) {
  const res = await fetch(url, {
    headers: { 'user-agent': 'ComoonlyEventFinder/1.0', accept: 'text/html' },
    signal: AbortSignal.timeout(15_000),
  })
  if (!res.ok) throw new Error(`Page answered ${res.status}`)
  return (await res.text()).slice(0, 3_000_000) // a page bigger than ~3 MB is not a normal event listing
}

// Admin presses "Find new events": visit each source, save new events as drafts for review.
export async function scanSources() {
  // Read on every scan, so you can edit sources.json without restarting the server.
  const sources: Source[] = JSON.parse(readFileSync(new URL('./sources.json', import.meta.url), 'utf8'))
  const report = []
  for (const source of sources) {
    try {
      const html = await fetchPage(source.url)
      let via = 'structured data'
      let candidates = eventsFromJsonLd(html, source.url)
      if (!candidates.length && config.ai.baseUrl) {
        via = 'AI'
        candidates = await eventsFromAi(html, source.url)
      }
      const events = cleanEvents(candidates, source)
      const added = events.filter((e) => saveEvent(e)).length
      report.push({ source: source.name, via, found: events.length, added })
    } catch (err) {
      report.push({ source: source.name, error: (err as Error).message })
    }
  }
  return report
}
