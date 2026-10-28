import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useFeedWheel } from '../hooks/useFeedWheel'
import GroupCard from '../components/GroupCard'
import EventCard from '../components/EventCard'
import ProjectCard from '../components/ProjectCard'
import WeekendPlan from '../components/WeekendPlan'
import { useApi } from '../api'
import type { EventItem } from '../types'
import { Chips, Empty, Logo, Mascot, Modal } from '../components/UI'
import Icon from '../components/Icon'
import { useApp } from '../state/AppContext'
import { aboutInterest, fit, INTERESTS, interestsOf, whyForYou } from '../interests'
export default function Discover() {
  const { me, groups, saved, unread } = useApp()
  const [search, setSearch] = useState('')
  const [place, setPlace] = useState('Anywhere')
  const [sort, setSort] = useState('Best match')
  const [tab, setTab] = useState('For you')
  const [category, setCategory] = useState('All')
  const [budget, setBudget] = useState('Any price')
  const [savedOnly, setSavedOnly] = useState(false)
  const [filters, setFilters] = useState(false)
  // Published events, checked every minute, so one an admin just published shows up without a reload.
  const allEvents = useApi<EventItem[]>('/events', 60_000).data ?? []
  const allPlaces = useApi<string[]>('/events/places').data ?? []
  const communities = groups.filter((g) => !g.forEvent && !g.project)
  const projects = groups.filter((g) => g.project)
  // Your city first, then every place in Comoonly with something on (busiest first), then Online.
  const places = [
    'Anywhere',
    ...(me!.city && me!.city !== 'Online' ? [me!.city] : []),
    ...allPlaces.filter((c) => c.toLowerCase() !== me!.city.toLowerCase()),
    'Online',
  ]
  // Events with no price on the post only show for "Any price". Communities are free to join.
  const withinBudget = (e: EventItem) =>
    budget === 'Any price' ||
    (e.price !== null && (budget === 'Free' ? e.price === 0 : e.price <= Number(budget.replace(/\D/g, ''))))
  const at = (city: string, online: boolean) =>
    place === 'Anywhere' || (place === 'Online' ? online : city.toLowerCase() === place.toLowerCase())
  const found = (text: string) => text.toLowerCase().includes(search.toLowerCase())
  const matches = (g: (typeof groups)[number]) =>
    at(g.location, g.mode !== 'In person') &&
    (category === 'All' || interestsOf(g).includes(category)) &&
    (!savedOnly || saved.includes(g.id)) &&
    found(g.title + ' ' + g.description + ' ' + g.category)
  const visible = communities.filter(matches)
  const unfinished = projects.filter(matches)
  const events = allEvents.filter(
    (e) =>
      !savedOnly &&
      at(e.city, e.mode !== 'In person') &&
      (category === 'All' || aboutInterest(category, e)) &&
      withinBudget(e) &&
      found(e.title + ' ' + e.description + ' ' + e.category),
  )
  // "Something worth picking up": one unfinished idea at the top of For you, to introduce the Graveyard.
  const featured =
    tab === 'For you' ? unfinished.find((g) => g.project!.status !== 'alive' && g.ownerId !== me!.id) : undefined
  // The tabs pick what's shown: events (soonest first, as the server sends them), communities and
  // projects (newest first). "Best match" moves what fits your interests and city to the top.
  const items = [
    ...(tab === 'For you' || tab === 'Events' ? events.map((event) => ({ event })) : []),
    ...(tab === 'For you' || tab === 'Communities' ? visible.map((group) => ({ group })) : []),
    ...(tab === 'For you' || tab === 'Unfinished'
      ? unfinished.filter((g) => g !== featured).map((group) => ({ group }))
      : []),
  ]
  if (sort === 'Best match') items.sort((a, b) => fit(me!, b) - fit(me!, a))
  const feed = useFeedWheel()
  // Filters live behind the filter button; a short line says which ones are on.
  const active = [
    place !== 'Anywhere' && place,
    category !== 'All' && category,
    budget !== 'Any price' && budget,
    sort !== 'Best match' && sort,
    savedOnly && 'Saved',
  ].filter(Boolean)
  const clear = () => {
    setSearch('')
    setPlace('Anywhere')
    setCategory('All')
    setBudget('Any price')
    setSort('Best match')
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
        <div className="feed-tabs" role="group" aria-label="Show">
          {['For you', 'Events', 'Communities', 'Unfinished'].map((t) => (
            <button key={t} className={t === tab ? 'selected' : ''} aria-pressed={t === tab} onClick={() => setTab(t)}>
              {t}
            </button>
          ))}
        </div>
        {active.length > 0 && (
          <button className="text-button filter-line" onClick={clear}>
            {active.join(' · ')} · Clear ×
          </button>
        )}
      </div>
      <div className="discover-feed" ref={feed} aria-label={tab} tabIndex={0}>
        {tab === 'Unfinished' && (
          <div className="graveyard-intro">
            <Mascot name="loop" />
            <div>
              <h2>The Idea Graveyard</h2>
              <p>
                Ideas don’t have to die because their maker got stuck. Help one, or adopt it and give it a second life.
              </p>
              <Link className="text-button" to="/create?kind=project">
                🪦 Lay your own idea to rest →
              </Link>
            </div>
          </div>
        )}
        {tab === 'For you' && <WeekendPlan />}
        {featured && (
          <>
            <h2 className="section-title">🪦 Something worth picking up</h2>
            <ProjectCard group={featured} why={whyForYou(me!, { group: featured })} compact />
          </>
        )}
        {items.length ? (
          items.map((item) =>
            'event' in item ? (
              <EventCard key={item.event.id} event={item.event} why={whyForYou(me!, item)} />
            ) : item.group.project ? (
              <ProjectCard key={item.group.id} group={item.group} why={whyForYou(me!, item)} />
            ) : (
              <GroupCard key={item.group.id} group={item.group} why={whyForYou(me!, item)} />
            ),
          )
        ) : tab === 'Unfinished' && !active.length && !search ? (
          <Empty>
            Nothing resting here yet. Got an idea you couldn’t finish? It deserves a second chance.
            <Link className="button lime" to="/create?kind=project">
              Lay it to rest →
            </Link>
          </Empty>
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
          <h2 className="section-title">Where</h2>
          <Chips label="Where" values={places} value={place} onChange={setPlace} />
          <h2 className="section-title">Sort</h2>
          <Chips label="Sort" values={['Best match', 'Soonest']} value={sort} onChange={setSort} />
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
