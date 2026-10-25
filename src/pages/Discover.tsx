import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFeedWheel } from '../hooks/useFeedWheel'
import GroupCard from '../components/GroupCard'
import EventCard from '../components/EventCard'
import { useApi } from '../api'
import type { EventItem } from '../types'
import { Chips, Empty, Logo, Mascot, Modal } from '../components/UI'
import Icon from '../components/Icon'
import { useApp } from '../state/AppContext'
export default function Discover() {
  const { me, groups, saved, unread } = useApp()
  const [search, setSearch] = useState('')
  const [place, setPlace] = useState('Anywhere')
  const places = ['Anywhere', ...(me!.city && me!.city !== 'Online' ? [me!.city] : []), 'Online']
  const [category, setCategory] = useState('For you')
  const [savedOnly, setSavedOnly] = useState(false)
  const [filters, setFilters] = useState(false)
  const visible = groups.filter(
    (g) =>
      !g.forEvent &&
      (place === 'Anywhere' || g.location.toLowerCase() === place.toLowerCase()) &&
      (category === 'For you' || g.category === category) &&
      (!savedOnly || saved.includes(g.id)) &&
      (g.title + ' ' + g.description + ' ' + g.category).toLowerCase().includes(search.toLowerCase()),
  )
  // Published events sit at the top of the feed. Checked every minute, so one an admin just
  // published shows up without anyone reloading.
  const events = (useApi<EventItem[]>('/events', 60_000).data ?? []).filter(
    (e) =>
      category === 'For you' &&
      !savedOnly &&
      (place === 'Anywhere' ||
        (place === 'Online' ? e.mode !== 'In person' : e.city.toLowerCase() === place.toLowerCase())) &&
      (e.title + ' ' + e.description + ' ' + e.category).toLowerCase().includes(search.toLowerCase()),
  )
  const feed = useFeedWheel()
  return (
    <div className="discover-page">
      <div className="discover-fixed">
        <header className="discover-header">
          <Logo />
          <div className="header-actions">
            <Link
              className="icon-button"
              to="/notifications"
              aria-label={unread.total ? `Notifications, ${unread.total} new` : 'Notifications'}
            >
              <Icon name="bell" />
              {unread.total > 0 && (
                <span className="badge" aria-hidden="true">
                  {unread.total > 9 ? '9+' : unread.total}
                </span>
              )}
            </Link>
            <button
              className="icon-button"
              aria-label="Show saved groups"
              aria-pressed={savedOnly}
              onClick={() => setSavedOnly((v) => !v)}
            >
              <Icon name="save" />
            </button>
          </div>
        </header>
        <div className="discover-hero">
          <h1>
            Find your
            <br />
            kind of
            <br />
            people.
          </h1>
          <Mascot name="note" />
        </div>
        <p className="tagline">
          Small groups. Actual plans.{' '}
          <Link className="text-button" to="/events">
            Events →
          </Link>
        </p>
        <div className="search-row">
          <label className="search">
            <Icon name="search" />
            <input
              aria-label="Search groups"
              placeholder="What do you want to do?"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </label>
          <button className="icon-button" aria-label="More filters" onClick={() => setFilters(true)}>
            <Icon name="filter" />
          </button>
        </div>
        <Chips label="Location" values={places} value={place} onChange={setPlace} />
        <Chips
          label="Interest"
          values={['For you', 'Music', 'Creative', 'Tech']}
          value={category}
          onChange={setCategory}
        />
        {savedOnly && (
          <button className="text-button" onClick={() => setSavedOnly(false)}>
            Saved groups · Clear ×
          </button>
        )}
      </div>
      <div className="discover-feed" ref={feed} aria-label="Discover group feed" tabIndex={0}>
        {events.map((e) => (
          <EventCard key={e.id} event={e} />
        ))}
        {visible.length || events.length ? (
          visible.map((g) => <GroupCard key={g.id} group={g} />)
        ) : (
          <Empty>
            Nothing found. Try another search or filter.
            <button
              className="button"
              onClick={() => {
                setSearch('')
                setPlace('Anywhere')
                setCategory('For you')
                setSavedOnly(false)
              }}
            >
              Clear filters
            </button>
          </Empty>
        )}
      </div>
      {filters && (
        <Modal title="Find your people" onClose={() => setFilters(false)}>
          <Chips
            label="All interests"
            values={['For you', 'Music', 'Creative', 'Tech', 'Film', 'Reading']}
            value={category}
            onChange={setCategory}
          />
          <label className="check-row">
            <input type="checkbox" checked={savedOnly} onChange={(e) => setSavedOnly(e.target.checked)} /> Saved groups
            only
          </label>
          <button className="button primary" onClick={() => setFilters(false)}>
            Show groups
          </button>
        </Modal>
      )}
    </div>
  )
}
