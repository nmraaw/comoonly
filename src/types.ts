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
  hasPhoto: boolean // a photo or poster the host added
  eventId: string | null // an event's everyone-going group or crew: that event
  eventTitle: string | null
  pinned: string // the plan pinned at the top of the chat, e.g. "Meet at Gate 2, 5:45"
  project: Project | null // set for the Idea Graveyard's unfinished projects
}

// An unfinished project: how far it got, why it stopped, what it needs (labels in src/projects.ts).
export type Project = {
  stage: 'idea' | 'sketches' | 'prototype' | 'almost'
  stopped: 'time' | 'skills' | 'teammates' | 'money' | 'other'
  story: string
  needs: string[]
  status: 'resting' | 'reviving' | 'alive'
  freeToAdopt: boolean
  startedById: string | null // whoever first posted it, kept after someone adopts it
  startedBy: string | null
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
  instagram: string // username only, '' if not added
  tiktok: string
  joinedAt?: number // on other people's profiles: when they joined, and how many events they've gone to
  events?: number
  showedUp?: { showed: number; crews: number } // tapped "I'm here" for their crew, of how many crews
  connection?: 'pending' | 'incoming' | 'accepted' | null
  blocked?: boolean // you blocked this person
}

// The logged-in person (GET /api/auth/me).
export type Me = User & { email: string; isAdmin: boolean; gender: Gender }
export type Gender = '' | 'woman' | 'man' | 'private'

// `voice`: a voice message; its recording plays from /api/voice/:id. `poll`: its choices, with everyone's votes.
export type Message = {
  id: string
  authorId: string
  author: string
  text: string
  createdAt: number
  voice: 0 | 1
  photo: 0 | 1 // a photo; it shows from /api/chat-photos/:id
  poll?: string[]
  votes?: { userId: string; choice: number }[]
}

// An event on the Events page or in the review queue (GET /api/events).
export type EventItem = {
  id: string
  title: string
  date: string
  deadline: string
  price: number | null // cheapest ticket in rupees: 0 = free, null = not stated
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
export type ProfileInput = Omit<User, 'id' | 'connection' | 'blocked' | 'verified' | 'joinedAt' | 'events'> & {
  gender: Gender
}
export type NewGroup = {
  name: string
  description: string
  category: string
  mode: string
  location: string
  spots: number
  project?: Pick<Project, 'stage' | 'stopped' | 'story' | 'needs' | 'freeToAdopt'> // an unfinished idea
}
