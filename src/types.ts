// The shapes of data the app gets from the backend (see server/src/modules/* for where each comes from).

// A group card (GET /api/groups). Open spots are worked out by the server from capacity − members.
export type Group = {
  id: string
  name: string
  title: string
  category: string
  description: string
  members: number
  spots: number
  location: string
  mode: string
  owner: string
  ownerId: string
  initials: string
  color: string
  forEvent: boolean // an event's "everyone going" group or a crew: reached from the event, not listed on Discover
  crewFor: string | null // a crew: the id of the event it's going to
  womenOnly: boolean
}

// A person (GET /api/users/:id). `connection` is how you're linked to them:
// 'pending' = you asked, 'incoming' = they asked you, 'accepted' = connected, null = not yet.
export type User = {
  id: string
  name: string
  city: string
  tagline: string
  bio: string
  interests: string[]
  verified: boolean // email confirmed and profile filled in: can start and join crews
  connection?: 'pending' | 'incoming' | 'accepted' | null
  blocked?: boolean // you blocked this person
}

// The logged-in person (GET /api/auth/me).
export type Me = User & { email: string; isAdmin: boolean; gender: Gender }
export type Gender = '' | 'woman' | 'man' | 'private'

export type Message = { id: string; authorId: string; author: string; text: string; createdAt: number }
export type Activity = {
  id: string
  groupId: string
  title: string
  date: string
  place: string
  plan: string
  notes: string
  going: boolean
  goingCount: number
}

// An event on the Events page or in the review queue (GET /api/events).
export type EventItem = {
  id: string
  title: string
  date: string
  deadline: string
  suggestedBy: string | null
  city: string
  mode: string
  category: string
  description: string
  registerUrl: string
  sourceUrl: string
  groupId: string | null
  goingCount: number
  hasPoster: 0 | 1
  myIntent?: Intent | null // how you're going, if you are
}

// How someone is going to an event. Company and meet put you in the everyone-going group chat.
export type Intent = 'company' | 'meet' | 'friends'

// A small group going to one event together (GET /api/events/:id/crews).
export type Crew = {
  id: string
  plan: string // where and when they'll meet
  area: string // where they're coming from
  size: number
  members: number
  womenOnly: boolean
  owner: string
  ownerId: string
  myStatus: 'pending' | 'joined' | 'declined' | null
}

export type Status = 'pending' | 'joined' // your membership of a group
export type ProfileInput = Omit<User, 'id' | 'connection' | 'blocked' | 'verified'> & { gender: Gender }
export type NewGroup = {
  name: string
  description: string
  category: string
  mode: string
  location: string
  spots: number
}
