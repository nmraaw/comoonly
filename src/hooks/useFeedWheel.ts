import { useEffect, useRef } from 'react'

// The header above the feed is fixed, so forward mouse-wheel scrolling anywhere on the page to the feed.
export function useFeedWheel() {
  const feed = useRef<HTMLDivElement>(null)
  useEffect(() => {
    function wheel(event: WheelEvent) {
      const el = feed.current
      const target = event.target as HTMLElement
      if (
        !el ||
        el.contains(target) ||
        document.querySelector('dialog[open]') ||
        target.closest('input,textarea,select')
      )
        return
      if (event.ctrlKey || Math.abs(event.deltaX) > Math.abs(event.deltaY)) return
      event.preventDefault()
      el.scrollTop += event.deltaY * (event.deltaMode === 1 ? 16 : event.deltaMode === 2 ? el.clientHeight : 1)
    }
    window.addEventListener('wheel', wheel, { passive: false })
    return () => window.removeEventListener('wheel', wheel)
  }, [])
  return feed
}
