import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { initials } from './images'
import ClientProfile from './ClientProfile'
import { SkeletonRows } from './Skeleton'
import { haptic } from './lib/haptic'

const din = v => v.toLocaleString('sr-RS') + ' din'
const fmtDate = ds => { const d = new Date(ds+'T00:00:00'); return d.getDate()+'.'+(d.getMonth()+1)+'.'+d.getFullYear()+'.' }

export default function Clients({ salon }) {
  const [q, setQ] = useState('')
  const [clients, setClients] = useState(null)
  const [open, setOpen] = useState(null)

  useEffect(() => {
    let query = supabase.from('clients').select('*').eq('salon_id', salon.id).order('name')
    if (q.trim().length >= 2) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
    query.limit(50).then(({ data }) => setClients(data || []))
  }, [salon.id, q])

  return (
    <div>
      <div className="pagehead"><h2>Klijenti</h2><p>Imenik svih klijenata salona</p></div>
      <input className="f" placeholder="Pretraga po imenu ili telefonu"
        value={q} onChange={e => setQ(e.target.value)} />

      {clients === null ? <SkeletonRows count={4} /> : clients.length === 0 ? (
        <p className="tiny">Nema klijenata za taj upit.</p>
      ) : clients.map(c => (
        <button key={c.id} className="clientrow" onClick={() => { haptic('tap'); setOpen(c) }}>
          <div className="client-avatar">{initials(c.name)}</div>
          <span className="grow">
            <span className="name">{c.name}</span><br/>
            <span className="tiny">{c.phone || 'bez broja'}</span>
          </span>
          <span className="chev">›</span>
        </button>
      ))}

      {open && <ClientProfile client={open} salon={salon} onClose={() => setOpen(null)} />}
    </div>
  )
}