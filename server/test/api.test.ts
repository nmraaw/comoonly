import { test } from 'node:test'
import assert from 'node:assert/strict'
import { base, get, json, loginAs, status } from './helpers.ts'
import { createServer } from 'node:http'
import { outbox, sendEmail } from '../src/email.ts'
import { config } from '../src/config.ts'

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
    forEvent: false,
    crewFor: null,
    womenOnly: false,
    hasPhoto: false,
    eventId: null,
    eventTitle: null,
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

test('signup, create a group, logout, delete account', async () => {
  const group = {
    name: 'Chess at noon',
    description: 'Casual games.',
    category: 'Tech',
    mode: 'In person',
    location: 'Campus',
    spots: 3,
  }
  assert.equal(await status('/groups', json(group)), 401) // must log in first

  config.email.user = 'comoonly@gmail.test' // email is set up: everyone gets a code (still sent to `outbox` here)
  // Sign-up only emails a code. Someone else signing up with the same email before it's verified
  // doesn't lock the owner out: the code goes to the owner's inbox, and their password wins.
  assert.equal(await status('/auth/signup', json({ name: 'X', email: 'ali@example.com', password: 'squatter1' })), 202)
  const signup = await fetch(
    `${base}/auth/signup`,
    json({ name: 'Ali K.', email: 'Ali@Example.com', password: 'longenough' }),
  )
  assert.equal(signup.status, 202)
  assert.equal(signup.headers.get('set-cookie'), null) // not logged in yet
  assert.equal(await status('/auth/login', json({ email: 'ali@example.com', password: 'longenough' })), 202) // still needs the code
  const code = outbox.findLast((m) => m.to === 'ali@example.com')!.text.match(/\d{6}/)![0]
  assert.equal(outbox.filter((m) => m.to === 'ali@example.com').length, 1) // one email a minute at most
  const verify = (c: string) =>
    fetch(`${base}/auth/verify`, json({ email: 'ali@example.com', password: 'longenough', code: c }))
  assert.equal((await verify(code === '000000' ? '111111' : '000000')).status, 400)
  const verified = await verify(code)
  assert.equal(verified.status, 201)
  const user = await verified.json()
  assert.equal(user.password_hash, undefined) // the stored hash must never leave the server
  const cookie = verified.headers.get('set-cookie')!.split(';')[0]
  assert.equal((await get('/auth/me', cookie)).email, 'ali@example.com')
  assert.equal((await verify(code)).status, 400) // a code works once
  assert.equal(await status('/auth/signup', json({ name: 'X', email: 'ali@example.com', password: 'longenough' })), 409)
  assert.equal(await status('/auth/login', json({ email: 'ali@example.com', password: 'squatter1' })), 401)

  const created = await (await fetch(`${base}/groups`, json(group, cookie))).json()
  assert.deepEqual([created.owner, created.members, created.spots], ['Ali K.', 1, 3])
  assert.deepEqual(await get(`/groups/${created.id}`), created)
  assert.equal(await status('/groups', json({ ...group, location: '' }, cookie)), 400) // in-person needs a place

  const login = await fetch(`${base}/auth/login`, json({ email: 'ali@example.com', password: 'longenough' }))
  assert.equal((await login.json()).password_hash, undefined)
  assert.equal(await status('/auth/login', json({ email: 'ali@example.com', password: 'wrong' })), 401)

  assert.equal(await status('/auth/logout', json({}, cookie)), 204)
  assert.equal(await status('/auth/me', { headers: { cookie } }), 401) // old cookie is dead

  // Deleting the account needs the password, then removes the person and the group they host.
  const again = login.headers.get('set-cookie')!.split(';')[0]
  assert.equal(await status('/auth/me', json({ password: 'wrong' }, again, 'DELETE')), 401)
  assert.equal(await status('/auth/me', json({ password: 'longenough' }, again, 'DELETE')), 204)
  assert.equal(await status('/auth/me', { headers: { cookie: again } }), 401)
  assert.equal(await status(`/groups/${created.id}`), 404)
  assert.equal(await status('/auth/login', json({ email: 'ali@example.com', password: 'longenough' })), 401)
  config.email.user = ''
})

test('forgot password: a code by email, a new password, and other devices logged out', async () => {
  config.email.user = 'comoonly@gmail.test' // email "set up" (messages still land in `outbox` here)
  const old = await loginAs('noor')
  assert.equal(await status('/auth/forgot', json({ email: 'nobody@example.com' })), 204) // doesn't reveal accounts
  assert.equal(await status('/auth/forgot', json({ email: 'noor@comoonly.test' })), 204)
  const code = outbox.findLast((m) => m.to === 'noor@comoonly.test')!.text.match(/\d{6}/)![0]
  const reset = (c: string, password = 'brand-new-pass') =>
    fetch(`${base}/auth/reset`, json({ email: 'noor@comoonly.test', code: c, password }))
  assert.equal((await reset(code, 'short')).status, 400) // new password too short
  assert.equal((await reset(code === '000000' ? '111111' : '000000')).status, 400) // wrong code
  const done = await reset(code)
  assert.equal(done.status, 200)
  assert.ok(done.headers.get('set-cookie')) // logged in here
  assert.equal(await status('/auth/me', { headers: { cookie: old } }), 401) // the old device is logged out
  assert.equal(await status('/auth/login', json({ email: 'noor@comoonly.test', password: 'comoonly-demo' })), 401)
  assert.equal(await status('/auth/login', json({ email: 'noor@comoonly.test', password: 'brand-new-pass' })), 200)
  assert.equal((await reset(code)).status, 400) // a code works once
  config.email.user = ''
})

test('without email set up, people get straight in; admin emails still need the code', async () => {
  const signup = await fetch(
    `${base}/auth/signup`,
    json({ name: 'Bea', email: 'bea@example.com', password: 'longenough' }),
  )
  assert.equal(signup.status, 201)
  assert.ok(signup.headers.get('set-cookie'))
  config.adminEmails.push('boss@example.com')
  assert.equal(
    await status('/auth/signup', json({ name: 'X', email: 'boss@example.com', password: 'longenough' })),
    202,
  )
  config.adminEmails.pop()
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

  // Socials: a pasted link or @name becomes just the username; anything else is refused.
  const socials = { ...profile, instagram: 'https://www.instagram.com/hira.makes/?hl=en', tiktok: '@hira_s' }
  const withSocials = await (await fetch(`${base}/users/me`, json(socials, hira, 'PATCH'))).json()
  assert.deepEqual([withSocials.instagram, withSocials.tiktok], ['hira.makes', 'hira_s'])
  assert.equal(await status('/users/me', json({ ...profile, instagram: 'javascript:alert(1)' }, hira, 'PATCH')), 400)
  const shown = await get('/users/hira', await loginAs('zain'))
  assert.deepEqual([shown.instagram, typeof shown.joinedAt, typeof shown.events], ['hira.makes', 'number', 'number'])
})

test('email goes through the Gmail relay when it is set up, with its secret', async () => {
  let got: any
  const relay = createServer((req, res) => {
    let body = ''
    req
      .on('data', (c) => (body += c))
      .on('end', () => {
        got = JSON.parse(body)
        res.end(got.secret === 's3cret' ? 'ok' : 'wrong secret')
      })
  }).listen(0)
  const port = (relay.address() as { port: number }).port
  Object.assign(config.email, { relayUrl: `http://localhost:${port}`, relaySecret: 's3cret' })
  try {
    await sendEmail('a@b.test', 'Hi', 'Body')
    assert.deepEqual(got, { secret: 's3cret', to: 'a@b.test', subject: 'Hi', text: 'Body' })
    config.email.relaySecret = 'nope'
    await assert.rejects(sendEmail('a@b.test', 'Hi', 'Body'), /wrong secret/) // a failed send is an error, not silence
  } finally {
    Object.assign(config.email, { relayUrl: '', relaySecret: '' })
    relay.close()
  }
})
