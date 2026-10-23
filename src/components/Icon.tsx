export default function Icon({ name }: { name: string }) {
  const paths: Record<string, string> = {
    Discover: 'm3 10 9-7 9 7 M5 9v12h14V9 M9 21v-8h6v8',
    Groups:
      'M16 21v-3a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v3 M9 10a4 4 0 1 0 0-8 4 4 0 0 0 0 8 M17 3a4 4 0 0 1 0 8 M22 21v-3a4 4 0 0 0-3-4',
    Create: 'M12 3v18 M3 12h18',
    Messages: 'M21 11a9 9 0 0 1-9 9 10 10 0 0 1-4-1l-6 3 2-6a9 9 0 1 1 17-5',
    Me: 'M4 22v-3a8 8 0 0 1 16 0v3 M12 11a5 5 0 1 0 0-10 5 5 0 0 0 0 10',
    search: 'M10 17a7 7 0 1 0 0-14 7 7 0 0 0 0 14 M15 15l6 6',
    filter: 'M3 5h6 M15 5h6 M3 12h6 M15 12h6 M3 19h6 M15 19h6',
    back: 'm15 4-8 8 8 8',
    send: 'm3 3 19 9-19 9 4-9-4-9 M7 12h15',
    save: 'M6 3h12v19l-6-4-6 4z',
    close: 'm5 5 14 14 M19 5 5 19',
    bell: 'M6 8a6 6 0 1 1 12 0c0 7 3 9 3 9H3s3-2 3-9 M10 21a2 2 0 0 0 4 0',
    clock: 'M12 21a9 9 0 1 0 0-18 9 9 0 0 0 0 18 M12 7v5l3 2',
    pin: 'M12 21s-7-6.2-7-11a7 7 0 0 1 14 0c0 4.8-7 11-7 11z M12 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5',
    calendar: 'M4 6h16v15H4z M4 10h16 M8 3v4 M16 3v4',
  }
  return (
    <svg
      width="22"
      height="22"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.7"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d={paths[name] || paths.Create} />
    </svg>
  )
}
