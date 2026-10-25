import type { Activity } from './types'
import type { CalendarProps } from './components/AddToCalendar'

// What the calendar buttons need to know about an activity.
export const activityCalendar = (a: Activity): CalendarProps => ({
  title: a.title,
  date: a.date,
  place: a.place,
  details: [a.plan, a.notes].filter(Boolean).join('\n\n'),
  ics: `/activities/${a.id}/calendar.ics`,
})
