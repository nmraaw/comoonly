import { useState } from 'react'
import { api, useApi } from '../api'
import { useApp } from '../state/AppContext'
import type { Group } from '../types'

type Member = { id: string; name: string; role: string; area: string }
type Costs = {
  expenses: { id: string; what: string; amount: number; payerId: string; payer: string }[]
  total: number
  settle: { from: string; to: string; amount: number }[]
}
const rupees = (n: number) => 'Rs ' + n.toLocaleString('en-US')

// A crew's practical side: who's coming from where (to share a ride), and splitting costs like Splitwise.
export default function CrewPlan({
  group,
  city,
  members,
  onArea,
}: {
  group: Group
  city: string
  members: Member[]
  onArea: () => void // reloads the members, with the area just saved
}) {
  const { me } = useApp()
  const costs = useApi<Costs>('/groups/' + group.id + '/expenses')
  const mine = members.find((m) => m.id === me!.id)
  const [area, setArea] = useState(mine?.area ?? '')
  const [error, setError] = useState('')
  const first = (m: Member) => (m.id === me!.id ? 'You' : m.name.split(' ')[0])
  // Members with the same area (ignoring capitals) can ride together.
  const areas = new Map<string, Member[]>()
  for (const m of members) {
    const key = m.area.trim().toLowerCase()
    if (key) areas.set(key, [...(areas.get(key) ?? []), m])
  }
  const unset = members.filter((m) => !m.area.trim())
  const meeting = group.pinned || group.description
  const directions = `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${meeting}, ${city}`)}`

  async function run(action: Promise<unknown>) {
    setError('')
    try {
      await action
      costs.reload()
      return true
    } catch (err) {
      setError((err as Error).message)
      return false
    }
  }
  return (
    <>
      <h2 className="section-title">🚗 Getting there</h2>
      <form
        className="add-interest"
        onSubmit={(e) => (
          e.preventDefault(),
          run(api('/groups/' + group.id + '/area', { method: 'PUT', body: { area } })).then(onArea)
        )}
      >
        <input
          aria-label="The area you’re coming from"
          placeholder="Your area, e.g. Gulshan"
          maxLength={60}
          value={area}
          onChange={(e) => setArea(e.target.value)}
        />
        <button className="button">Save</button>
      </form>
      <p className="hint">Just the area, never your address.</p>
      {[...areas.values()].map((people) => (
        <p className="notice" key={people[0].id}>
          📍 <strong>{people[0].area.trim()}</strong> ·{people.map(first).join(', ')}
          {people.length > 1 && <strong> · ride together 🚗</strong>}
        </p>
      ))}
      {!!unset.length && <p className="hint">Not set yet: {unset.map(first).join(', ')}</p>}
      <a className="button" href={directions} target="_blank" rel="noopener noreferrer">
        Directions in Google Maps ↗
      </a>

      <h2 className="section-title">💸 Split costs</h2>
      <form
        className="expense-form"
        onSubmit={(e) => {
          e.preventDefault()
          const form = e.currentTarget
          const data = new FormData(form)
          run(
            api('/groups/' + group.id + '/expenses', {
              method: 'POST',
              body: { what: data.get('what'), amount: data.get('amount') },
            }),
          ).then((ok) => ok && form.reset())
        }}
      >
        <input name="what" required maxLength={60} placeholder="Tickets, Careem…" aria-label="What you paid for" />
        <input name="amount" required type="number" min="1" placeholder="Rs" aria-label="How much, in rupees" />
        <button className="button lime">Add</button>
      </form>
      {error && (
        <p className="notice pink" role="alert">
          {error}
        </p>
      )}
      {costs.data?.expenses.map((x) => (
        <p className="expense" key={x.id}>
          <span>
            <strong>{x.what}</strong> · {x.payerId === me!.id ? 'you' : x.payer.split(' ')[0]} paid
          </span>
          <strong>{rupees(x.amount)}</strong>
          {x.payerId === me!.id && (
            <button
              className="text-button"
              aria-label={'Remove ' + x.what}
              onClick={() => run(api('/groups/' + group.id + '/expenses/' + x.id, { method: 'DELETE' }))}
            >
              ✕
            </button>
          )}
        </p>
      ))}
      {costs.data && !costs.data.expenses.length && <p className="hint">Add what you paid; it’s split equally.</p>}
      {!!costs.data?.settle.length && (
        <div className="notice mint">
          <strong>To be even ({rupees(Math.round(costs.data.total / members.length))} each):</strong>
          {costs.data.settle.map((s, i) => (
            <p key={i}>
              {s.from.split(' ')[0]} pays {s.to.split(' ')[0]} <strong>{rupees(s.amount)}</strong>
            </p>
          ))}
        </div>
      )}
    </>
  )
}
