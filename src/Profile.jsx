import { supabase } from './lib/supabase'
import { catFor, initials } from './images'
import { haptic } from './lib/haptic'

export default function Profile({ worker, salon }) {
  const c = catFor(worker.role_sr)
  return (
    <div style={{ textAlign: 'center' }}>
      <div className="pagehead" style={{ textAlign: 'left' }}><h2>Profil</h2><p>Vaši podaci i nalog</p></div>
      <div className="card" style={{ padding: 22 }}>
        <div className="profile-avatar" style={{ background: `linear-gradient(150deg, ${c.from}, ${c.to})` }}>
          {initials(worker.name)}
        </div>
        <div style={{ fontFamily: 'Fraunces, serif', fontSize: 21, color: 'var(--text)' }}>{worker.name}</div>
        <div className="tiny" style={{ marginTop: 2 }}>{worker.role_sr}</div>
        <div className="tiny" style={{ marginTop: 10 }}>{salon.name}</div>
        <button className="ghost" style={{ width: '100%', marginTop: 18 }}
          onClick={() => { haptic('tap'); supabase.auth.signOut() }}>
          Odjavi se
        </button>
      </div>
    </div>
  )
}