import { readFileSync } from 'node:fs'
import { config } from '../../config.ts'
import { db } from '../../db/connection.ts'
import { eventsFromPost } from './events.ai.ts'

// Reads Instagram through Meta's official API, never by scraping:
// - Hashtag Search: public posts from the last 24 hours with a hashtag (max 30 different hashtags a week).
// - Business Discovery: the latest posts of business/creator accounts you list (event organizers).
// The hashtags and accounts live in instagram.json, read on every run so you can edit it any time.
type Post = { id: string; caption?: string; media_type?: string; media_url?: string; permalink: string; timestamp: string }
export type InstagramLists = { hashtags: string[]; accounts: string[] }

const WEEK = 7 * 86_400_000
const FIELDS = 'id,caption,media_type,media_url,permalink,timestamp'

// Cheap check before using the AI (free quota): skip captions with no sign of an event.
const EVENT_WORDS =
  /\b(register|registration|tickets?|rsvp|deadline|workshop|hackathon|competition|meetup|seminar|conference|summit|bootcamp|webinar|session|festival|event|join us|apply)\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b\d{1,2}(st|nd|rd|th)\b|\b\d{1,2}[/.-]\d{1,2}\b/i
export const looksLikeEvent = (caption = '') => EVENT_WORDS.test(caption)

async function graph(path: string, params: Record<string, string>) {
  const url = new URL(`${config.instagram.apiUrl.replace(/\/$/, '')}/${path}`)
  for (const [key, value] of Object.entries({ ...params, access_token: config.instagram.token })) url.searchParams.set(key, value)
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  const body: any = await res.json().catch(() => ({}))
  if (!res.ok) throw new Error(`Instagram answered ${res.status}${body.error?.message ? `: ${body.error.message}` : ''}`)
  return body
}

async function hashtagPosts(tag: string): Promise<Post[]> {
  const found = await graph('ig_hashtag_search', { user_id: config.instagram.userId, q: tag })
  if (!found.data?.[0]) return []
  const recent = await graph(`${found.data[0].id}/recent_media`, { user_id: config.instagram.userId, fields: FIELDS, limit: '50' })
  return recent.data ?? []
}

async function accountPosts(username: string): Promise<Post[]> {
  const fields = `business_discovery.username(${username}){media.limit(15){${FIELDS}}}`
  const result = await graph(config.instagram.userId, { fields })
  return result.business_discovery?.media?.data ?? []
}

// The AI reads the poster itself; Gemini wants the picture's bytes rather than an Instagram link.
async function asDataUrl(url?: string) {
  if (!url) return undefined
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  const type = res.headers.get('content-type') ?? ''
  if (!res.ok || !/^image\/(jpeg|png|webp)/.test(type)) return undefined
  const bytes = Buffer.from(await res.arrayBuffer())
  return bytes.length < 5_000_000 ? `data:${type.split(';')[0]};base64,${bytes.toString('base64')}` : undefined
}

const seen = (id: string) => Boolean(db.prepare('SELECT 1 FROM seen_posts WHERE post_id = ?').get(id))
const markSeen = (id: string) => db.prepare('INSERT OR IGNORE INTO seen_posts (post_id, seen_at) VALUES (?, ?)').run(id, Date.now())

// One run: for every hashtag and account, read new posts and turn the ones about events into drafts.
export async function scanInstagram(lists?: InstagramLists) {
  if (!config.instagram.token || !config.instagram.userId || !config.ai.baseUrl) return [] // not set up yet
  const { hashtags, accounts }: InstagramLists =
    lists ?? JSON.parse(readFileSync(new URL('./instagram.json', import.meta.url), 'utf8'))
  const sources = [
    ...hashtags.map((tag) => ({ name: `Instagram #${tag}`, load: () => hashtagPosts(tag) })),
    ...accounts.map((user) => ({ name: `Instagram @${user}`, load: () => accountPosts(user) })),
  ]
  const report = []
  for (const source of sources) {
    try {
      let found = 0
      let added = 0
      for (const post of await source.load()) {
        if (Date.now() - Date.parse(post.timestamp) > WEEK || seen(post.id)) continue // too old, or done before
        if (looksLikeEvent(post.caption)) {
          const image = post.media_type === 'VIDEO' ? undefined : await asDataUrl(post.media_url)
          const result = await eventsFromPost({ postUrl: post.permalink, text: post.caption ?? '', image })
          found += result.found
          added += result.added
        }
        markSeen(post.id) // only after it was handled: if the AI fails, the post is tried again next run
      }
      report.push({ source: source.name, via: 'Instagram API', found, added })
    } catch (err) {
      report.push({ source: source.name, error: (err as Error).message })
    }
  }
  return report
}
