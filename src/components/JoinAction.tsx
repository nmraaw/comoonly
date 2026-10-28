import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import { Modal } from './UI'
import { api } from '../api'
// `help`: an unfinished project in the Idea Graveyard, where joining means offering to help.
export default function JoinAction({ id, help }: { id: string; help?: boolean }) {
  const { membership, join, refresh } = useApp()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)
  const state = membership[id]
  async function submit(form: HTMLFormElement) {
    setBusy(true)
    setError('')
    try {
      await join(id, String(new FormData(form).get('intro')))
      setOpen(false)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }
  return (
    <>
      {state === 'joined' ? (
        <Link className="button primary" to={'/groups/' + id}>
          {help ? 'You’re helping · Open the project →' : 'Joined · Open community →'}
        </Link>
      ) : state === 'pending' ? (
        <>
          <div className="notice mint" role="status">
            {help
              ? 'Offer sent · The owner will get back to you.'
              : 'Pending · A hello in progress. The host will get back to you.'}
          </div>
          <button
            className="text-button"
            onClick={() =>
              api('/groups/' + id + '/leave', { method: 'POST' }).then(refresh, (err) => alert(err.message))
            }
          >
            Cancel request
          </button>
        </>
      ) : (
        <button className="button primary" onClick={() => setOpen(true)}>
          {help ? 'Offer to help →' : 'Request to join →'}
        </button>
      )}
      {open && (
        <Modal title={help ? 'How could you help?' : 'Say a little hello'} onClose={() => setOpen(false)}>
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit(e.currentTarget)
            }}
          >
            <label>
              {help ? 'What can you bring? Skills, time, ideas…' : 'What are you excited to bring?'}
              <textarea name="intro" required maxLength={300} />
            </label>
            <label className="check-row">
              <input type="checkbox" required /> I can keep things kind and respectful.
            </label>
            {error && (
              <p className="notice pink" role="alert">
                {error}
              </p>
            )}
            <button className="button primary" disabled={busy}>
              {busy ? 'Sending…' : help ? 'Send my offer →' : 'Send join request →'}
            </button>
          </form>
        </Modal>
      )}
    </>
  )
}
