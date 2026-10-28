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
import { aboutInterest, fit, INTERESTS, whyForYou } from '../interests'
export default function Discover() {
  const { me, groups, saved, unread } = useApp()
  const [search, setSearch] = useState('')
  const [place, setPlace] = useState('Anywhere')
  const [sort, setSort] = useState<'For you' | 'Soonest'>('For you')
  const [category, setCategory] = useState('All')
  const [budget, setBudget] = useState('Any price')
  const [savedOnly, setSavedOnly] = useState(false)
  const [filters, setFilters] = useState(false)
  // Published events, checked every minute, so one an admin just published shows up without a reload.
  const allEvents = useApi<EventItem[]>('/events', 60_000).data ?? []
  const communities = groups.filter((g) => !g.forEvent)
  // Your city first, then every other place something is happening.
  const places = [
    ...new Set(
      ['Anywhere', me!.city, ...communities.map((g) => g.location), ...allEvents.map((e) => e.city), 'Online'].filter(
        (c) => c && c !== 'Pakistan',
      ),
    ),
  ]
  // Events with no price on the post only show for "Any price". Communities are free to join.
  const withinBudget = (e: EventItem) =>
    budget === 'Any price' ||
    (e.price !== null && (budget === 'Free' ? e.price === 0 : e.price <= Number(budget.replace(/\D/g, ''))))
  const at = (city: string, online: boolean) =>
    place === 'Anywhere' || (place === 'Online' ? online : city.toLowerCase() === place.toLowerCase())
  const found = (text: string) => text.toLowerCase().includes(search.toLowerCase())
  const visible = communities.filter(
    (g) =>
      at(g.location, g.mode !== 'In person') &&
      (category === 'All' || g.category === category) &&
      (!savedOnly || saved.includes(g.id)) &&
      found(g.title + ' ' + g.description + ' ' + g.category),
  )
  const events = allEvents.filter(
    (e) =>
      !savedOnly &&
      at(e.city, e.mode !== 'In person') &&
      (category === 'All' || aboutInterest(category, e)) &&
      withinBudget(e) &&
      found(e.title + ' ' + e.description + ' ' + e.category),
  )
  // One feed: events (soonest first, as the server sends them), then communities (newest first).
  // "For you" moves what matches your interests and city to the top, keeping that order otherwise.
  const items = [...events.map((event) => ({ event })), ...visible.map((group) => ({ group }))]
  if (sort === 'For you') items.sort((a, b) => fit(me!, b) - fit(me!, a))
  const feed = useFeedWheel()
  // The interest and saved filters live behind the filter button; a short line says which ones are on.
  const active = [category !== 'All' && category, budget !== 'Any price' && budget, savedOnly && 'Saved'].filter(
    Boolean,
  )
  const clear = () => {
    setSearch('')
    setPlace('Anywhere')
    setCategory('All')
    setBudget('Any price')
    setSavedOnly(false)
  }
  // The top stays small (logo row, one heading line with the mascot, search) so the feed gets the screen.
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
              aria-label="Show saved communities"
              aria-pressed={savedOnly}
              onClick={() => setSavedOnly((v) => !v)}
            >
              <Icon name="save" />
            </button>
          </div>
        </header>
        <div className="discover-hero">
          <h1>Find your kind of people.</h1>
          <Mascot name="note" />
        </div>
        <div className="search">
          <Icon name="search" />
          <input
            aria-label="Search events and communities"
            placeholder="What do you want to do?"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
          <button className="filter-button" aria-label="Filters" onClick={() => setFilters(true)}>
            <Icon name="filter" />
            {active.length > 0 && <span className="filter-dot" aria-label="filters on" />}
          </button>
        </div>
        <div className="feed-controls">
          <label>
            📍
            <select aria-label="City" value={place} onChange={(e) => setPlace(e.target.value)}>
              {places.map((p) => (
                <option key={p}>{p}</option>
              ))}
            </select>
          </label>
          <label>
            ↕
            <select aria-label="Sort" value={sort} onChange={(e) => setSort(e.target.value as typeof sort)}>
              <option>For you</option>
              <option>Soonest</option>
            </select>
          </label>
        </div>
        {active.length > 0 && (
          <button className="text-button filter-line" onClick={clear}>
            {active.join(' · ')} · Clear ×
          </button>
        )}
      </div>
      <div className="discover-feed" ref={feed} aria-label="Events and communities" tabIndex={0}>
        {items.length ? (
          items.map((item) =>
            'event' in item ? (
              <EventCard key={item.event.id} event={item.event} why={whyForYou(me!, item)} />
            ) : (
              <GroupCard key={item.group.id} group={item.group} why={whyForYou(me!, item)} />
            ),
          )
        ) : (
          <Empty>
            Nothing found. Try another search or filter.
            <button className="button" onClick={clear}>
              Clear filters
            </button>
          </Empty>
        )}
      </div>
      {filters && (
        <Modal title="Find your people" onClose={() => setFilters(false)}>
          <h2 className="section-title">Interests</h2>
          <Chips label="Interests" values={['All', ...INTERESTS]} value={category} onChange={setCategory} />
          <h2 className="section-title">Budget</h2>
          <Chips
            label="Budget"
            values={['Any price', 'Free', 'Under Rs 1,000', 'Under Rs 3,000']}
            value={budget}
            onChange={setBudget}
          />
          <label className="check-row">
            <input type="checkbox" checked={savedOnly} onChange={(e) => setSavedOnly(e.target.checked)} /> Saved
            communities only
          </label>
          <button className="button primary" onClick={() => setFilters(false)}>
            Show results
          </button>
        </Modal>
      )}
    </div>
  )
}
