import { test } from 'node:test'
import assert from 'node:assert/strict'
import { base, get, json, loginAs, status } from './helpers.ts'

test('feed returns seeded groups in the frontend shape, with filters and sorting', async () => {
  const all = await get('/groups')
  assert.equal(all.length, 6)
  assert.deepEqual(all[0], {
    id: 'bedroom-musicians',
    name: 'Bedroom musicians',
    title: 'Bedroom musicians, let’s make a band.',
    category: 'Music',
    description: 'Guitarist looking for a singer & a drummer. Beginners very welcome.',
    members: 4,
    spots: 2,
    location: 'Sialkot',
    mode: 'In person',
    owner: 'Areeba R.',
    ownerId: 'areeba',
    initials: 'AR',
    color: 'lilac',
  })
  const creative = await get('/groups?category=Creative&location=Sialkot')
  assert.deepEqual(
    creative.map((g: { id: string }) => g.id),
    ['sunday-sketch'],
  )
  assert.equal((await get('/groups?sort=spots'))[0].id, 'sketch-walks') // 5 spots left, the most
  assert.equal((await get(`/groups?q=${encodeURIComponent('%')}`)).length, 0) // % is literal text, not a wildcard
  assert.equal(await status('/groups?sort=evil'), 400)
  assert.equal(await status('/groups/nope'), 404)
})

test('signup, create a group, then see it in the feed; logout ends the session', async () => {
  const group = {
    name: 'Chess at noon',
    description: 'Casual games.',
    category: 'Tech',
    mode: 'In person',
    location: 'Campus',
    spots: 3,
  }
  assert.equal(await status('/groups', json(group)), 401) // must log in first

  const signup = await fetch(
    `${base}/auth/signup`,
    json({ name: 'Ali K.', email: 'Ali@Example.com', password: 'longenough' }),
  )
  assert.equal(signup.status, 201)
  const user = await signup.json()
  assert.equal(user.password_hash, undefined) // the stored hash must never leave the server
  const cookie = signup.headers.get('set-cookie')!.split(';')[0]
  assert.equal((await get('/auth/me', cookie)).email, 'ali@example.com')
  assert.equal(await status('/auth/signup', json({ name: 'X', email: 'ali@example.com', password: 'longenough' })), 409)

  const created = await (await fetch(`${base}/groups`, json(group, cookie))).json()
  assert.deepEqual([created.owner, created.members, created.spots], ['Ali K.', 1, 3])
  assert.deepEqual(await get(`/groups/${created.id}`), created)
  assert.equal(await status('/groups', json({ ...group, location: '' }, cookie)), 400) // in-person needs a place

  const login = await fetch(`${base}/auth/login`, json({ email: 'ali@example.com', password: 'longenough' }))
  assert.equal((await login.json()).password_hash, undefined)
  assert.equal(await status('/auth/login', json({ email: 'ali@example.com', password: 'wrong' })), 401)

  assert.equal(await status('/auth/logout', json({}, cookie)), 204)
  assert.equal(await status('/auth/me', { headers: { cookie } }), 401) // old cookie is dead
})

test('join request: ask, host accepts or declines, member counts follow', async () => {
  // Sara hosts the film club; Areeba is already a member; Hamza and Zain are not.
  const [sara, areeba, hamza, zain] = [
    await loginAs('sara'),
    await loginAs('areeba'),
    await loginAs('hamza'),
    await loginAs('zain'),
  ]
  const ask = (cookie: string) => status('/groups/film-club/requests', json({ intro: 'Hi!' }, cookie))
  const answer = (userId: string, decision: string) =>
    status(`/groups/film-club/requests/${userId}`, json({ decision }, sara))

  assert.equal(await status('/groups/film-club/requests', json({ intro: '' }, hamza)), 400)
  assert.equal(await ask(hamza), 201)
  assert.equal(await ask(zain), 201)
  assert.equal((await get('/groups/memberships', hamza))['film-club'], 'pending')
  assert.equal(await status('/groups/film-club/requests', { headers: { cookie: areeba } }), 403) // not the host
  const waiting = await get('/groups/film-club/requests', sara)
  assert.deepEqual(
    waiting.map((r: { id: string; intro: string }) => [r.id, r.intro]),
    [
      ['hamza', 'Hi!'],
      ['zain', 'Hi!'],
    ],
  )

  assert.equal(await answer('hamza', 'accept'), 200)
  assert.equal(await answer('zain', 'decline'), 200)
  assert.equal(await ask(zain), 409) // declined people can't re-ask
  const club = await get('/groups/film-club')
  assert.deepEqual([club.members, club.spots], [4, 3])
  assert.ok((await get('/groups/film-club/members', hamza)).some((m: { id: string }) => m.id === 'hamza'))
  assert.equal(await status('/groups/film-club/members', { headers: { cookie: zain } }), 403)
})

test('profiles: edit your own, view anyone’s without their email', async () => {
  const hira = await loginAs('hira')
  const profile = { name: 'Hira S.', city: 'Lahore', tagline: 'New city', bio: 'Hi', interests: ['Games'] }
  assert.equal(await status('/users/me', json({ ...profile, interests: [] }, hira, 'PATCH')), 400)
  const saved = await (await fetch(`${base}/users/me`, json(profile, hira, 'PATCH'))).json()
  assert.equal(saved.city, 'Lahore')
  const seen = await get('/users/hira', await loginAs('zain'))
  assert.equal(seen.city, 'Lahore')
  assert.equal(seen.email, undefined)
  assert.ok(seen.groups.some((g: { id: string }) => g.id === 'tiny-game'))
})
