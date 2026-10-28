import { readFileSync } from 'node:fs'
import { config } from '../../config.ts'
import { askAi, cleanEvents, type Candidate, type Source } from './events.ai.ts'
import { asDataUrl, scanInstagram } from './events.instagram.ts'
import { savePoster, saveEvent } from './events.service.ts'

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
  const image = [e.image].flat()[0]
  return {
    ...(image && { image: typeof image === 'string' ? image : image.url }), // becomes the poster
    title: stripTags(String(e.name ?? '')),
    date: e.startDate,
    city: place.address?.addressLocality ?? '',
    mode: mixed ? 'Hybrid' : online ? 'Online' : 'In person',
    category: guessCategory(`${e.name} ${description}`),
    description,
    registerUrl: URL.parse(link, pageUrl)?.href ?? 'broken', // fails validation, dropping only this event
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
  return html
    .replace(/<(script|style)[\s\S]*?<\/\1>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
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
        via = 'AI' // pages without structured data: let the AI read the visible text
        candidates = await askAi(`Page: ${source.url}\n\n${stripTags(html).slice(0, 12_000)}`)
      }
      const events = cleanEvents(candidates, source)
      let added = 0
      for (const e of events) {
        const id = saveEvent(e)
        if (!id) continue
        added++
        // The page's own picture of the event becomes its poster (a missing or broken one is skipped).
        const image = candidates.find((c) => c.title === e.title)?.image
        const url = typeof image === 'string' ? URL.parse(image, source.url)?.href : undefined
        const poster = await asDataUrl(url).catch(() => undefined)
        if (poster) savePoster(id, poster)
      }
      report.push({ source: source.name, via, found: events.length, added })
    } catch (err) {
      report.push({ source: source.name, error: (err as Error).message })
    }
  }
  return [...report, ...(await scanInstagram())] // Instagram adds nothing until it's set up
}
