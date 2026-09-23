import { useState } from 'react'
import { supabase } from './lib/supabase'
import { motion } from 'framer-motion'
import { haptic } from './lib/haptic'

export default function AuthScreen() {
  const [email, setEmail] = useState('')
  const [pass, setPass] = useState('')
  const [showPass, setShowPass] = useState(false)
  const [err, setErr] = useState(null)
  const [busy, setBusy] = useState(false)
  const [shake, setShake] = useState(0)

  async function submit(e) {
    e.preventDefault()
    setErr(null); setBusy(true)
    const { error } = await supabase.auth.signInWithPassword({ email, password: pass })
    setBusy(false)
    if (error) {
      setErr(error.message.includes('Invalid') ? 'Pogrešan email ili lozinka.' : error.message)
      haptic('warning'); setShake(s => s + 1)
    }
  }

  return (
    <div className="auth-screen">
      <motion.div className="auth-card"
        initial={{ opacity: 0, y: 18 }} animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.28, ease: [0.16, 1, 0.3, 1] }}
      >
        <div className="mark">Za radnike salona</div>
        <h1>Moj<br/><em>raspored</em></h1>
        <motion.form onSubmit={submit} className="stack"
          animate={{ x: shake % 2 === 1 ? [0, -8, 8, -5, 5, 0] : 0 }}
          transition={{ duration: 0.35 }}
        >
          <input className="f" type="email" placeholder="Email" value={email} autoComplete="email"
                 onChange={e => setEmail(e.target.value)} required />
          <div className="f-pass-wrap">
            <input className="f" type={showPass ? 'text' : 'password'} placeholder="Lozinka" value={pass}
                   autoComplete="current-password"
                   onChange={e => setPass(e.target.value)} required />
            <button type="button" className="f-pass-toggle" onClick={() => setShowPass(s => !s)}>
              {showPass ? 'Sakrij' : 'Prikaži'}
            </button>
          </div>
          {err && <p className="err">{err}</p>}
          <button className="btn" disabled={busy}>{busy ? 'Sačekajte…' : 'Prijavi se'}</button>
        </motion.form>
      </motion.div>
    </div>
  )
}