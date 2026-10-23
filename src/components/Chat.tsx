import { useLayoutEffect, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import type { Message } from '../types'
import { api, useApi } from '../api'
import Icon from './Icon'

// One conversation: a group chat (/groups/:id/messages) or a private one (/messages/with/:userId).
export default function Chat({ path }: { path: string }) {
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

  async function send() {
    setSending(true)
    try {
      await api(path, { method: 'POST', body: { text: draft } })
      setDraft('')
      reload()
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
              {new Date(message.createdAt).toLocaleTimeString('en-GB', { hour: 'numeric', minute: '2-digit' })}
            </strong>
            <p>{message.text}</p>
          </div>
        ))}
      </div>
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
          placeholder="Say something nice…"
          maxLength={1000}
          value={draft}
          onChange={(event) => setDraft(event.target.value)}
        />
        <button aria-label="Send message" disabled={!draft.trim() || sending}>
          <Icon name="send" />
        </button>
      </form>
    </div>
  )
}
