import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import './helpers.ts' // fresh in-memory database
import { config } from '../src/config.ts'
import { limits, looksLikeEvent, scanInstagram } from '../src/modules/events/events.instagram.ts'
import { saveEvent } from '../src/modules/events/events.service.ts'

const ago = (days: number) => new Date(Date.now() - days * 86_400_000).toISOString()
const soon = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

test('event-word filter', () => {
  assert.ok(looksLikeEvent('Hackathon this Saturday, register now!'))
  assert.ok(looksLikeEvent('Open mic on 15th, come through'))
  assert.ok(!looksLikeEvent('sunset vibes 🌅'))
  assert.ok(!looksLikeEvent(undefined))
})

test('Instagram reader: only fresh, event-like, unseen posts reach the AI', async () => {
  let aiCalls = 0
  const posts = [
    {
      id: 'p1',
      caption: 'Design workshop, register by link in bio',
      media_type: 'IMAGE',
      permalink: 'https://instagram.test/p/1',
      timestamp: ago(1),
    },
    {
      id: 'p2',
      caption: 'sunset vibes',
      media_type: 'IMAGE',
      permalink: 'https://instagram.test/p/2',
      timestamp: ago(1),
    },
    {
      id: 'p3',
      caption: 'Old hackathon, register now',
      media_type: 'IMAGE',
      permalink: 'https://instagram.test/p/3',
      timestamp: ago(10),
    },
  ]
  // One stand-in server plays both Meta's API and Gemini.
  const fake = createServer((req, res) => {
    const url = new URL(req.url!, 'http://x')
    const reply = (body: unknown) => res.end(JSON.stringify(body))
    if (url.pathname === '/ig_hashtag_search') return reply({ data: [{ id: 'h1' }] })
    if (url.pathname === '/h1/recent_media')
      return reply({ data: posts.map((p) => ({ ...p, media_url: `http://localhost:${port}/poster.jpg` })) })
    if (url.pathname === '/me123') {
      const p4 = {
        id: 'p4',
        caption: 'Meetup on 3rd, tickets inside',
        media_type: 'VIDEO',
        permalink: 'https://instagram.test/p/4',
        timestamp: ago(2),
      }
      return reply({ business_discovery: { media: { data: [p4] } } })
    }
    if (url.pathname === '/poster.jpg')
      return res.writeHead(200, { 'content-type': 'image/jpeg' }).end(Buffer.from([0xff, 0xd8, 0xff]))
    if (url.pathname === '/chat/completions') {
      aiCalls++
      const event = {
        title: `Event ${aiCalls}`,
        date: `${soon(20)}T18:00`,
        city: 'Lahore',
        mode: 'In person',
        category: 'Workshop',
        country: 'Pakistan',
        registerUrl: '',
      }
      return reply({
        choices: [
          {
            message: {
              content: JSON.stringify([
                event,
                { ...event, title: `Abroad ${aiCalls}`, city: 'Mumbai', country: 'India' },
                {
                  ...event,
                  title: `Lahore meetup ${['alpha', 'beta'][aiCalls - 1]}`,
                  country: '',
                  registerUrl: `https://tix.test/${aiCalls}`,
                }, // city Lahore is enough
              ]),
            },
          },
        ],
      })
    }
    res.writeHead(404).end('{}')
  }).listen(0)
  const port = (fake.address() as { port: number }).port
  Object.assign(config.instagram, { apiUrl: `http://localhost:${port}`, token: 't', userId: 'me123' })
  limits.aiPauseMs = 0 // no need to be gentle with the stand-in AI
  config.ai.baseUrl = `http://localhost:${port}`
  try {
    const lists = { hashtags: ['lahoreevents'], accounts: ['someorganizer'] }
    const first = await scanInstagram(lists)
    assert.deepEqual(first, [
      // p1 only (p2 isn't an event, p3 is old): its Lahore events are kept, the Mumbai one is dropped
      { source: 'Instagram #lahoreevents', via: 'Instagram API', found: 2, added: 2 },
      { source: 'Instagram @someorganizer', via: 'Instagram API', found: 2, added: 2 },
    ])
    assert.equal(aiCalls, 2)
    await scanInstagram(lists)
    assert.equal(aiCalls, 2) // second run: every post was already seen, nothing sent to the AI again

    // Daily limit: with 10 Instagram drafts already today, new posts aren't even sent to the AI.
    const filler = {
      date: `${soon(30)}T10:00`,
      deadline: '',
      city: 'Multan',
      mode: 'In person' as const,
      category: 'Event',
      description: '',
    }
    for (let i = 0; i < 8; i++)
      saveEvent({
        ...filler,
        title: `Filler ${i} ${'abcdefgh'[i]}x`,
        registerUrl: `https://instagram.test/p/f${i}`,
        sourceUrl: `https://instagram.test/p/f${i}`,
      })
    posts.push({
      id: 'p5',
      caption: 'Hackathon this weekend, register now',
      media_type: 'IMAGE',
      permalink: 'https://instagram.test/p/5',
      timestamp: ago(1),
    })
    const capped = await scanInstagram(lists)
    assert.match(capped[0].error ?? '', /daily limit of 10/)
    assert.equal(aiCalls, 2) // unchanged: p5 waits for a later run

    config.instagram.token = ''
    assert.deepEqual(await scanInstagram(lists), []) // not set up → quietly does nothing
  } finally {
    Object.assign(config.instagram, { token: '', userId: '' })
    config.ai.baseUrl = ''
    fake.close()
  }
})
