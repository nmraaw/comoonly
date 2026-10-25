// "Add to calendar": one event as an .ics file. iPhone, Mac, Outlook and most Android calendars open it
// and offer to save it. Websites can't write to someone's calendar directly, so this is the web's way.
type CalendarEvent = { id: string; title: string; date: string; place: string; details: string }

// Dates are stored as Pakistan local time ('2026-11-02' or '2026-11-02T18:00'); calendars want UTC.
const utc = (date: string) =>
  new Date(/(Z|[+-]\d\d:?\d\d)$/.test(date) ? date : date + '+05:00').toISOString().replace(/[-:]|\.\d+/g, '')

const text = (s: string) => s.replace(/[\\;,]/g, (c) => '\\' + c).replace(/\r?\n/g, '\\n')

// shortcut: long lines aren't folded at 75 characters as the spec asks; every calendar we tried reads them anyway.
export function icsFile(e: CalendarEvent) {
  const allDay = e.date.length === 10
  const day = e.date.replace(/-/g, '')
  return [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Comoonly//EN',
    'BEGIN:VEVENT',
    `UID:${e.id}@comoonly`,
    `DTSTAMP:${utc(new Date().toISOString())}`,
    allDay ? `DTSTART;VALUE=DATE:${day}` : `DTSTART:${utc(e.date)}`,
    allDay ? 'DURATION:P1D' : 'DURATION:PT2H', // we don't know when events end
    `SUMMARY:${text(e.title)}`,
    `LOCATION:${text(e.place)}`,
    `DESCRIPTION:${text(e.details)}`,
    'END:VEVENT',
    'END:VCALENDAR',
    '',
  ].join('\r\n')
}

export function sendIcs(res: any, e: CalendarEvent) {
  res.type('text/calendar').set('content-disposition', 'inline; filename="comoonly.ics"').send(icsFile(e))
}
