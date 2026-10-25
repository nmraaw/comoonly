import { useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import type { Activity, Task } from '../types'
import { Avatar, Chips, Empty, Mascot, Modal } from './UI'
import Chat from './Chat'
import DetailHeader from './DetailHeader'
import { api, useApi } from '../api'
import { CalendarPopup } from './AddToCalendar'
import { activityCalendar } from '../calendar'
const when = (date: string) => new Date(date).toLocaleString('en-GB', { dateStyle: 'medium', timeStyle: 'short' })
export default function GroupWorkspace({ id }: { id: string }) {
  const { me, groups, refresh } = useApp()
  const navigate = useNavigate()
  const [params, setParams] = useSearchParams()
  const tab = ['Chat', 'Activities', 'To-do', 'Members'].includes(params.get('tab') || '') ? params.get('tab')! : 'Chat'
  const [form, setForm] = useState<'task' | 'event' | null>(null)
  const [error, setError] = useState('')
  const [joinedActivity, setJoinedActivity] = useState<Activity>() // just joined: offer the calendar
  const group = groups.find((g) => g.id === id)
  const host = group?.ownerId === me!.id
  const members = useApi<{ id: string; name: string; role: string }[]>('/groups/' + id + '/members')
  const requests = useApi<{ id: string; name: string; city: string; intro: string }[]>(
    host ? '/groups/' + id + '/requests' : null,
  )
  const activities = useApi<Activity[]>('/groups/' + id + '/activities')
  const tasks = useApi<Task[]>('/groups/' + id + '/tasks')
  // Every change goes to the server first; then the list is loaded again so everyone sees the same thing.
  async function run(action: Promise<unknown>, ...lists: { reload: () => void }[]) {
    try {
      await action
    } catch (err) {
      alert((err as Error).message)
    }
    lists.forEach((l) => l.reload())
  }
  const decide = (userId: string, decision: 'accept' | 'decline') =>
    run(
      api('/groups/' + id + '/requests/' + userId, { method: 'POST', body: { decision } }).then(refresh),
      requests,
      members,
    )
  async function submit(f: HTMLFormElement) {
    const data = Object.fromEntries(new FormData(f))
    setError('')
    try {
      await api('/groups/' + id + (form === 'task' ? '/tasks' : '/activities'), { method: 'POST', body: data })
      ;(form === 'task' ? tasks : activities).reload()
      setForm(null)
    } catch (err) {
      setError((err as Error).message)
    }
  }
  if (!group) return <Empty>Group not found.</Empty>
  const events = activities.data || []
  const todo = tasks.data || []
  return (
    <>
      <DetailHeader title={group.name} fallback="/groups" />
      <div className="crew">
        {(members.data || []).slice(0, 3).map((m) => (
          <Avatar key={m.id} name={m.name} />
        ))}
        <small>
          {group.members} {group.members === 1 ? 'person' : 'people'} · your crew
        </small>
      </div>
      <Chips
        label="Group sections"
        values={['Chat', 'Activities', 'To-do', 'Members']}
        value={tab}
        onChange={(v) => setParams({ tab: v })}
      />
      {tab === 'Chat' && (
        <>
          <button className="activity-card lilac" onClick={() => setParams({ tab: 'Activities' })}>
            <h2>{events[0]?.title || 'Make your first little plan.'}</h2>
            <p>{events[0] ? when(events[0].date) + ' · ' + events[0].place : 'Plan something together'}</p>
            <strong>View activities →</strong>
          </button>
          <Chat path={'/groups/' + id + '/messages'} />
        </>
      )}
      {tab === 'To-do' && (
        <>
          <div className="illustrated-banner mint">
            <div>
              <h1>
                Tiny steps.
                <br />
                Real plans.
              </h1>
              <small>
                {todo.filter((t) => t.done).length} of {todo.length} done. Look at you go.
              </small>
            </div>
            <Mascot name="loop" />
          </div>
          <button className="button lime inline" onClick={() => setForm('task')}>
            Add task
          </button>
          <h2 className="section-title">Tasks</h2>
          {tasks.data && !todo.length && <Empty>No tasks yet. Start with one small thing.</Empty>}
          {todo.map((t) => (
            <label className={'task-row ' + (t.done ? 'done' : '')} key={t.id}>
              <input
                type="checkbox"
                checked={t.done}
                onChange={() => run(api('/tasks/' + t.id + '/toggle', { method: 'POST' }), tasks)}
              />
              <span>
                <strong>{t.title}</strong>
              </span>
            </label>
          ))}
        </>
      )}
      {tab === 'Activities' && (
        <>
          {events.map((event) => (
            <article className="activity-card lilac" key={event.id}>
              <small>
                {when(event.date)} · {event.goingCount} going
              </small>
              <Link to={'/activities/' + event.id}>
                <h2>{event.title}</h2>
                <span className="text-button">View activity →</span>
              </Link>
              <p>{event.place}</p>
              <button
                className={'button ' + (event.going ? 'lime' : '')}
                aria-pressed={event.going}
                onClick={async () => {
                  await run(api('/activities/' + event.id + '/going', { method: 'POST' }), activities)
                  if (!event.going) setJoinedActivity(event)
                }}
              >
                {event.going ? '✓ I’m going' : 'Join activity'}
              </button>
            </article>
          ))}
          {activities.data && !events.length && <Empty>No activities yet.</Empty>}
          {joinedActivity && (
            <CalendarPopup {...activityCalendar(joinedActivity)} onClose={() => setJoinedActivity(undefined)} />
          )}
          <button className="button" onClick={() => setForm('event')}>
            ＋ Plan an activity
          </button>
        </>
      )}
      {tab === 'Members' && (
        <>
          {host && !!requests.data?.length && (
            <>
              <h2 className="section-title">Join requests</h2>
              {requests.data.map((r) => (
                <article className="notice lilac" key={r.id}>
                  <Link className="member-row" to={'/users/' + r.id}>
                    <Avatar name={r.name} />
                    <span>
                      <strong>{r.name}</strong>
                      <small>{r.city}</small>
                    </span>
                  </Link>
                  <p>{r.intro}</p>
                  <div className="two-actions">
                    <button className="button" onClick={() => decide(r.id, 'decline')}>
                      Decline
                    </button>
                    <button className="button lime" onClick={() => decide(r.id, 'accept')}>
                      Accept
                    </button>
                  </div>
                </article>
              ))}
            </>
          )}
          <h2 className="section-title">Members</h2>
          {members.data?.map((m) => (
            <Link className="member-row" key={m.id} to={'/users/' + m.id}>
              <Avatar name={m.name} />
              <span>
                <strong>{m.name}</strong>
                <small>{m.role}</small>
              </span>
            </Link>
          ))}
          {members.error && <Empty>{members.error}</Empty>}
          {!host && (
            <button
              className="text-button"
              onClick={() =>
                confirm(`Leave ${group.name}? You can ask to join again later.`) &&
                api('/groups/' + id + '/leave', { method: 'POST' })
                  .then(() => refresh())
                  .then(
                    () => navigate('/groups'),
                    (err) => alert(err.message),
                  )
              }
            >
              Leave group
            </button>
          )}
        </>
      )}
      {form && (
        <Modal
          title={form === 'task' ? 'One thing at a time.' : 'A plan for your group.'}
          onClose={() => {
            setForm(null)
            setError('')
          }}
        >
          <form
            onSubmit={(e) => {
              e.preventDefault()
              submit(e.currentTarget)
            }}
          >
            <label>
              {form === 'task' ? 'What needs doing?' : 'What’s the plan?'}
              <input
                name="title"
                required
                maxLength={100}
                placeholder={form === 'task' ? 'Pick one small thing' : 'Name your little plan'}
              />
            </label>
            {form === 'event' && (
              <>
                <label>
                  When
                  <input type="datetime-local" name="date" required />
                </label>
                <label>
                  Meeting place
                  <input name="place" required maxLength={120} placeholder="A public place, or online" />
                </label>
                <label>
                  The very loose plan (optional, one step per line)
                  <textarea
                    name="plan"
                    maxLength={500}
                    placeholder={'Read one chapter\nShare one passage\nKeep it spoiler-free'}
                  />
                </label>
                <label>
                  Before you go (optional)
                  <input name="notes" maxLength={500} placeholder="Bring one passage that stayed with you." />
                </label>
              </>
            )}
            {error && (
              <p className="notice pink" role="alert">
                {error}
              </p>
            )}
            <button className="button lime">{form === 'task' ? 'Save task +' : 'Save plan →'}</button>
          </form>
        </Modal>
      )}
    </>
  )
}
