import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import AuthScreen from './AuthScreen'
import Schedule from './Schedule'
import Clients from './Clients'
import Settings from './Settings'
import { catFor, initials } from './images'
import { motion, AnimatePresence } from 'framer-motion'
import { haptic } from './lib/haptic'
import { applyTheme } from './lib/themes'
import './app.css'

function FullLoading() {
  return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100dvh', display: 'flex',
      alignItems: 'center', justifyContent: 'center', background: 'var(--ink)' }}>
      <div className="skel" style={{ width: 46, height: 46, borderRadius: '50%' }} />
    </div>
  )
}

export default function App() {
  const [session, setSession] = useState(undefined)
  const [worker, setWorker] = useState(undefined)
  const [salon, setSalon] = useState(undefined)
  const [tab, setTab] = useState('raspored')

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => setSession(data.session))
    const { data: sub } = supabase.auth.onAuthStateChange((_e, s) => setSession(s))
    return () => sub.subscription.unsubscribe()
  }, [])

  useEffect(() => { reloadWorker() }, [session])

  // Univerzalna app: salon se NE bira unapred (nema env promenljivu).
  // Prvo saznamo KOJI je radnik ulogovan, pa preko njegovog salon_id
  // učitamo TAČNO njegov salon — različiti radnici, ista app, svaki
  // vidi samo svoje.
  function reloadWorker() {
    if (!session) { setWorker(undefined); setSalon(undefined); return }
    supabase.from('workers').select('*').eq('auth_user_id', session.user.id).maybeSingle()
      .then(({ data: w }) => {
        setWorker(w)
        if (!w) { setSalon(null); return }
        supabase.from('salons').select('*').eq('id', w.salon_id).single()
          .then(({ data: s }) => {
            setSalon(s)
            applyTheme(s?.theme, s?.brand_color)
          })
      })
  }

  if (session === undefined) return <FullLoading />
  if (!session) return <AuthScreen />
  if (worker === undefined || salon === undefined) return <FullLoading />
  if (!worker) return (
    <div style={{ maxWidth: 430, margin: '0 auto', minHeight: '100dvh', display: 'flex',
      flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 14,
      background: 'var(--ink)', color: 'var(--text)', padding: 24, textAlign: 'center' }}>
      <p>Ovaj nalog nije povezan sa nijednim salonom. Obratite se salonu da provere vaš pristup.</p>
      <button className="ghost" style={{ width: 'auto', padding: '10px 20px' }}
        onClick={() => supabase.auth.signOut()}>Odjavi se</button>
    </div>
  )

  function switchTab(t) { haptic('tap'); setTab(t) }

  const c = catFor(worker.role_sr)

  return (
    <div className="app-shell">
      <div className="topbar">
        {worker.photo_url ? (
          <img src={worker.photo_url} alt="" className="topbar-avatar" style={{ objectFit: 'cover' }} />
        ) : (
          <div className="topbar-avatar" style={{ background: `linear-gradient(150deg, ${c.from}, ${c.to})` }}>
            {initials(worker.name)}
          </div>
        )}
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
            {tab === 'profil' && <Settings worker={worker} salon={salon} onWorkerChange={reloadWorker} />}
          </motion.div>
        </AnimatePresence>
      </main>

      <div className="tabs">
        <button className={tab==='raspored'?'on':''} onClick={()=>switchTab('raspored')}><span className="i">◷</span>Raspored</button>
        <button className={tab==='klijenti'?'on':''} onClick={()=>switchTab('klijenti')}><span className="i">☺</span>Klijenti</button>
        <button className={tab==='profil'?'on':''} onClick={()=>switchTab('profil')}><span className="i">⚙</span>Podešavanja</button>
      </div>
    </div>
  )
}