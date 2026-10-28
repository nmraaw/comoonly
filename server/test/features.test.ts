import { test } from 'node:test'
import assert from 'node:assert/strict'
import { base, get, json, loginAs, status } from './helpers.ts'
import { cleanEvents } from '../src/modules/events/events.ai.ts'
import { eventsFromJsonLd } from '../src/modules/events/events.finder.ts'

// A date a number of days from now, e.g. soon(30) → '2026-11-22'. Events must be upcoming, but not years away.
const soon = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString().slice(0, 10)

test('message requests: one message to anyone, then a normal chat once accepted', async () => {
  const [hira, zain, noor] = [await loginAs('hira'), await loginAs('zain'), await loginAs('noor')]
  // Noor isn't connected to Zain: her first message is a request; a second waits for his answer.
  assert.equal(await status('/messages/with/zain', json({ text: 'hi, saw you at the jam!' }, noor)), 201)
  assert.equal(await status('/messages/with/zain', json({ text: 'hello??' }, noor)), 403)
  assert.equal((await get('/connections', zain)).incoming[0].message, 'hi, saw you at the jam!')
  assert.deepEqual(
    (await get('/messages', noor)).people.map((p: { id: string; status: string }) => [p.id, p.status]),
    [['zain', 'pending']],
  )
  assert.equal(await status('/messages/with/noor', json({ text: 'hey!' }, zain)), 201) // replying accepts
  assert.equal((await get('/users/noor', zain)).connection, 'accepted')
  assert.equal(await status('/messages/with/zain', json({ text: 'great' }, noor)), 201)

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
    [
      ['hira', 'hi!'],
      ['noor', 'great'],
    ],
  )
  assert.equal(await status('/users/zain/connect', json({}, zain)), 400) // can't connect with yourself
})

test('group chat is for members only', async () => {
  const [hira, zain] = [await loginAs('hira'), await loginAs('zain')] // Hira hosts tiny-game; Zain isn't in it
  assert.equal(await status('/groups/tiny-game/messages', json({ text: 'Welcome!' }, hira)), 201)
  assert.equal((await get('/groups/tiny-game/messages', hira))[0].text, 'Welcome!')
  assert.equal(await status('/groups/tiny-game/messages', { headers: { cookie: zain } }), 403)

  assert.deepEqual(await (await fetch(`${base}/groups/film-club/save`, json({}, zain))).json(), ['film-club'])
  assert.deepEqual(await (await fetch(`${base}/groups/film-club/save`, json({}, zain))).json(), []) // again = unsave
})

test('event finder reads JSON-LD and drops past or malformed events', () => {
  const html = `<html><script type="application/ld+json">{"@type":"ItemList","itemListElement":[
    {"item":{"@type":"Event","name":"Lahore Hackathon","startDate":"${soon(60)}T10:00:00+05:00",
      "location":{"@type":"Place","address":{"addressLocality":"Lahore"}},"url":"/e/1",
      "image":["https://img.test/hack.jpg"]}},
    {"item":{"@type":"Event","name":"Old meetup","startDate":"2001-01-01","url":"https://x.test/old"}},
    {"item":{"@type":"Event","name":"No date","url":"https://x.test/nodate"}}]}</script>
    <script type="application/ld+json">{broken json</script></html>`
  assert.equal(eventsFromJsonLd(html, 'https://events.test/list')[0].image, 'https://img.test/hack.jpg') // the poster
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
      price: null,
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
  assert.equal((await get(`/events/${listed.id}`, hira)).title, 'Karachi Code Jam') // its own page
  const first = await (await fetch(`${base}/events/${listed.id}/go`, json({ intent: 'company' }, hira))).json()
  const second = await (await fetch(`${base}/events/${listed.id}/go`, json({ intent: 'meet' }, zain))).json()
  assert.equal(first.groupId, second.groupId) // one group per event
  assert.equal((await get(`/groups/${first.groupId}`)).forEvent, true) // kept off Discover
  assert.equal((await get('/events', hira))[0].goingCount, 2)
  assert.equal(await status(`/groups/${first.groupId}/messages`, { headers: { cookie: zain } }), 200) // Zain is in

  // "Add to calendar": 09:00 Pakistan time is 04:00 UTC.
  const ics = await (await fetch(`${base}/events/${listed.id}/calendar.ics`, { headers: { cookie: zain } })).text()
  assert.match(ics, /DTSTART:20300201T040000Z\r\n/)
  assert.match(ics, /SUMMARY:Karachi Code Jam\r\nLOCATION:Karachi\r\n/)

  // Posters: admins add one; members see it, and the event group finds its event.
  const png = 'data:image/png;base64,iVBORw0KGgo='
  assert.equal(await status(`/events/${listed.id}/poster`, json({ image: png }, hira, 'PUT')), 403)
  assert.equal(
    await status(`/events/${listed.id}/poster`, json({ image: 'data:text/html;base64,PGI+' }, sara, 'PUT')),
    400,
  )
  assert.equal(await status(`/events/${listed.id}/poster`, json({ image: png }, sara, 'PUT')), 204)
  const poster = await fetch(`${base}/events/${listed.id}/poster`, { headers: { cookie: zain } })
  assert.equal(poster.headers.get('content-type'), 'image/png')
  const forGroup = await get(`/events/for-group/${first.groupId}`, zain)
  assert.deepEqual([forGroup.id, forGroup.hasPoster], [listed.id, 1])

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
    typeof saveEvent({ ...concert, title: 'Prem Nagar Charity Concert', registerUrl: 'https://instagram.test/p/a' }),
    'string', // the new event's id
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
    typeof saveEvent({ ...concert, title: 'Clay Mirror Workshop', registerUrl: 'https://instagram.test/p/c' }),
    'string',
  )
  assert.equal(await status('/events/review', { headers: { cookie: hira } }), 403)

  // Going together. "With my friends" stays out of the everyone-going chat.
  const noor = await loginAs('noor')
  const going = await (await fetch(`${base}/events/${listed.id}/go`, json({ intent: 'friends' }, noor))).json()
  assert.deepEqual(going, { groupId: null })
  assert.equal((await get(`/events/${listed.id}`, noor)).myIntent, 'friends')
  assert.equal(await status(`/groups/${first.groupId}/messages`, { headers: { cookie: noor } }), 403)

  // Crews: verified profiles only; women-only crews are invisible and closed to men; the organizer accepts people.
  const { db } = await import('../src/db/connection.ts')
  const crew = { size: 3, womenOnly: true, plan: 'Main gate, 8:45' }
  assert.equal(await status(`/events/${listed.id}/crews`, json(crew, hira)), 403) // no gender yet: not verified
  db.prepare("UPDATE users SET gender = 'woman' WHERE id IN ('hira', 'noor')").run()
  db.prepare("UPDATE users SET gender = 'man' WHERE id = 'zain'").run()
  assert.equal((await get('/auth/me', hira)).verified, true)
  const { id: crewId } = await (await fetch(`${base}/events/${listed.id}/crews`, json(crew, hira))).json()
  assert.deepEqual(await get(`/events/${listed.id}/crews`, zain), []) // hidden from men
  assert.equal(await status(`/groups/${crewId}/requests`, json({ intro: 'hi' }, zain)), 403)
  const asked = await (await fetch(`${base}/groups/${crewId}/requests`, json({ intro: 'Can I come?' }, noor))).json()
  assert.equal(asked.status, 'pending')
  assert.equal(await status(`/groups/${crewId}/requests/noor`, json({ decision: 'accept' }, hira)), 200)
  assert.equal(await status(`/events/${listed.id}/crews`, json(crew, hira)), 409) // one crew per organizer
  const [listedCrew] = await get(`/events/${listed.id}/crews`, noor)
  assert.deepEqual(
    [listedCrew.members, listedCrew.size, listedCrew.womenOnly, listedCrew.myStatus],
    [2, 3, true, 'joined'],
  )
  assert.equal((await get(`/groups/${crewId}`)).forEvent, true) // crews stay off Discover
  // The database guards women-only crews too, whatever the server code does.
  assert.throws(() => db.prepare("INSERT INTO group_members (group_id, user_id) VALUES (?, 'zain')").run(crewId))

  // After the event, crew members hear who they went with (once).
  const { followUpCrews } = await import('../src/modules/events/events.going.ts')
  db.prepare("UPDATE events SET starts_at = '2001-01-01' WHERE id = ?").run(listed.id)
  assert.equal(followUpCrews(), 1)
  assert.equal(followUpCrews(), 0)
  assert.match((await get('/notifications', noor))[0].text, /with Hira\. Say thanks and connect!/)

  // "Same crew next time?": the organizer keeps the crew as a community, which outlives the event.
  const keep = { name: 'Hira’s sketch crew', category: 'Drawing' }
  assert.equal(await status(`/groups/${crewId}/keep`, json(keep, noor)), 403)
  const kept = await (await fetch(`${base}/groups/${crewId}/keep`, json(keep, hira))).json()
  assert.deepEqual([kept.name, kept.category, kept.forEvent, kept.crewFor], [keep.name, 'Drawing', false, null])
  assert.match(
    (await get('/notifications', noor))[0].text,
    /Same crew next time! Hira’s sketch crew is now a community/,
  )

  // Deleting an event (admins only) removes its go-together group too.
  assert.equal(await status(`/events/${listed.id}`, json({}, hira, 'DELETE')), 403)
  assert.equal(await status(`/events/${listed.id}`, json({}, sara, 'DELETE')), 204)
  assert.equal(await status(`/groups/${first.groupId}`), 404)
  assert.equal(await status(`/groups/${crewId}`), 200) // the kept crew stays
  assert.equal((await get('/events', hira)).length, 0)
})

test('profile and group photos: yours to change, anyone logged in can see them', async () => {
  const [hira, zain] = [await loginAs('hira'), await loginAs('zain')] // Hira hosts tiny-game
  const png = { image: 'data:image/png;base64,iVBORw0KGgo=' }
  assert.equal(await status('/users/me/photo', json(png, hira, 'PUT')), 204)
  assert.equal(
    (await fetch(`${base}/users/hira/photo`, { headers: { cookie: zain } })).headers.get('content-type'),
    'image/png',
  )
  assert.equal(await status('/users/zain/photo', { headers: { cookie: zain } }), 404) // no photo yet
  assert.equal(await status('/groups/tiny-game/photo', json(png, zain, 'PUT')), 403) // not the host
  assert.equal(await status('/groups/tiny-game/photo', json(png, hira, 'PUT')), 204)
  assert.equal((await get('/groups/tiny-game')).hasPhoto, true)
  assert.equal(await status('/users/me/photo', json({}, hira, 'DELETE')), 204)
  assert.equal(await status('/users/hira/photo', { headers: { cookie: zain } }), 404)
})

test('voice messages: sent in a chat, heard only by the people in it', async () => {
  const [hira, zain] = [await loginAs('hira'), await loginAs('zain')] // Hira hosts tiny-game; Zain isn't in it
  const audio = 'data:audio/webm;codecs=opus;base64,GkXfo59ChoEBQveBAULygQRC84EIQoKEd2VibUKHgQJChYEC'
  assert.equal(
    await status('/groups/tiny-game/messages/voice', json({ audio: 'data:text/plain;base64,aGk=' }, hira)),
    400,
  )
  const sent = await (await fetch(`${base}/groups/tiny-game/messages/voice`, json({ audio }, hira))).json()
  assert.deepEqual([sent.text, sent.voice], ['🎤 Voice message', 1])
  const heard = await fetch(`${base}/voice/${sent.id}`, { headers: { cookie: hira } })
  assert.equal(heard.headers.get('content-type'), 'audio/webm')
  assert.equal(await status(`/voice/${sent.id}`, { headers: { cookie: zain } }), 403) // not in the group
})

test('communities: matching people hear about new ones; pinned plan, polls and votes are for members', async () => {
  const [zain, noor, hamza] = [await loginAs('zain'), await loginAs('noor'), await loginAs('hamza')]
  const community = {
    name: 'Sketch & chai',
    description: 'Drawing on Sundays.',
    mode: 'In person',
    location: 'Sialkot',
    spots: 5,
  }
  assert.equal(await status('/groups', json({ ...community, category: ' ' }, zain)), 400) // an interest is needed
  const { id } = await (await fetch(`${base}/groups`, json({ ...community, category: 'Drawing' }, zain))).json()
  // Noor likes Drawing and lives in Sialkot; Hamza likes Drawing but is elsewhere.
  assert.match((await get('/notifications', noor))[0].text, /A new Drawing community started in Sialkot: Sketch & chai/)
  assert.ok(!(await get('/notifications', hamza)).some((n: { text: string }) => n.text.includes('Sketch & chai')))

  assert.equal(await status(`/groups/${id}/pinned`, json({ pinned: 'Sun 10am, Cafe' }, noor, 'PUT')), 403)
  assert.equal(await status(`/groups/${id}/pinned`, json({ pinned: 'Sun 10am, Cafe' }, zain, 'PUT')), 204)
  assert.equal((await get(`/groups/${id}`)).pinned, 'Sun 10am, Cafe')

  assert.equal(await status(`/groups/${id}/polls`, json({ question: 'Chai?', options: ['Yes'] }, zain)), 400)
  const poll = await (
    await fetch(`${base}/groups/${id}/polls`, json({ question: 'Chai?', options: ['Yes', 'Always'] }, zain))
  ).json()
  assert.deepEqual([poll.text, poll.poll, poll.votes], ['📊 Chai?', ['Yes', 'Always'], []])
  assert.equal(await status(`/messages/${poll.id}/vote`, json({ choice: 0 }, noor)), 403) // not a member
  assert.equal(await status(`/messages/${poll.id}/vote`, json({ choice: 2 }, zain)), 400) // only 2 choices
  assert.equal(await status(`/messages/${poll.id}/vote`, json({ choice: 0 }, zain)), 204)
  assert.equal(await status(`/messages/${poll.id}/vote`, json({ choice: 1 }, zain)), 204) // changing your vote
  const [message] = (await get(`/groups/${id}/messages`, zain)).slice(-1)
  assert.deepEqual(message.votes, [{ userId: 'zain', choice: 1 }])
})

test('find me a crew: waits, forms a crew from the best matches, then sends newcomers to it', async () => {
  const { db } = await import('../src/db/connection.ts')
  db.prepare("UPDATE users SET gender = 'man' WHERE id IN ('zain', 'nm', 'me')").run()
  db.prepare("UPDATE users SET gender = 'woman' WHERE id = 'areeba'").run()
  const [sara, zain, nm, me, areeba] = await Promise.all(['sara', 'zain', 'nm', 'me', 'areeba'].map((u) => loginAs(u)))
  const event = {
    title: 'Open mic night',
    date: '2031-03-01T19:00',
    city: 'Sialkot',
    category: 'Music',
    registerUrl: 'https://mic.test/1',
    sourceUrl: 'https://mic.test',
  }
  await fetch(`${base}/events`, json(event, sara))
  const { id } = (await get('/events', zain)).find((e: { title: string }) => e.title === event.title)
  const match = (cookie: string, womenOnly = false) => fetch(`${base}/events/${id}/match`, json({ womenOnly }, cookie))

  assert.equal((await match(zain, true)).status, 403) // women-only is for women
  assert.deepEqual(await (await match(zain)).json(), { result: 'waiting', waiting: 1 })
  assert.deepEqual(await (await match(nm)).json(), { result: 'waiting', waiting: 2 })
  assert.deepEqual(await get(`/events/${id}/match`, zain), { waiting: true, total: 2 })
  const formed = await (await match(me)).json() // the third person: a crew is formed
  assert.equal(formed.result, 'matched')
  const [crew] = await get(`/events/${id}/crews`, me)
  assert.deepEqual([crew.id, crew.members, crew.myStatus], [formed.crewId, 3, 'joined'])
  assert.match((await get('/notifications', zain))[0].text, /You’ve been matched into a crew for Open mic night/)
  assert.deepEqual(await get(`/events/${id}/match`, zain), { waiting: false, total: 0 })
  assert.equal((await match(me)).status, 409) // already in a crew
  assert.equal((await get('/events', me)).find((e: { id: string }) => e.id === id).myIntent, 'company')

  // Someone new joins the open matched crew, as a request its organizer answers.
  assert.deepEqual(await (await match(areeba)).json(), { result: 'requested', crewId: formed.crewId })
  const organizer = await loginAs(crew.ownerId)
  const [request] = await get(`/groups/${formed.crewId}/requests`, organizer)
  assert.deepEqual([request.id, /Matched by Comoonly/.test(request.intro)], ['areeba', true])
})

test('chat photos are for the people in the chat; who’s going unlocks once you’re going', async () => {
  const [sara, hamza, zain, noor] = await Promise.all(['sara', 'hamza', 'zain', 'noor'].map((u) => loginAs(u)))
  const image = 'data:image/png;base64,iVBORw0KGgo='
  const sent = await (await fetch(`${base}/groups/film-club/messages/photo`, json({ image }, sara))).json() // Sara hosts
  assert.deepEqual([sent.text, sent.photo], ['📷 Photo', 1])
  assert.equal((await get('/groups/film-club/messages', sara)).at(-1).photo, 1)
  assert.equal(await status(`/chat-photos/${sent.id}`, { headers: { cookie: sara } }), 200)
  assert.equal(await status(`/chat-photos/${sent.id}`, { headers: { cookie: zain } }), 403) // not in the group
  assert.equal(await status('/groups/film-club/messages/photo', json({ image: 'data:text/html;base64,AA' }, sara)), 400)

  const event = {
    title: 'Board game night',
    date: '2031-05-01T19:00',
    city: 'Sialkot',
    category: 'Games',
    registerUrl: 'https://games.test/1',
    sourceUrl: 'https://games.test',
  }
  await fetch(`${base}/events`, json(event, sara))
  const { id } = (await get('/events', zain)).find((e: { title: string }) => e.title === event.title)
  await fetch(`${base}/events/${id}/go`, json({ intent: 'company' }, hamza))
  await fetch(`${base}/events/${id}/go`, json({ intent: 'friends' }, noor)) // with friends: not on the list
  assert.deepEqual(await get(`/events/${id}/going`, zain), { locked: true, count: 1 })
  await fetch(`${base}/events/${id}/go`, json({ intent: 'meet' }, zain))
  const going = await get(`/events/${id}/going`, zain)
  assert.deepEqual([going.locked, going.people.map((p: { id: string }) => p.id)], [false, ['hamza']])
})

test('prices on events; a crew’s areas and shared costs, split so everyone is even', async () => {
  const [sara, hira, me, zain] = await Promise.all(['sara', 'hira', 'me', 'zain'].map((u) => loginAs(u)))
  const event = {
    title: 'Pottery evening',
    date: '2031-06-01T18:00',
    city: 'Sialkot',
    category: 'Workshop',
    registerUrl: 'https://pots.test/1',
    sourceUrl: 'https://pots.test',
    price: 'Rs 2,200', // as a poster or the AI might write it
  }
  await fetch(`${base}/events`, json(event, sara))
  const listed = (await get('/events', hira)).find((e: { title: string }) => e.title === event.title)
  assert.equal(listed.price, 2200)
  assert.equal(await status(`/events/${listed.id}`, json({ price: '' }, sara, 'PATCH')), 200) // cleared: not stated
  assert.equal((await get(`/events/${listed.id}`, hira)).price, null)

  const tiny = 'tiny-game' // stands in for a crew (same members-only rules); Hira hosts, 'me' and Sara are in it
  assert.equal(await status(`/groups/${tiny}/area`, json({ area: 'Gulshan' }, zain, 'PUT')), 403) // not a member
  assert.equal(await status(`/groups/${tiny}/area`, json({ area: 'Gulshan' }, hira, 'PUT')), 204)
  const members = await get(`/groups/${tiny}/members`, hira)
  assert.equal(members.find((m: { id: string }) => m.id === 'hira').area, 'Gulshan')

  assert.equal(await status(`/groups/${tiny}/expenses`, json({ what: 'Tickets', amount: 0 }, hira)), 400)
  await fetch(`${base}/groups/${tiny}/expenses`, json({ what: 'Tickets', amount: 900 }, hira))
  const costs = await get(`/groups/${tiny}/expenses`, hira)
  const n = members.length
  assert.equal(costs.total, 900)
  assert.equal(costs.settle.length, n - 1) // everyone else pays Hira their share
  assert.ok(costs.settle.every((s: { to: string; amount: number }) => s.to === 'Hira S.' && s.amount === 900 / n))
  const [expense] = costs.expenses
  assert.equal(await status(`/groups/${tiny}/expenses/${expense.id}`, json({}, me, 'DELETE')), 404) // not the payer
  assert.equal(await status(`/groups/${tiny}/expenses/${expense.id}`, json({}, hira, 'DELETE')), 204)
  assert.deepEqual((await get(`/groups/${tiny}/expenses`, sara)).settle, [])
})
