import { useNavigate } from 'react-router-dom'
export default function DetailHeader({ title, fallback }: { title: string; fallback: string }) {
  const navigate = useNavigate()
  return (
    <header className="page-top">
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
      <strong>{title}</strong>
    </header>
  )
}
