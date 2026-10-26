import { readFileSync } from 'node:fs'
import { config } from '../../config.ts'
import { db } from '../../db/connection.ts'
import { HttpError } from '../../middleware/errors.ts'
import { eventsFromPost } from './events.ai.ts'

// Reads Instagram through Meta's official API, never by scraping:
// - Hashtag Search: public posts from the last 24 hours with a hashtag (max 30 different hashtags a week).
// - Business Discovery: the latest posts of business/creator accounts you list (event organizers).
// The hashtags and accounts live in instagram.json, read on every run so you can edit it any time.
type Post = {
  id: string
  caption?: string
  media_type?: string
  media_url?: string
  permalink: string
  timestamp: string
}
export type InstagramLists = { hashtags: string[]; accounts: string[] }

const WEEK = 7 * 86_400_000
const FIELDS = 'id,caption,media_type,media_url,permalink,timestamp'

// Cheap check before using the AI (free quota): skip captions with no sign of an event.
const EVENT_WORDS =
  /\b(register|registration|tickets?|rsvp|deadline|workshop|hackathon|competition|meetup|seminar|conference|summit|bootcamp|webinar|session|festival|event|join us|apply)\b|\b(jan|feb|mar|apr|may|jun|jul|aug|sep|oct|nov|dec)[a-z]*\b|\b\d{1,2}(st|nd|rd|th)\b|\b\d{1,2}[/.-]\d{1,2}\b/i
export const looksLikeEvent = (caption = '') => EVENT_WORDS.test(caption)

async function graph(path: string, params: Record<string, string>) {
  const url = new URL(`${config.instagram.apiUrl.replace(/\/$/, '')}/${path}`)
  for (const [key, value] of Object.entries({ ...params, access_token: config.instagram.token }))
    url.searchParams.set(key, value)
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  const body: any = await res.json().catch(() => ({}))
  if (!res.ok)
    throw new Error(`Instagram answered ${res.status}${body.error?.message ? `: ${body.error.message}` : ''}`)
  return body
}

async function hashtagPosts(tag: string): Promise<Post[]> {
  const found = await graph('ig_hashtag_search', { user_id: config.instagram.userId, q: tag })
  if (!found.data?.[0]) return []
  // Instagram refuses big pages ("reduce the amount of data"), so ask for 25 at a time, up to 2 pages.
  const posts: Post[] = []
  let after = ''
  for (let page = 0; page < 2; page++) {
    const params = { user_id: config.instagram.userId, fields: FIELDS, limit: '25', ...(after && { after }) }
    const recent = await graph(`${found.data[0].id}/recent_media`, params)
    posts.push(...(recent.data ?? []))
    after = recent.paging?.cursors?.after
    if (!recent.paging?.next || !after) break
  }
  return posts
}

// "Suggest an event" with only a link: find that post among the account's recent posts (official API, so it
// works for business and creator accounts, which nearly all organizers, venues and brands are).
// The account comes from the link (instagram.com/<account>/p/…) or is typed in next to it.
export async function findPost(postUrl: string, account = '') {
  if (!config.instagram.token) throw new HttpError(503, 'Reading Instagram links isn’t switched on: add a screenshot')
  const path = new URL(postUrl).pathname.split('/').filter(Boolean)
  const at = path.findIndex((part) => ['p', 'reel', 'reels', 'tv'].includes(part))
  const code = at >= 0 ? path[at + 1] : ''
  const username = account.replace(/^@/, '').trim() || (at > 0 ? path[at - 1] : '')
  if (!code) throw new HttpError(400, 'That doesn’t look like a link to an Instagram post')
  if (!/^[A-Za-z0-9._]{1,30}$/.test(username))
    throw new HttpError(400, 'Add the account’s @name (it isn’t in the link), or a screenshot of the post')
  const fields = `business_discovery.username(${username}){media.limit(50){${FIELDS},thumbnail_url}}`
  const result = await graph(config.instagram.userId, { fields }).catch(() => {
    throw new HttpError(
      400,
      `Couldn’t read @${username}: it must be a business or creator account. Add a screenshot instead.`,
    )
  })
  const post = (result.business_discovery?.media?.data ?? []).find((p: any) => p.permalink?.includes(`/${code}`))
  if (!post)
    throw new HttpError(400, `That post isn’t among @${username}’s recent posts. Check the @name, or add a screenshot.`)
  const picture = post.media_type === 'VIDEO' ? post.thumbnail_url : post.media_url
  return { text: post.caption ?? '', image: await asDataUrl(picture).catch(() => undefined) }
}

async function accountPosts(username: string): Promise<Post[]> {
  const fields = `business_discovery.username(${username}){media.limit(15){${FIELDS}}}`
  const result = await graph(config.instagram.userId, { fields })
  return result.business_discovery?.media?.data ?? []
}

// The AI reads the poster itself; Gemini wants the picture's bytes rather than an Instagram link.
// Also used to keep a web page's event picture as its poster.
export async function asDataUrl(url?: string) {
  if (!url) return undefined
  const res = await fetch(url, { signal: AbortSignal.timeout(20_000) })
  const type = res.headers.get('content-type') ?? ''
  if (!res.ok || !/^image\/(jpeg|png|webp)/.test(type)) return undefined
  const bytes = Buffer.from(await res.arrayBuffer())
  return bytes.length < 5_000_000 ? `data:${type.split(';')[0]};base64,${bytes.toString('base64')}` : undefined
}

const seen = (id: string) => Boolean(db.prepare('SELECT 1 FROM seen_posts WHERE post_id = ?').get(id))
const markSeen = (id: string) =>
  db.prepare('INSERT OR IGNORE INTO seen_posts (post_id, seen_at) VALUES (?, ?)').run(id, Date.now())

// At most 10 new Instagram drafts a day (you review each one), and a pause between AI calls so Gemini's
// free tier doesn't answer "429: too many requests". Exported so tests can shorten the pause.
export const limits = { draftsPerDay: 10, aiPauseMs: 4000 }
const draftsToday = () =>
  (
    db
      .prepare(
        "SELECT COUNT(*) AS n FROM events WHERE suggested_by IS NULL AND source_url LIKE '%instagram%' AND created_at > ?",
      )
      .get(Date.now() - 86_400_000) as { n: number }
  ).n
const pause = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms))

// One run: for every hashtag and account, read new posts and turn the ones about events into drafts.
export async function scanInstagram(lists?: InstagramLists) {
  if (!config.instagram.token || !config.instagram.userId || !config.ai.baseUrl) return [] // not set up yet
  let chosen: InstagramLists
  try {
    chosen = lists ?? JSON.parse(readFileSync(new URL('./instagram.json', import.meta.url), 'utf8'))
  } catch (err) {
    // A typo in the list (e.g. a missing comma) shouldn't break the whole event finder.
    return [{ source: 'Instagram', error: `instagram.json has a mistake: ${(err as Error).message}` }]
  }
  const { hashtags, accounts } = chosen
  const sources = [
    // Accounts you chose come first, so the 10-a-day limit isn't used up by hashtags before reaching them.
    ...accounts.map((user) => ({ name: `Instagram @${user}`, load: () => accountPosts(user) })),
    // Instagram allows 30 different hashtags per account per 7 days, so only the first 30 in the list are used.
    ...hashtags.slice(0, 30).map((tag) => ({ name: `Instagram #${tag}`, load: () => hashtagPosts(tag) })),
  ]
  const report = []
  let aiCalls = 0
  for (const source of sources) {
    try {
      let found = 0
      let added = 0
      for (const post of await source.load()) {
        if (Date.now() - Date.parse(post.timestamp) > WEEK || seen(post.id)) continue // too old, or done before
        if (looksLikeEvent(post.caption)) {
          // Today's 10 are in: stop. Unchecked posts stay unseen and are looked at on a later run.
          if (draftsToday() >= limits.draftsPerDay) {
            report.push({
              source: source.name,
              found,
              added,
              error: `daily limit of ${limits.draftsPerDay} new events reached`,
            })
            return report
          }
          if (aiCalls++) await pause(limits.aiPauseMs)
          const image = post.media_type === 'VIDEO' ? undefined : await asDataUrl(post.media_url)
          const result = await eventsFromPost(
            { postUrl: post.permalink, text: post.caption ?? '', image },
            undefined,
            true,
          )
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
