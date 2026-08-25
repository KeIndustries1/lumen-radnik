import { useState } from 'react'
import { supabase } from './lib/supabase'

export default function AuthScreen() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setErr(null); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
    setBusy(false)
    if (error) setErr(error.message.includes('Invalid') ? 'Pogrešan email ili lozinka.' : error.message)
  }

  return (
    <div className="login-wrap">
      <div className="login-box">
        <div className="mark">Lumen · za radnike</div>
        <h1>Moj<br/><em>raspored</em></h1>
        <form onSubmit={submit} className="stack">
          <input className="f" type="email" placeholder="Email" value={email}
                 onChange={e => setEmail(e.target.value)} required />
          <input className="f" type="password" placeholder="Lozinka" value={pass}
                 onChange={e => setPass(e.target.value)} required />
          {err && <p className="err">{err}</p>}
          <button className="btn" disabled={busy}>{busy ? 'Sačekajte…' : 'Prijavi se'}</button>
        </form>
      </div>
      <style>{`
        .login-wrap{max-width:430px;margin:0 auto;min-height:100vh;display:flex;align-items:center;
          background:#17131C;color:#fff;font-family:Inter,system-ui,sans-serif}
        .login-box{width:100%;padding:32px 26px}
        .mark{font-size:12px;letter-spacing:.3em;text-transform:uppercase;color:#BCAEB8}
        h1{font-family:Georgia,serif;font-size:44px;line-height:1.05;margin:10px 0 24px}
        h1 em{font-style:italic;color:#F0A9BC}
        .stack{display:flex;flex-direction:column;gap:10px}
        .f{padding:14px;border-radius:12px;border:1px solid #3B3244;background:#231D29;color:#fff;font:inherit}
        .btn{padding:15px;border-radius:14px;border:0;background:#A8324F;color:#fff;font-weight:700;font-size:16px}
        .btn:disabled{opacity:.6}
        .err{color:#F0A9BC;font-size:13px;margin:0}
      `}</style>
    </div>
  )
}