import { useEffect } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useApp } from '../state/AppContext'
import Icon from './Icon'
export default function AppLayout() {
  const { pathname, search } = useLocation()
  const { unread, refreshUnread } = useApp()
  // Re-check the badges on every page change, e.g. right after opening a chat.
  useEffect(() => {
    refreshUnread()
  }, [pathname, search, refreshUnread])
  return (
    <div className={'app-shell ' + (pathname === '/' ? 'discover-shell' : '')}>
      <a className="skip-link" href="#main-content">
        Skip to content
      </a>
      <main id="main-content" tabIndex={-1}>
        <Outlet />
      </main>
      <nav className="bottom-nav" aria-label="Main navigation">
        {['Discover', 'Groups', 'Create', 'Messages', 'Me'].map((label, i) => (
          <NavLink
            key={label}
            to={i === 0 ? '/' : '/' + label.toLowerCase()}
            end={i === 0}
            className={({ isActive }) =>
              isActive ||
              (label === 'Discover' && /^\/(posts|events|notifications)/.test(pathname)) ||
              (label === 'Groups' && pathname.startsWith('/activities/')) ||
              (label === 'Me' && /^\/users/.test(pathname))
                ? 'active'
                : ''
            }
          >
            <Icon name={label} />
            <span>{label}</span>
            {label === 'Messages' && unread.messages > 0 && (
              <span className="badge" aria-label={unread.messages + ' unread'}>
                {unread.messages > 9 ? '9+' : unread.messages}
              </span>
            )}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
