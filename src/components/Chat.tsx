import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import type { Message } from '../types'
import { api, useApi } from '../api'
import Icon from './Icon'

// One conversation: a group chat (/groups/:id/messages) or a private one (/messages/with/:userId).
// `onSent`: the page can refresh around the chat (e.g. a message request just became a chat).
export default function Chat({ path, onSent }: { path: string; onSent?: () => void }) {
  const { me } = useApp()
  const { data, error, reload } = useApi<Message[]>(path, 4000)
  const [draft, setDraft] = useState('')
  const [sending, setSending] = useState(false)
  const list = useRef<HTMLDivElement>(null)
  const composer = useRef<HTMLFormElement>(null)
  const previousCount = useRef<number | null>(null)
  const items = data || []

  useLayoutEffect(() => {
    const history = list.current
    if (history) history.scrollTop = history.scrollHeight
    // If the surrounding group page also overflows, keep the input and newest bubble in view.
    if (previousCount.current !== null && items.length > previousCount.current) {
      composer.current?.scrollIntoView({ block: 'nearest', behavior: 'instant' })
    }
    previousCount.current = items.length
  }, [path, items.length])

  // Voice messages: tap the mic to record, then send or cancel. At most 2 minutes.
  const [recorder, setRecorder] = useState<MediaRecorder | null>(null)
  const [seconds, setSeconds] = useState(0)
  const keep = useRef(true) // false when the recording was cancelled
  useEffect(() => {
    if (!recorder) return
    const started = Date.now()
    const timer = setInterval(() => {
      const s = Math.floor((Date.now() - started) / 1000)
      setSeconds(s)
      if (s >= 120) recorder.stop()
    }, 250)
    return () => clearInterval(timer)
  }, [recorder])
  async function record() {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const type = ['audio/webm', 'audio/mp4', 'audio/ogg'].find((t) => MediaRecorder.isTypeSupported(t))
      const r = new MediaRecorder(stream, type ? { mimeType: type } : undefined)
      const chunks: Blob[] = []
      r.ondataavailable = (e) => chunks.push(e.data)
      r.onstop = () => {
        stream.getTracks().forEach((t) => t.stop()) // the mic light goes off
        setRecorder(null)
        if (keep.current) sendVoice(new Blob(chunks, { type: r.mimeType }))
      }
      keep.current = true
      setSeconds(0)
      r.start()
      setRecorder(r)
    } catch {
      alert('To send voice messages, allow the microphone for this site.')
    }
  }
  async function sendVoice(blob: Blob) {
    setSending(true)
    try {
      const audio = await new Promise<string>((done) => {
        const reader = new FileReader()
        reader.onload = () => done(String(reader.result))
        reader.readAsDataURL(blob)
      })
      await api(path + '/voice', { method: 'POST', body: { audio } })
      reload()
      onSent?.()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setSending(false)
    }
  }

  async function send() {
    setSending(true)
    try {
      await api(path, { method: 'POST', body: { text: draft } })
      setDraft('')
      reload()
      onSent?.()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      // the draft stays, so nothing typed is lost
      setSending(false)
    }
  }

  return (
    <div className="chat">
      <div className="chat-history" ref={list} role="log" aria-label="Conversation" aria-live="polite">
        {error && <p className="empty">{error}</p>}
        {data && !items.length && <p className="empty">Start with a little hello.</p>}
        {items.map((message) => (
          <div key={message.id} className={'bubble ' + (message.authorId === me!.id ? 'outgoing' : '')}>
            <strong>
              {message.authorId === me!.id ? 'You' : message.author} ·{' '}
              {new Date(message.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </strong>
            {message.voice ? <audio controls preload="none" src={'/api/voice/' + message.id} /> : <p>{message.text}</p>}
          </div>
        ))}
      </div>
      {recorder ? (
        <div className="composer recording">
          <button
            type="button"
            aria-label="Cancel recording"
            onClick={() => {
              keep.current = false
              recorder.stop()
            }}
          >
            <Icon name="close" />
          </button>
          <span role="status">
            ● Recording {Math.floor(seconds / 60)}:{String(seconds % 60).padStart(2, '0')}
          </span>
          <button type="button" aria-label="Send voice message" onClick={() => recorder.stop()}>
            <Icon name="send" />
          </button>
        </div>
      ) : (
        <form
          ref={composer}
          className="composer"
          onSubmit={(event) => {
            event.preventDefault()
            if (draft.trim() && !sending) send()
          }}
        >
          <input
            aria-label="Message"
            placeholder={sending ? 'Sending…' : 'Say something nice…'}
            maxLength={1000}
            value={draft}
            onChange={(event) => setDraft(event.target.value)}
          />
          {draft.trim() ? (
            <button aria-label="Send message" disabled={sending}>
              <Icon name="send" />
            </button>
          ) : (
            <button type="button" aria-label="Record a voice message" disabled={sending} onClick={record}>
              <Icon name="mic" />
            </button>
          )}
        </form>
      )}
    </div>
  )
}
