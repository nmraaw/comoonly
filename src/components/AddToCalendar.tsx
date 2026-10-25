import { Modal } from './UI'

// "Add to calendar" for an event someone is going to. Websites can't write to a calendar
// themselves, so this offers the two ways that work everywhere: Google Calendar, and an .ics file
// that iPhone, Mac and Outlook open with their own "Add to calendar" screen.
export type CalendarProps = { title: string; date: string; place: string; details: string; ics: string }

// Dates are Pakistan local time ('2026-11-02' or '2026-11-02T18:00'); Google wants UTC for timed events.
const utc = (date: string, plusHours = 0) =>
  new Date(Date.parse(/(Z|[+-]\d\d:?\d\d)$/.test(date) ? date : date + '+05:00') + plusHours * 3_600_000)
    .toISOString()
    .replace(/[-:]|\.\d+/g, '')

function googleLink({ title, date, place, details }: CalendarProps) {
  const allDay = date.length === 10
  const nextDay = new Date(Date.parse(date) + 86_400_000).toISOString().slice(0, 10)
  const dates = allDay ? `${date.replace(/-/g, '')}/${nextDay.replace(/-/g, '')}` : `${utc(date)}/${utc(date, 2)}` // we don't know when it ends: 2 hours
  const q = new URLSearchParams({ action: 'TEMPLATE', text: title, dates, location: place, details })
  return 'https://calendar.google.com/calendar/render?' + q
}

function Links(props: CalendarProps) {
  return (
    <>
      <a className="button" href={googleLink(props)} target="_blank" rel="noopener noreferrer">
        Google Calendar ↗
      </a>
      <a className="button" href={'/api' + props.ics}>
        Apple / Outlook / other
      </a>
    </>
  )
}

// Always there on an event's page, for later.
export default function AddToCalendar(props: CalendarProps) {
  return (
    <div className="notice mint">
      <strong>Add it to your calendar</strong>
      <Links {...props} />
    </div>
  )
}

// Asked right after joining, the moment people are most likely to want it.
export function CalendarPopup({ onClose, ...props }: CalendarProps & { onClose: () => void }) {
  return (
    <Modal title="You’re in! Add it to your calendar?" onClose={onClose}>
      <p>So you don’t forget: {props.title}.</p>
      <Links {...props} />
      <button className="button primary" onClick={onClose}>
        Not now
      </button>
    </Modal>
  )
}
