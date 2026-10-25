import { useNavigate } from 'react-router-dom'
// ← : back where you came from, or to `fallback` if the page was opened directly (e.g. from a link).
export function BackButton({ fallback }: { fallback: string }) {
  const navigate = useNavigate()
  return (
    <button
      className="icon-button"
      aria-label="Back"
      onClick={() => {
        if (window.history.state?.idx > 0) navigate(-1)
        else navigate(fallback)
      }}
    >
      ←
    </button>
  )
}
export default function DetailHeader({ title, fallback }: { title: string; fallback: string }) {
  return (
    <header className="page-top">
      <BackButton fallback={fallback} />
      <strong>{title}</strong>
    </header>
  )
}
