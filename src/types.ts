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
  forEvent: boolean // an event's "go together" group: reached from the event, not listed on Discover
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
  connection?: 'pending' | 'incoming' | 'accepted' | null
  blocked?: boolean // you blocked this person
}

// The logged-in person (GET /api/auth/me).
export type Me = User & { email: string; isAdmin: boolean }

export type Message = { id: string; authorId: string; author: string; text: string; createdAt: number }
export type Task = { id: string; title: string; done: boolean }
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
}

export type Status = 'pending' | 'joined' // your membership of a group
export type ProfileInput = Omit<User, 'id' | 'connection' | 'blocked'>
export type NewGroup = {
  name: string
  description: string
  category: string
  mode: string
  location: string
  spots: number
}
