import { useEffect, useRef, type ReactNode } from 'react'
import Icon from './Icon'
import wordmark from '../assets/brand/wordmark.svg'
import pip from '../assets/brand/pip.svg'
import loop from '../assets/brand/loop.svg'
import reel from '../assets/brand/reel.svg'
import fold from '../assets/brand/fold.svg'
import note from '../assets/brand/note.svg'
const MASCOTS = { pip, loop, reel, fold, note }
export function Chips({
  values,
  value,
  onChange,
  label,
}: {
  values: string[]
  value: string
  onChange: (v: string) => void
  label: string
}) {
  return (
    <div className="chips" role="group" aria-label={label}>
      {values.map((v) => (
        <button
          key={v}
          className={value === v ? 'chip selected' : 'chip'}
          aria-pressed={value === v}
          onClick={() => onChange(v)}
        >
          {v}
        </button>
      ))}
    </div>
  )
}
export function Avatar({ name }: { name: string }) {
  return (
    <span className="avatar" aria-hidden="true">
      {name
        .split(' ')
        .map((s) => s[0])
        .slice(0, 2)
        .join('')}
    </span>
  )
}
export function Modal({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    const dialog = ref.current
    dialog?.showModal()
    return () => dialog?.close()
  }, [])
  return (
    <dialog
      ref={ref}
      onCancel={onClose}
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose()
      }}
    >
      <div className="modal-top">
        <h2>{title}</h2>
        <button className="icon-button" aria-label="Close dialog" onClick={onClose}>
          <Icon name="close" />
        </button>
      </div>
      {children}
    </dialog>
  )
}
export function Empty({ children }: { children: ReactNode }) {
  return <div className="empty">{children}</div>
}
export function Logo() {
  return <img className="brand-logo" src={wordmark} alt="comoonly" />
}
// The characters from the brand studio. Give `name` for a fixed one, or `seed` (an id) to pick one:
// the same id always gets the same character, so each event or activity keeps "its" mascot.
export function Mascot({
  name,
  seed = '',
  className,
}: {
  name?: keyof typeof MASCOTS
  seed?: string
  className?: string
}) {
  const all = Object.values(MASCOTS)
  const src = name ? MASCOTS[name] : all[[...seed].reduce((h, c) => (h * 31 + c.charCodeAt(0)) >>> 0, 7) % all.length]
  return <img className={'mascot ' + (className ?? '')} src={src} alt="" aria-hidden="true" />
}
