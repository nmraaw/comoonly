import { test } from 'node:test'
import assert from 'node:assert/strict'
import { createServer } from 'node:http'
import { base, get, json, loginAs, status } from './helpers.ts'
import { config } from '../src/config.ts'

const soon = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

test('leaving a group; hosts cannot leave their own', async () => {
  const [hira, me] = [await loginAs('hira'), await loginAs('me')] // Hira hosts tiny-game; 'me' is a member
  assert.equal(await status('/groups/tiny-game/leave', json({}, hira)), 409)
  assert.equal(await status('/groups/tiny-game/leave', json({}, me)), 204)
  assert.equal((await get('/groups/memberships', me))['tiny-game'], undefined)
  assert.equal(await status('/groups/tiny-game/messages', { headers: { cookie: me } }), 403)
})

test('blocking ends the connection, hides the profile, and stops requests', async () => {
  const [noor, zain] = [await loginAs('noor'), await loginAs('zain')] // Noor hosts sunday-sketch
  await fetch(`${base}/users/noor/connect`, json({}, zain))
  await fetch(`${base}/connections/zain`, json({ decision: 'accept' }, noor))
  assert.equal(await status('/users/zain/block', json({}, noor)), 204)

  assert.equal((await get('/users/zain', noor)).blocked, true) // Noor still sees Zain, to unblock
  assert.equal(await status('/users/noor', { headers: { cookie: zain } }), 404) // Zain can't see Noor
  assert.equal(await status('/messages/with/noor', json({ text: 'hi' }, zain)), 403)
  assert.equal(await status('/users/noor/connect', json({}, zain)), 403)
  assert.equal(await status('/groups/sunday-sketch/requests', json({ intro: 'hi' }, zain)), 403)

  assert.equal(await status('/users/zain/block', { method: 'DELETE', headers: { cookie: noor } }), 204)
  assert.equal(await status('/users/noor', { headers: { cookie: zain } }), 200)
})

test('reports reach the admin dashboard; only admins can see it', async () => {
  const [hamza, sara] = [await loginAs('hamza'), await loginAs('sara')] // Sara is admin (see helpers.ts)
  assert.equal(await status('/users/areeba/report', json({ reason: 'Nope' }, hamza)), 400)
  assert.equal(
    await status('/users/areeba/report', json({ reason: 'Spam or scam', details: 'Sent links' }, hamza)),
    201,
  )
  assert.equal(await status('/admin/overview', { headers: { cookie: hamza } }), 403)
  const dash = await get('/admin/overview', sara)
  assert.equal(dash.totals.openReports, 1)
  assert.equal(
    dash.people.some((p: { email: string }) => p.email === 'hamza@comoonly.test'),
    true,
  )
  assert.equal(await status(`/admin/reports/${dash.reports[0].id}/resolve`, json({}, sara)), 204)
  assert.equal((await get('/admin/overview', sara)).totals.openReports, 0)
})

test('notifications: join requests, acceptance, messages (merged), events by interest', async () => {
  const [sara, hamza, areeba] = [await loginAs('sara'), await loginAs('hamza'), await loginAs('areeba')]
  await fetch(`${base}/groups/film-club/requests`, json({ intro: 'Hi!' }, hamza)) // Sara hosts film-club
  assert.match((await get('/notifications', sara))[0].text, /Hamza K\. asked to join The little film club/)
  await fetch(`${base}/groups/film-club/requests/hamza`, json({ decision: 'accept' }, sara))
  assert.match((await get('/notifications', hamza))[0].text, /You’re in!/)

  await fetch(`${base}/groups/film-club/messages`, json({ text: 'one' }, sara))
  await fetch(`${base}/groups/film-club/messages`, json({ text: 'two' }, sara))
  const unread = await get('/notifications/unread', hamza)
  assert.equal(unread.messages, 1) // two messages, one notice
  await get('/groups/film-club/messages', hamza) // opening the chat marks it read
  assert.equal((await get('/notifications/unread', hamza)).messages, 0)

  // Areeba likes "Making music"/"Films"; a Film event in Sialkot (her city) reaches her, one in Karachi doesn't.
  const film = {
    title: 'Films under the stars',
    date: '2030-06-01T20:00',
    city: 'Sialkot',
    category: 'Film',
    registerUrl: 'https://films.test/1',
    sourceUrl: 'https://films.test',
  }
  await fetch(`${base}/events`, json(film, sara))
  await fetch(
    `${base}/events`,
    json({ ...film, title: 'Films in Karachi', city: 'Karachi', registerUrl: 'https://films.test/2' }, sara),
  )
  const texts = (await get('/notifications', areeba)).map((n: { text: string }) => n.text)
  assert.ok(texts.some((t: string) => t.includes('Films under the stars')))
  assert.ok(!texts.some((t: string) => t.includes('Films in Karachi')))
  assert.equal(await status('/notifications/read', json({}, areeba)), 204)
  assert.equal((await get('/notifications/unread', areeba)).total, 0)
})

test('suggest an event: AI reads the post, result waits for review; closed or past events are dropped', async () => {
  // A stand-in for Gemini that answers like an OpenAI-compatible API would, and records what it was asked.
  let asked = ''
  const fakeAi = createServer((req, res) => {
    let body = ''
    req.on('data', (chunk) => (body += chunk))
    req.on('end', () => {
      asked = body
      const base = { city: 'Lahore', mode: 'In person', category: 'Meetup', description: '', registerUrl: '' }
      const events = [
        { ...base, title: 'Lahore Startup Mixer', date: `${soon(30)}T18:00`, deadline: soon(25) },
        { ...base, title: 'Registration closed', date: `${soon(40)}T18:00`, deadline: '2020-01-01' },
        { ...base, title: 'Wrong year guess', date: '2099-01-01T10:00' },
      ]
      res.end(JSON.stringify({ choices: [{ message: { content: `Here you go: ${JSON.stringify(events)}` } }] }))
    })
  }).listen(0)
  config.ai.baseUrl = `http://localhost:${(fakeAi.address() as { port: number }).port}`
  try {
    const [sara, hira] = [await loginAs('sara'), await loginAs('hira')] // Hira is a regular user
    const post = { postUrl: 'https://www.instagram.com/p/abc123/', text: 'Startup mixer this Friday!' }
    assert.equal(await status('/events/suggest', json({ postUrl: post.postUrl }, hira)), 400) // no caption or image
    assert.equal(await status('/events/suggest', json({ ...post, image: 'data:text/html;base64,AA' }, hira)), 400)
    assert.deepEqual(await (await fetch(`${base}/events/suggest`, json(post, hira))).json(), { found: 1, added: 1 })
    assert.match(asked, /Today is \d{4}-\d{2}-\d{2} in Pakistan/) // so "Sat 2 Nov" gets the right year
    const draft = (await get('/events/review', sara)).find((e: { title: string }) => e.title === 'Lahore Startup Mixer')
    assert.equal(draft.registerUrl, post.postUrl) // no link on the poster: the post itself is used
    assert.equal(draft.deadline, soon(25))
    assert.equal(draft.suggestedBy, 'Hira S.')
  } finally {
    config.ai.baseUrl = ''
    fakeAi.close()
  }
})

test('daily tidy-up removes drafts whose event or deadline has passed; published ones stay', async () => {
  const { saveEvent, tidyEvents } = await import('../src/modules/events/events.service.ts')
  const event = {
    title: 'Old draft',
    date: '2001-01-01',
    deadline: '',
    city: '',
    mode: 'Online' as const,
    category: 'Event',
    description: '',
    registerUrl: 'https://old.test/1',
    sourceUrl: 'https://old.test',
  }
  saveEvent(event)
  saveEvent({
    ...event,
    title: 'Deadline passed',
    date: '2030-01-01',
    deadline: '2001-01-01',
    registerUrl: 'https://old.test/2',
  })
  saveEvent({ ...event, title: 'Old but published', registerUrl: 'https://old.test/3' }, 'published')
  assert.equal(tidyEvents().drafts, 2)
  const { db } = await import('../src/db/connection.ts')
  assert.ok(db.prepare("SELECT 1 FROM events WHERE title = 'Old but published'").get())
})

test('too many wrong passwords locks that email for a while', async () => {
  const wrong = json({ email: 'nm@comoonly.test', password: 'nope' })
  for (let i = 0; i < 10; i++) assert.equal(await status('/auth/login', wrong), 401)
  assert.equal(await status('/auth/login', wrong), 429)
  assert.equal(await status('/auth/login', json({ email: 'nm@comoonly.test', password: 'comoonly-demo' })), 429) // even the right one, for now
})
