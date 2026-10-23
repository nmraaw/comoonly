import { test } from 'node:test'
import assert from 'node:assert/strict'
import { base, get, json, loginAs, status } from './helpers.ts'
import { cleanEvents } from '../src/modules/events/events.ai.ts'
import { eventsFromJsonLd } from '../src/modules/events/events.finder.ts'

// A date a number of days from now, e.g. soon(30) → '2026-11-22'. Events must be upcoming, but not years away.
const soon = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

test('connections, then direct messages only between connected people', async () => {
  const [hira, zain] = [await loginAs('hira'), await loginAs('zain')]
  assert.equal(await status('/messages/with/zain', json({ text: 'hey' }, hira)), 403) // not connected yet
  assert.equal((await (await fetch(`${base}/users/zain/connect`, json({}, hira))).json()).status, 'pending')
  assert.equal((await get('/users/hira', zain)).connection, 'incoming')
  assert.deepEqual(
    (await get('/connections', zain)).incoming.map((u: { id: string }) => u.id),
    ['hira'],
  )

  assert.equal(await status('/connections/hira', json({ decision: 'accept' }, zain)), 200)
  assert.equal(await status('/messages/with/zain', json({ text: 'hey zain' }, hira)), 201)
  assert.equal(await status('/messages/with/hira', json({ text: 'hi!' }, zain)), 201)
  const chat = await get('/messages/with/hira', zain)
  assert.deepEqual(
    chat.map((m: { author: string; text: string }) => [m.author, m.text]),
    [
      ['Hira S.', 'hey zain'],
      ['Zain A.', 'hi!'],
    ],
  )
  const people = (await get('/messages', zain)).people
  assert.deepEqual(
    people.map((p: { id: string; last: string }) => [p.id, p.last]),
    [['hira', 'hi!']],
  )
  assert.equal(await status('/users/zain/connect', json({}, zain)), 400) // can't connect with yourself
})

test('group chat, activities and to-dos are for members only', async () => {
  const [hira, zain] = [await loginAs('hira'), await loginAs('zain')] // Hira hosts tiny-game; Zain isn't in it
  assert.equal(await status('/groups/tiny-game/messages', json({ text: 'Welcome!' }, hira)), 201)
  assert.equal((await get('/groups/tiny-game/messages', hira))[0].text, 'Welcome!')
  assert.equal(await status('/groups/tiny-game/messages', { headers: { cookie: zain } }), 403)

  const plan = { title: 'First jam', date: '2030-01-05T16:00', place: 'Online' }
  assert.equal(await status('/groups/tiny-game/activities', json({ ...plan, date: 'soon' }, hira)), 400)
  const activity = await (await fetch(`${base}/groups/tiny-game/activities`, json(plan, hira))).json()
  const going = await (await fetch(`${base}/activities/${activity.id}/going`, json({}, hira))).json()
  assert.deepEqual([going.going, going.goingCount], [true, 1])
  assert.deepEqual(await get(`/activities/${activity.id}`, zain), {
    id: activity.id,
    groupId: 'tiny-game',
    locked: true,
  })
  assert.equal(await status(`/activities/${activity.id}/going`, json({}, zain)), 403)

  const tasks = await (await fetch(`${base}/groups/tiny-game/tasks`, json({ title: 'Pick a mechanic' }, hira))).json()
  const toggled = await (await fetch(`${base}/tasks/${tasks[0].id}/toggle`, json({}, hira))).json()
  assert.equal(toggled[0].done, true)
  assert.equal(await status(`/tasks/${tasks[0].id}/toggle`, json({}, zain)), 403)

  assert.deepEqual(await (await fetch(`${base}/groups/film-club/save`, json({}, zain))).json(), ['film-club'])
  assert.deepEqual(await (await fetch(`${base}/groups/film-club/save`, json({}, zain))).json(), []) // again = unsave
})

test('event finder reads JSON-LD and drops past or malformed events', () => {
  const html = `<html><script type="application/ld+json">{"@type":"ItemList","itemListElement":[
    {"item":{"@type":"Event","name":"Lahore Hackathon","startDate":"${soon(60)}T10:00:00+05:00",
      "location":{"@type":"Place","address":{"addressLocality":"Lahore"}},"url":"/e/1"}},
    {"item":{"@type":"Event","name":"Old meetup","startDate":"2001-01-01","url":"https://x.test/old"}},
    {"item":{"@type":"Event","name":"No date","url":"https://x.test/nodate"}}]}</script>
    <script type="application/ld+json">{broken json</script></html>`
  const found = cleanEvents(eventsFromJsonLd(html, 'https://events.test/list'), {
    name: 'test',
    url: 'https://events.test/list',
  })
  assert.deepEqual(found, [
    {
      title: 'Lahore Hackathon',
      date: `${soon(60)}T10:00:00+05:00`,
      city: 'Lahore',
      mode: 'In person',
      category: 'Hackathon',
      description: '',
      deadline: '',
      registerUrl: 'https://events.test/e/1',
      sourceUrl: 'https://events.test/list',
    },
  ])
})

test('admins publish events; anyone can find people to go with', async () => {
  const [sara, hira, zain] = [await loginAs('sara'), await loginAs('hira'), await loginAs('zain')] // Sara is admin
  const event = {
    title: 'Karachi Code Jam',
    date: '2030-02-01T09:00',
    city: 'Karachi',
    category: 'Hackathon',
    registerUrl: 'https://jam.test/register',
    sourceUrl: 'https://jam.test',
  }
  assert.equal(await status('/events', json(event, hira)), 403) // not an admin
  assert.equal(await status('/events', json({ ...event, registerUrl: 'javascript:alert(1)' }, sara)), 400)
  assert.equal(await status('/events', json(event, sara)), 201)
  assert.equal(await status('/events', json(event, sara)), 409) // duplicate
  assert.equal(await status('/events', json({ ...event, sourceUrl: 'https://other.test' }, sara)), 409) // same event, other page
  assert.equal((await get('/auth/me', sara)).isAdmin, true)

  const [listed] = await get('/events', hira)
  const first = await (await fetch(`${base}/events/${listed.id}/go`, json({}, hira))).json()
  const second = await (await fetch(`${base}/events/${listed.id}/go`, json({}, zain))).json()
  assert.equal(first.groupId, second.groupId) // one group per event
  assert.equal((await get('/events', hira))[0].goingCount, 2)
  assert.equal(await status(`/groups/${first.groupId}/messages`, { headers: { cookie: zain } }), 200) // Zain is in

  // A one-field edit must only change that field (regression: defaults used to wipe city and category).
  const edited = await (
    await fetch(`${base}/events/${listed.id}`, json({ title: 'Karachi Code Jam 2' }, sara, 'PATCH'))
  ).json()
  assert.deepEqual([edited.title, edited.city, edited.category], ['Karachi Code Jam 2', 'Karachi', 'Hackathon'])

  assert.deepEqual(await get('/events/review', sara), []) // nothing waiting

  // The same concert posted by two accounts with different titles is saved once.
  const { saveEvent } = await import('../src/modules/events/events.service.ts')
  const concert = {
    date: '2030-03-03T18:00',
    deadline: '',
    city: 'Lahore',
    mode: 'In person' as const,
    category: 'Event',
    description: '',
    sourceUrl: 'https://instagram.test',
  }
  assert.equal(
    saveEvent({ ...concert, title: 'Prem Nagar Charity Concert', registerUrl: 'https://instagram.test/p/a' }),
    true,
  )
  assert.equal(
    saveEvent({
      ...concert,
      title: 'Prem Nagar - Live Concert featuring Shafqat',
      registerUrl: 'https://instagram.test/p/b',
    }),
    false,
  )
  assert.equal(
    saveEvent({ ...concert, title: 'Clay Mirror Workshop', registerUrl: 'https://instagram.test/p/c' }),
    true,
  )
  assert.equal(await status('/events/review', { headers: { cookie: hira } }), 403)
})
