import { Link } from 'react-router-dom'
export default function NotFound({ type = 'Page', to = '/' }: { type?: string; to?: string }) {
  return (
    <div className="empty">
      <h1>{type} not found</h1>
      <p>This link doesn’t lead anywhere anymore.</p>
      <Link className="button primary" to={to}>
        Back to {to === '/groups' ? 'groups' : 'Discover'} →
      </Link>
    </div>
  )
}
