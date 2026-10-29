import { useEffect, useState } from 'react'
import type { EventItem, Group, Message } from '../types'
import { api } from '../api'
import { eventWhen } from '../events'
import { Modal } from './UI'

// After the event: a crew's photos from its chat become one story-sized picture (1080×1920),
// "4 strangers → 1 crew 🫶", to share on Instagram. Drawn in the browser, nothing is uploaded.
export default function MemoryCard({
  group,
  event,
  people,
  onClose,
}: {
  group: Group
  event: EventItem
  people: { name: string }[]
  onClose: () => void
}) {
  const [card, setCard] = useState<{ url: string; file: File }>()
  const [error, setError] = useState('')
  useEffect(() => {
    let url = ''
    draw(
      group,
      event,
      people.map((p) => p.name),
    )
      .then((file) => {
        url = URL.createObjectURL(file)
        setCard({ url, file })
      })
      .catch(() => setError('Couldn’t make the card. Try again in a moment.'))
    return () => URL.revokeObjectURL(url)
  }, [group, event, people])
  async function share() {
    if (navigator.canShare?.({ files: [card!.file] })) {
      await navigator.share({ files: [card!.file], text: `${event.title} with my Comoonly crew 🫶` }).catch(() => {})
    } else {
      const a = document.createElement('a') // computers: download it instead
      a.href = card!.url
      a.download = card!.file.name
      a.click()
    }
  }
  return (
    <Modal title="Your memory card" onClose={onClose}>
      {error && <p className="notice pink">{error}</p>}
      {!card && !error && <p role="status">Making your card…</p>}
      {card && (
        <>
          <img className="memory-card" src={card.url} alt={`Memory card for ${event.title}`} />
          <button className="button lime" onClick={share}>
            Share to your story →
          </button>
        </>
      )}
    </Modal>
  )
}

const W = 1080
const H = 1920

async function draw(group: Group, event: EventItem, names: string[]) {
  const messages = await api<Message[]>('/groups/' + group.id + '/messages')
  const photos = await Promise.all(
    messages
      .filter((m) => m.photo)
      .slice(-4) // the latest four
      .map((m) =>
        fetch('/api/chat-photos/' + m.id)
          .then((r) => r.blob())
          .then((b) => createImageBitmap(b)),
      ),
  )
  await document.fonts.ready
  const canvas = document.createElement('canvas')
  canvas.width = W
  canvas.height = H
  const c = canvas.getContext('2d')!
  const bg = c.createLinearGradient(0, 0, W, H)
  bg.addColorStop(0, '#e3f58d')
  bg.addColorStop(1, '#d8c9ef')
  c.fillStyle = bg
  c.fillRect(0, 0, W, H)
  c.fillStyle = '#29233c'
  c.font = '800 64px "Bricolage Grotesque", sans-serif'
  c.fillText('comoonly', 60, 130)
  c.font = '700 32px "DM Sans", sans-serif'
  c.fillText('MEMORY CARD', 760, 125)

  // Photos: one big, two stacked, one over two, or a 2×2 grid. No photos: a big emoji.
  const [x, y, w, h, gap] = [60, 200, W - 120, 1000, 16]
  const half = (h - gap) / 2
  const slots = [
    [[x, y, w, h]],
    [
      [x, y, w, half],
      [x, y + half + gap, w, half],
    ],
    [
      [x, y, w, half],
      [x, y + half + gap, (w - gap) / 2, half],
      [x + (w + gap) / 2, y + half + gap, (w - gap) / 2, half],
    ],
    [
      [x, y, (w - gap) / 2, half],
      [x + (w + gap) / 2, y, (w - gap) / 2, half],
      [x, y + half + gap, (w - gap) / 2, half],
      [x + (w + gap) / 2, y + half + gap, (w - gap) / 2, half],
    ],
  ][photos.length - 1]
  if (!slots) {
    c.fillStyle = 'rgba(255,255,255,0.6)'
    c.beginPath()
    c.roundRect(x, y, w, h, 40)
    c.fill()
    c.font = '300px sans-serif'
    c.textAlign = 'center'
    c.fillText('🫶', W / 2, y + h / 2 + 100)
    c.textAlign = 'left'
  }
  slots?.forEach(([sx, sy, sw, sh], i) => {
    const img = photos[i]
    const scale = Math.max(sw / img.width, sh / img.height) // fill the slot, crop the rest
    const [dw, dh] = [img.width * scale, img.height * scale]
    c.save()
    c.beginPath()
    c.roundRect(sx, sy, sw, sh, 40)
    c.clip()
    c.drawImage(img, sx + (sw - dw) / 2, sy + (sh - dh) / 2, dw, dh)
    c.restore()
  })

  // The words: what, when, who.
  c.fillStyle = '#29233c'
  let line = 1300
  c.font = '800 72px "Bricolage Grotesque", sans-serif'
  for (const text of wrap(c, event.title, w).slice(0, 2)) {
    c.fillText(text, x, line)
    line += 84
  }
  c.font = '500 40px "DM Sans", sans-serif'
  c.fillText(eventWhen(event) + (event.city ? ` · ${event.city}` : ''), x, line)
  line += 110
  c.font = '800 60px "Bricolage Grotesque", sans-serif'
  c.fillText(names.length > 1 ? `${names.length} strangers → 1 crew 🫶` : 'Went together 🫶', x, line)
  line += 70
  c.font = '500 40px "DM Sans", sans-serif'
  for (const text of wrap(c, names.map((n) => n.split(' ')[0]).join(' · '), w).slice(0, 2)) {
    c.fillText(text, x, line)
    line += 52
  }
  c.font = '700 34px "DM Sans", sans-serif'
  c.fillText('Find your people on Comoonly', x, H - 80)

  const blob = await new Promise<Blob>((done) => canvas.toBlob((b) => done(b!), 'image/jpeg', 0.9))
  return new File([blob], 'comoonly-memory.jpg', { type: 'image/jpeg' })
}

// Splits text into lines that fit `width` at the current font.
function wrap(c: CanvasRenderingContext2D, text: string, width: number) {
  const lines: string[] = []
  let current = ''
  for (const word of text.split(' ')) {
    const next = current ? current + ' ' + word : word
    if (current && c.measureText(next).width > width) {
      lines.push(current)
      current = word
    } else current = next
  }
  return current ? [...lines, current] : lines
}
