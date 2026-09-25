import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import { initials } from './images'
import ClientProfile from './ClientProfile'
import { SkeletonRows } from './Skeleton'
import { haptic } from './lib/haptic'

export default function Clients({ salon }) {
  const [q, setQ] = useState('')
  const [clients, setClients] = useState(null)
  const [open, setOpen] = useState(null)
  const [adding, setAdding] = useState(false)
  const [reload, setReload] = useState(0)

  useEffect(() => {
    let query = supabase.from('clients').select('*').eq('salon_id', salon.id).order('name')
    if (q.trim().length >= 2) query = query.or(`name.ilike.%${q}%,phone.ilike.%${q}%`)
    query.limit(50).then(({ data }) => setClients(data || []))
  }, [salon.id, q, reload])

  return (
    <div>
      <div className="pagehead"><h2>Klijenti</h2><p>Imenik svih klijenata</p></div>

      {adding ? (
        <AddClient salon={salon}
          onDone={c => { setAdding(false); setQ(''); setReload(r => r + 1); setOpen(c) }}
          onCancel={() => setAdding(false)} />
      ) : (
        <button className="ghost" style={{ width: '100%', marginBottom: 12 }}
          onClick={() => { haptic('tap'); setAdding(true) }}>
          ＋ Dodaj klijenta
        </button>
      )}

      <input className="f" placeholder="Pretraga po imenu ili telefonu"
        value={q} onChange={e => setQ(e.target.value)} />

      {clients === null ? <SkeletonRows count={4} /> : clients.length === 0 ? (
        <p className="tiny">{q.trim() ? 'Nema klijenata za taj upit.' : 'Imenik je prazan. Dodaj prvog klijenta.'}</p>
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

function AddClient({ salon, onDone, onCancel }) {
  const [name, setName] = useState('')
  const [phone, setPhone] = useState('')
  const [email, setEmail] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  async function save() {
    setErr(null)
    if (!name.trim()) { setErr('Upiši ime i prezime.'); return }
    if (!phone.trim()) { setErr('Upiši broj telefona.'); return }

    setSaving(true)
    // provera da klijent sa istim brojem već ne postoji
    const cleanPhone = phone.trim()
    const { data: existing } = await supabase.from('clients').select('id, name')
      .eq('salon_id', salon.id).eq('phone', cleanPhone).maybeSingle()
    if (existing) {
      setSaving(false); haptic('warning')
      setErr(`Ovaj broj već ima klijent: ${existing.name}.`)
      return
    }

    const { data, error } = await supabase.from('clients').insert({
      salon_id: salon.id,
      name: name.trim(),
      phone: cleanPhone,
      email: email.trim() || null,
      note: note.trim() || null,
    }).select().single()
    setSaving(false)
    if (error) { setErr(error.message); haptic('warning'); return }
    haptic('success')
    onDone(data)
  }

  return (
    <div className="card" style={{ marginBottom: 12 }}>
      <div className="eyebrow" style={{ marginTop: 0 }}>Novi klijent</div>
      <input className="f" placeholder="Ime i prezime" value={name} onChange={e => setName(e.target.value)} autoFocus />
      <input className="f" type="tel" inputMode="tel" placeholder="Telefon" value={phone} onChange={e => setPhone(e.target.value)} />
      <input className="f" type="email" inputMode="email" placeholder="Email (opciono)" value={email} onChange={e => setEmail(e.target.value)} />
      <textarea className="f" rows={2} placeholder="Napomena (opciono, npr. alergija, omiljena usluga)"
        value={note} onChange={e => setNote(e.target.value)} style={{ resize: 'vertical', fontFamily: 'inherit' }} />
      {err && <p className="err">{err}</p>}
      <div style={{ display: 'flex', gap: 8 }}>
        <button className="btn" style={{ marginTop: 0 }} disabled={saving} onClick={save}>
          {saving ? 'Čuvam…' : 'Sačuvaj'}
        </button>
        <button className="ghost" disabled={saving} onClick={onCancel}>Otkaži</button>
      </div>
    </div>
  )
}