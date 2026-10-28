import type { EventItem, Group, Me } from './types'

// The interests offered on profiles and communities. People can also add their own ("Other").
export const INTERESTS = [
  'Music',
  'Creative',
  'Tech',
  'Film',
  'Reading',
  'Games',
  'Drawing',
  'Coffee',
  'Walking',
  'Design',
  'Sports',
  'Food',
  'Hackathons',
  'Workshops',
  'Competitions',
  'Meetups',
]

const same = (a: string, b: string) => Boolean(a) && a.toLowerCase() === b.toLowerCase()

// "Hackathons" matches a Hackathon; "Music" matches an event that mentions music (like the server's notices).
export function aboutInterest(interest: string, e: EventItem) {
  const word = interest.toLowerCase().replace(/s$/, '')
  if (word === e.category.toLowerCase()) return true
  return new RegExp(`\\b${word.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}`, 'i').test(`${e.title} ${e.description}`)
}

export const eventInterest = (me: Me, e: EventItem) => me.interests.find((interest) => aboutInterest(interest, e))

// Why something on Discover is for you, e.g. "You like Drawing · Lahore". Empty when it isn't.
export function whyForYou(me: Me, item: { group: Group } | { event: EventItem }) {
  const [interest, near] =
    'group' in item
      ? [me.interests.find((i) => same(i, item.group.category)), same(me.city, item.group.location)]
      : [eventInterest(me, item.event), same(me.city, item.event.city)]
  if (!interest) return ''
  return `You like ${interest}` + (near ? ` · ${me.city}` : '')
}

// For sorting "For you": an interest counts most, being in your city next.
export function fit(me: Me, item: { group: Group } | { event: EventItem }) {
  const city = 'group' in item ? item.group.location : item.event.city
  return (whyForYou(me, item) ? 2 : 0) + (same(me.city, city) ? 1 : 0)
}
