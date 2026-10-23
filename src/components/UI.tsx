import { useEffect, useRef, type ReactNode } from 'react'
import Icon from './Icon'
export function Chips({values,value,onChange,label}:{values:string[];value:string;onChange:(v:string)=>void;label:string}){return <div className="chips" role="group" aria-label={label}>{values.map(v=><button key={v} className={value===v?'chip selected':'chip'} aria-pressed={value===v} onClick={()=>onChange(v)}>{v}</button>)}</div>}
export function Avatar({name}:{name:string}){return <span className="avatar" aria-hidden="true">{name.split(' ').map(s=>s[0]).slice(0,2).join('')}</span>}
export function Modal({title,onClose,children}:{title:string;onClose:()=>void;children:ReactNode}){const ref=useRef<HTMLDialogElement>(null);useEffect(()=>{const dialog=ref.current;dialog?.showModal();return()=>dialog?.close()},[]);return <dialog ref={ref} onCancel={onClose} onClick={e=>{if(e.target===e.currentTarget)onClose()}}><div className="modal-top"><h2>{title}</h2><button className="icon-button" aria-label="Close dialog" onClick={onClose}><Icon name="close"/></button></div>{children}</dialog>}
export function Empty({children}:{children:ReactNode}){return <div className="empty">{children}</div>}
