import { db, transaction } from './connection.ts'
import { hashPassword } from '../modules/auth/auth.service.ts'

// Same people and groups as the frontend mock (src/data), so the demo looks identical once hooked up.
// Every seed user logs in with email `<id>@comoonly.test` and this password.
const DEMO_PASSWORD = 'comoonly-demo'

const users = [
  { id: 'areeba', name: 'Areeba R.', city: 'Sialkot', tagline: 'Here for the music', bio: 'Making music, questionable coffee, and hopefully some good friends along the way.', interests: ['Making music', 'Films', 'Coffee', 'Creating'] },
  { id: 'hira', name: 'Hira S.', city: 'Online', tagline: 'Building small things', bio: 'Game ideas, playful experiments, and finishing one tiny project together.', interests: ['Games', 'Design', 'Tech'] },
  { id: 'sara', name: 'Sara M.', city: 'Sialkot', tagline: 'One story at a time', bio: 'Always up for a good film or a chapter worth talking about.', interests: ['Films', 'Reading', 'Coffee'] },
  { id: 'hamza', name: 'Hamza K.', city: 'Campus', tagline: 'Sketchbook always nearby', bio: 'Weekend walks and imperfect drawings. Come make something with us.', interests: ['Drawing', 'Walking', 'Creative'] },
  { id: 'noor', name: 'Noor A.', city: 'Sialkot', tagline: 'Coffee and a little creativity', bio: 'Looking for a relaxed afternoon of sketching and swapping ideas.', interests: ['Drawing', 'Coffee', 'Art'] },
  { id: 'nm', name: 'Noor M.', city: 'Sialkot', tagline: 'Trying something new', bio: 'A beginner who likes learning with good company.', interests: ['Music', 'Creating'] },
  { id: 'zain', name: 'Zain A.', city: 'Sialkot', tagline: 'Small plans, good people', bio: 'Here to collaborate, learn, and help a little idea become real.', interests: ['Music', 'Tech'] },
  { id: 'me', name: 'You', city: 'Sialkot', tagline: 'Your little corner', bio: 'Making music, questionable coffee, and hopefully some good friends along the way.', interests: ['Making music', 'Films', 'Coffee', 'Creating'] },
]

// members/spots match the mock; `withMe` = the demo user ('me') is already in that group.
const groups = [
  { id: 'bedroom-musicians', owner: 'areeba', name: 'Bedroom musicians', title: 'Bedroom musicians, let’s make a band.', category: 'Music', description: 'Guitarist looking for a singer & a drummer. Beginners very welcome.', members: 4, spots: 2, location: 'Sialkot', mode: 'In person', color: 'lilac', withMe: false },
  { id: 'tiny-game', owner: 'hira', name: 'Tiny game club', title: 'Small game. Big ideas.', category: 'Tech', description: 'Let’s build a tiny game together. Bring your ideas, curiosity, and whatever skills you have.', members: 5, spots: 3, location: 'Online', mode: 'Online', color: 'mint', withMe: true },
  { id: 'film-club', owner: 'sara', name: 'The little film club', title: 'A cozy little film club?', category: 'Film', description: 'One film, a little popcorn, and a conversation that goes somewhere.', members: 3, spots: 4, location: 'Sialkot', mode: 'In person', color: 'pink', withMe: false },
  { id: 'sketch-walks', owner: 'hamza', name: 'Sketchbook walks', title: 'Weekend sketchbook walks', category: 'Creative', description: 'Take your sketchbook outside. No perfect drawings required.', members: 4, spots: 5, location: 'Campus', mode: 'In person', color: 'lilac', withMe: false },
  { id: 'one-chapter', owner: 'sara', name: 'The one-chapter club', title: 'One chapter. A good conversation.', category: 'Reading', description: 'A small reading circle for people who love stories. One chapter at a time.', members: 6, spots: 2, location: 'Online', mode: 'Online', color: 'pink', withMe: true },
  { id: 'sunday-sketch', owner: 'noor', name: 'Sunday sketch & coffee', title: 'A sketchbook and a cup of coffee.', category: 'Creative', description: 'A few people to sketch, swap ideas and drink a questionable amount of coffee.', members: 6, spots: 3, location: 'Sialkot', mode: 'In person', color: 'mint', withMe: true },
]

// Only fills an empty database, so restarting the server never duplicates or overwrites real data.
export function seedIfEmpty() {
  if (db.prepare('SELECT 1 FROM users LIMIT 1').get()) return
  const hash = hashPassword(DEMO_PASSWORD) // hashed once and shared, to keep startup fast
  const now = Date.now()
  transaction(() => {
    const addUser = db.prepare(
      'INSERT INTO users (id, name, email, password_hash, city, tagline, bio, interests, created_at) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)',
    )
    for (const u of users) {
      addUser.run(u.id, u.name, `${u.id}@comoonly.test`, hash, u.city, u.tagline, u.bio, JSON.stringify(u.interests), now)
    }
    const addGroup = db.prepare(
      `INSERT INTO groups (id, owner_id, name, title, description, category, mode, location, capacity, color, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
    )
    const addMember = db.prepare('INSERT INTO group_members (group_id, user_id) VALUES (?, ?)')
    groups.forEach((g, i) => {
      // Spaced a second apart so "newest" keeps the mock's order.
      addGroup.run(g.id, g.owner, g.name, g.title, g.description, g.category, g.mode, g.location,
        g.members + g.spots, g.color, now - i * 1000)
      const others = users.map((u) => u.id).filter((id) => id !== g.owner && id !== 'me')
      const members = [g.owner, ...(g.withMe ? ['me'] : []), ...others].slice(0, g.members)
      for (const userId of members) addMember.run(g.id, userId)
    })
  })
  console.log('Seeded demo data')
}
