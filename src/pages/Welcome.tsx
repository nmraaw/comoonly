import { useState } from 'react'
import { Chips } from '../components/UI'
import { useMock, type Me } from '../state/MockContext'
import { api } from '../api'
import welcome from '../assets/reference/welcome.png'
// Shown to anyone who isn't logged in, whatever page they opened.
export default function Welcome(){
 const {signIn}=useMock();const [mode,setMode]=useState('Sign up');const [error,setError]=useState('');const [busy,setBusy]=useState(false);const signup=mode==='Sign up'
 async function submit(form:HTMLFormElement){
  setBusy(true);setError('')
  try{signIn(await api<Me>(signup?'/auth/signup':'/auth/login',{method:'POST',body:Object.fromEntries(new FormData(form))}))}
  catch(err){setError((err as Error).message);setBusy(false)}
 }
 return <><header className="page-top"><span className="brand">comoonly</span></header>
 <img className="success-art" src={welcome} alt="A happy invitation character"/>
 <h1>{signup?<>Find your<br/>kind of people.</>:<>Good to see<br/>you again.</>}</h1><p className="tagline">Small groups. Actual plans.</p>
 <Chips label="Account" values={['Sign up','Log in']} value={mode} onChange={m=>{setMode(m);setError('')}}/>
 <form key={mode} onSubmit={e=>{e.preventDefault();submit(e.currentTarget)}}>
 {signup&&<label>Your name<input name="name" required maxLength={60} autoComplete="name"/></label>}
 <label>Email<input name="email" type="email" required autoComplete="email"/></label>
 <label>Password<input name="password" type="password" required minLength={signup?8:undefined} maxLength={100} autoComplete={signup?'new-password':'current-password'}/></label>
 {signup&&<p className="hint">At least 8 characters.</p>}
 {error&&<p className="notice pink" role="alert">{error}</p>}
 <button className="button primary" disabled={busy}>{busy?'One moment…':signup?'Create account →':'Log in →'}</button>
 </form></>
}
