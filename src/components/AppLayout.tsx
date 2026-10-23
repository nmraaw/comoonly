import { NavLink, Outlet, useLocation } from 'react-router-dom'
import Icon from './Icon'
export default function AppLayout(){const {pathname}=useLocation();return <div className={'app-shell '+(pathname==='/'?'discover-shell':'')}>
<a className="skip-link" href="#main-content">Skip to content</a>
<main id="main-content" tabIndex={-1}><Outlet/></main>
<nav className="bottom-nav" aria-label="Main navigation">{['Discover','Groups','Create','Messages','Me'].map((label,i)=><NavLink key={label} to={i===0?'/':'/'+label.toLowerCase()} end={i===0} className={({isActive})=>isActive||(label==='Discover'&&(pathname.startsWith('/posts/')||pathname.startsWith('/events')))||(label==='Groups'&&pathname.startsWith('/activities/'))||(label==='Me'&&pathname.startsWith('/users/'))?'active':''}><Icon name={label}/><span>{label}</span></NavLink>)}</nav>
</div>}
