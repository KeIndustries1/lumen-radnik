import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { initials } from './images'

const fmtDate = ds => { const d = new Date(ds+'T00:00:00'); return d.getDate()+'.'+(d.getMonth()+1)+'.'+d.getFullYear()+'.' }

export default function ClientProfile({ client, salon, onClose }) {
  const [history, setHistory] = useState(null)

  useEffect(() => {
    supabase.from('appointments')
      .select('id, appt_date, start_min, duration_min, status, workers(name), appointment_services(price_rsd, services(name_sr))')
      .eq('client_id', client.id).eq('kind', 'appt')
      .order('appt_date', { ascending: false }).limit(15)
      .then(({ data }) => setHistory(data || []))
  }, [client.id])

  return (
    <div className="sheet" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="inner">
        <div style={{ textAlign: 'center', marginBottom: 16 }}>
          <div className="profile-avatar" style={{ background: 'linear-gradient(150deg, #8A2F47, #5C1F32)' }}>
            {initials(client.name)}
          </div>
          <div style={{ fontFamily: 'Fraunces, serif', fontSize: 20, color: 'var(--text)' }}>{client.name}</div>
          {client.phone && (
            <a href={`tel:${client.phone.replace(/ /g,'')}`} className="ghost"
              style={{ display: 'inline-block', marginTop: 10 }}>
              📞 {client.phone}
            </a>
          )}
        </div>

        <div className="eyebrow">Istorija termina</div>
        {history === null ? (
          <p className="tiny">Učitavanje…</p>
        ) : history.length === 0 ? (
          <p className="tiny">Još nema termina kod nas.</p>
        ) : history.map(a => (
          <div key={a.id} className="card" style={{ marginBottom: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
              <span className="name">{fmtDate(a.appt_date)}</span>
              {a.status === 'cancelled' && <span className="tiny" style={{ color: 'var(--rouge)' }}>otkazano</span>}
            </div>
            <div className="tiny" style={{ marginTop: 3 }}>
              {a.appointment_services.map(x => x.services.name_sr).join(' + ')} · {a.workers?.name}
            </div>
          </div>
        ))}

        <button className="ghost" style={{ width: '100%', marginTop: 8 }} onClick={onClose}>Zatvori</button>
      </div>
    </div>
  )
}