import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import AuthScreen from './AuthScreen'
import Schedule from './Schedule'
import Clients from './Clients'
import Profile from './Profile'
import { catFor, initials } from './images'
import { motion, AnimatePresence } from 'framer-motion'
import './app.css'

const SALON_SLUG = 'lumen'

export default function App() {
  const [session, setSession] = useState(undefined)
  const [worker, setWorker] = useState(undefined)
  const [salon, setSalon] = useState(null)
  const [tab, setTab] = useState('raspored')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => {
    if (!session) return
    supabase.from('salons').select('*').eq('slug', SALON_SLUG).single()
      .then(({ data }) => setSalon(data))
    supabase.from('workers').select('*').eq('auth_user_id', session.user.id).maybeSingle()
      .then(({ data }) => setWorker(data))
  }, [session])

  if (session === undefined) return <p style={{ padding: 24 }}>Učitavanje…</p>
  if (!session) return <AuthScreen />
  if (worker === undefined || !salon) return <p style={{ padding: 24 }}>Učitavanje…</p>
  if (!worker) return (
    <p style={{ padding: 24 }}>
      Ovaj nalog nije povezan ni sa jednim radnikom u salonu. Proverite <code>workers.auth_user_id</code> u bazi.
    </p>
  )

  const c = catFor(worker.role_sr)

  return (
    <div className="app-shell">
      <div className="topbar">
        <div className="topbar-avatar" style={{ background: `linear-gradient(150deg, ${c.from}, ${c.to})` }}>
          {initials(worker.name)}
        </div>
        <div>
          <b>{worker.name}</b>
          <small>{worker.role_sr}</small>
        </div>
      </div>

      <main>
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 12 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -8 }}
            transition={{ duration: 0.22, ease: [0.16, 1, 0.3, 1] }}
          >
            {tab === 'raspored' && <Schedule worker={worker} salon={salon} />}
            {tab === 'klijenti' && <Clients salon={salon} />}
            {tab === 'profil' && <Profile worker={worker} salon={salon} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <div className="tabs">
        <button className={tab==='raspored'?'on':''} onClick={()=>setTab('raspored')}><span className="i">◷</span>Raspored</button>
        <button className={tab==='klijenti'?'on':''} onClick={()=>setTab('klijenti')}><span className="i">☺</span>Klijenti</button>
        <button className={tab==='profil'?'on':''} onClick={()=>setTab('profil')}><span className="i">☰</span>Profil</button>
      </div>
    </div>
  )
}