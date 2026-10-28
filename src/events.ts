import type { EventItem } from './types'
import type { CalendarProps } from './components/AddToCalendar'

// How an event's date reads everywhere: "Sat 14 Nov, 16:00" (the year only when it isn't this year).
export const eventWhen = (e: EventItem) =>
  new Date(e.date).toLocaleString('en-GB', {
    weekday: 'short',
    day: 'numeric',
    month: 'short',
    ...(e.date.slice(0, 4) !== String(new Date().getFullYear()) && { year: 'numeric' }),
    ...(e.date.length > 10 && { hour: '2-digit', minute: '2-digit' }),
  })

export const eventPlace = (e: EventItem) =>
  [e.mode === 'In person' ? '' : e.mode, e.city].filter(Boolean).join(' · ') || 'In person'

export const eventCalendar = (e: EventItem): CalendarProps => ({
  title: e.title,
  date: e.date,
  place: e.mode === 'Online' ? 'Online' : e.city,
  details: `${e.description}\n\nRegister: ${e.registerUrl}`.trim(),
  ics: `/events/${e.id}/calendar.ics`,
})

// "Today", "Tomorrow", "In 5 days": a nudge that it's coming up.
export function eventCountdown(e: EventItem) {
  const day = (d: Date) => Date.UTC(d.getFullYear(), d.getMonth(), d.getDate())
  const days = Math.round((day(new Date(e.date)) - day(new Date())) / 86_400_000)
  if (days <= 0) return 'Today'
  if (days === 1) return 'Tomorrow'
  return days < 60 ? `In ${days} days` : ''
}

// "Free", "Rs 2,200", or "" when the post doesn't say.
export const eventPrice = (e: EventItem) =>
  e.price === null ? '' : e.price ? `Rs ${e.price.toLocaleString('en-US')}` : 'Free'
