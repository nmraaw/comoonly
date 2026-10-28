import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useApp } from '../state/AppContext'
import type { Message } from '../types'
import { api, useApi } from '../api'
import Icon from './Icon'
import { Modal } from './UI'
import { shrink } from '../images'

// The 🎲 button drops one of these into a group chat, to get strangers talking.
const ICEBREAKERS = [
  'Most overrated food in your city?',
  'Chai or coffee, and how do you take it?',
  'What’s a song you’ve had on repeat this week?',
  'Mountains or beach?',
  'What’s something you’re weirdly good at?',
  'Best thing you’ve eaten this month?',
  'Early bird or night owl?',
  'What would you do with a free Saturday and no plans?',
  'A hobby you’ve always wanted to try?',
  'The last thing that made you laugh out loud?',
  'Your comfort movie or show?',
  'What’s the best event you’ve ever been to?',
  'If you could learn one skill overnight, what would it be?',
  'Biryani or karahi, and where’s the best one?',
  'Texting or voice notes?',
  'What’s on your bucket list for this year?',
]
// Spotify links in a chat: songs, albums, playlists and podcasts play right in the chat; a Jam invite
// (spotify.link/… or …/socialsession/…) becomes a "Join the Jam" button that opens Spotify.
const SPOTIFY =
  /https:\/\/open\.spotify\.com\/(?:intl-[a-z]+\/)?(track|album|playlist|episode|show|artist)\/([A-Za-z0-9]+)/
const JAM = /https:\/\/(?:spotify\.link\/[A-Za-z0-9]+|open\.spotify\.com\/socialsession\/[A-Za-z0-9-]+)\S*/
function Spotify({ text }: { text: string }) {
  const jam = text.match(JAM)
  if (jam)
    return (
      <a className="button lime jam" href={jam[0]} target="_blank" rel="noopener noreferrer">
        🎧 Join the Jam on Spotify ↗
      </a>
    )
  const [, type, id] = text.match(SPOTIFY)!
  return (
    <iframe
      className="spotify"
      title="Spotify player"
      src={`https://open.spotify.com/embed/${type}/${id}`}
      height={type === 'track' || type === 'episode' ? 80 : 152}
      allow="encrypted-media"
      loading="lazy"
    />
  )
}
const isSpotify = (text: string) => SPOTIFY.test(text) || JAM.test(text)

const randomIcebreaker = () => '🎲 ' + ICEBREAKERS[Math.floor(Math.random() * ICEBREAKERS.length)]

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
  const group = path.startsWith('/groups/') // polls and icebreakers are for group chats
  const [polling, setPolling] = useState(false)
  const [tray, setTray] = useState(false) // the ＋ menu: photo, music, poll, icebreaker
  const [music, setMusic] = useState(false)
  const icebreaker = () => send(randomIcebreaker())

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

  async function sendPhoto(file: File) {
    setSending(true)
    try {
      await api(path + '/photo', { method: 'POST', body: { image: await shrink(file) } })
      reload()
      onSent?.()
    } catch (err) {
      alert((err as Error).message)
    } finally {
      setSending(false)
    }
  }
  async function vote(messageId: string, choice: number) {
    await api('/messages/' + messageId + '/vote', { method: 'POST', body: { choice } }).catch((err) =>
      alert(err.message),
    )
    reload()
  }
  async function poll(form: HTMLFormElement) {
    const data = new FormData(form)
    const options = data
      .getAll('option')
      .map(String)
      .filter((o) => o.trim())
    try {
      await api(path.replace(/messages$/, 'polls'), {
        method: 'POST',
        body: { question: data.get('question'), options },
      })
      setPolling(false)
      reload()
    } catch (err) {
      alert((err as Error).message)
    }
  }

  async function send(text = draft) {
    setSending(true)
    try {
      await api(path, { method: 'POST', body: { text } })
      if (text === draft) setDraft('')
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
        {data &&
          !items.length &&
          (group ? (
            <div className="break-ice">
              <span aria-hidden="true">🎲</span>
              <p>Not sure what to say first? Nobody is.</p>
              <button className="button lime" disabled={sending} onClick={icebreaker}>
                Break the ice
              </button>
            </div>
          ) : (
            <p className="empty">Start with a little hello.</p>
          ))}
        {items.map((message) => (
          <div key={message.id} className={'bubble ' + (message.authorId === me!.id ? 'outgoing' : '')}>
            <strong>
              {message.authorId === me!.id ? 'You' : message.author} ·{' '}
              {new Date(message.createdAt).toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' })}
            </strong>
            {message.voice ? (
              <audio controls preload="none" src={'/api/voice/' + message.id} />
            ) : message.photo ? (
              <img className="chat-photo" src={'/api/chat-photos/' + message.id} alt="Photo" loading="lazy" />
            ) : (
              <p className={message.text.startsWith('🎲') ? 'icebreaker' : undefined}>{message.text}</p>
            )}
            {isSpotify(message.text) && <Spotify text={message.text} />}
            {message.poll && (
              <div className="poll" role="group" aria-label="Poll choices">
                {message.poll.map((option, i) => {
                  const votes = message.votes!.filter((v) => v.choice === i).length
                  const mine = message.votes!.some((v) => v.choice === i && v.userId === me!.id)
                  return (
                    <button
                      key={i}
                      className={mine ? 'selected' : ''}
                      aria-pressed={mine}
                      onClick={() => vote(message.id, i)}
                    >
                      <span>{option}</span>
                      <strong>{votes}</strong>
                    </button>
                  )
                })}
              </div>
            )}
          </div>
        ))}
      </div>
      {tray && !recorder && (
        <div className="chat-tray" role="group" aria-label="Add to the chat">
          <label>
            <span aria-hidden="true">📷</span>
            Photo
            <input
              type="file"
              accept="image/png,image/jpeg,image/webp"
              hidden
              disabled={sending}
              onChange={(e) => {
                const file = e.target.files?.[0]
                e.target.value = ''
                setTray(false)
                if (file) sendPhoto(file)
              }}
            />
          </label>
          <button type="button" onClick={() => (setTray(false), setMusic(true))}>
            <span aria-hidden="true">🎵</span>
            Music
          </button>
          {group && (
            <>
              <button type="button" onClick={() => (setTray(false), setPolling(true))}>
                <span aria-hidden="true">📊</span>
                Poll
              </button>
              <button type="button" disabled={sending} onClick={() => (setTray(false), icebreaker())}>
                <span aria-hidden="true">🎲</span>
                Icebreaker
              </button>
            </>
          )}
        </div>
      )}
      {music && (
        <Modal title="Listen together" onClose={() => setMusic(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              const link = String(new FormData(e.currentTarget).get('link')).trim()
              if (!isSpotify(link)) return alert('Paste a link from Spotify (open.spotify.com or spotify.link).')
              setMusic(false)
              send('🎵 ' + link)
            }}
          >
            <p>
              Share a song or playlist, or start a <strong>Jam</strong> so everyone can add songs and listen at the same
              time: in Spotify, play something, tap the speaker icon → <strong>Start a Jam</strong> → Share link.
            </p>
            <label>
              Spotify link
              <input name="link" required placeholder="https://open.spotify.com/track/… or spotify.link/…" />
            </label>
            <button className="button primary">Share →</button>
          </form>
        </Modal>
      )}
      {polling && (
        <Modal title="Ask the group" onClose={() => setPolling(false)}>
          <form onSubmit={(e) => (e.preventDefault(), poll(e.currentTarget))}>
            <label>
              Question
              <input name="question" required maxLength={200} placeholder="Where do we meet?" />
            </label>
            {[0, 1, 2, 3].map((i) => (
              <label key={i}>
                Choice {i + 1}
                {i > 1 && ' (optional)'}
                <input name="option" required={i < 2} maxLength={60} />
              </label>
            ))}
            <button className="button primary">Send poll →</button>
          </form>
        </Modal>
      )}
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
          <button
            type="button"
            className={'tray-toggle' + (tray ? ' open' : '')}
            aria-label={tray ? 'Close the menu' : 'Add a photo, poll or icebreaker'}
            aria-expanded={tray}
            onClick={() => setTray((t) => !t)}
          >
            ＋
          </button>
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
