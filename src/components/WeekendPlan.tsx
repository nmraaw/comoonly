import { useState } from 'react'
import { Link } from 'react-router-dom'
import { api } from '../api'
import type { EventItem } from '../types'
import { eventPrice, eventWhen } from '../events'
import { Modal } from './UI'

type Plan = { when: string; intro: string; picks: { event: EventItem; why: string }[] }

// "✨ Plan my weekend": one tap, a few events that fit you, each with why (server: events.weekend.ts).
export default function WeekendPlan() {
  const [plan, setPlan] = useState<Plan>()
  const [open, setOpen] = useState(false)
  const [error, setError] = useState('')
  async function ask() {
    setOpen(true)
    setPlan(undefined)
    setError('')
    try {
      setPlan(await api<Plan>('/events/weekend'))
    } catch (err) {
      setError((err as Error).message)
    }
  }
  return (
    <>
      <button className="weekend-button" onClick={ask}>
        <span aria-hidden="true">✨</span>
        <strong>Plan my weekend</strong>
        <small>Events that fit you, picked in a second</small>
      </button>
      {open && (
        <Modal title={plan ? `Your plan for ${plan.when}` : 'Planning your weekend…'} onClose={() => setOpen(false)}>
          {!plan && !error && <p role="status">Looking at what’s on and what you like…</p>}
          {error && <p className="notice pink">{error}</p>}
          {plan && !plan.picks.length && <p>Nothing on near you this week yet.</p>}
          {plan?.intro && <p>{plan.intro}</p>}
          <ol className="weekend-plan">
            {plan?.picks.map(({ event: e, why }) => (
              <li key={e.id}>
                <small>
                  <strong>{eventWhen(e)}</strong>
                  {eventPrice(e) && ` · ${eventPrice(e)}`}
                </small>
                <strong>{e.title}</strong>
                <p>{why}</p>
                <Link className="text-button" to={'/events/' + e.id} onClick={() => setOpen(false)}>
                  See event →
                </Link>
              </li>
            ))}
          </ol>
        </Modal>
      )}
    </>
  )
}
