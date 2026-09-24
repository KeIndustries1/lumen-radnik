import { useEffect, useState } from 'react'
import ImageCropper from './ImageCropper'
import { createPortal } from 'react-dom'
import { motion } from 'framer-motion'
import { User, Image as ImageIcon, Banknote, Crown, Megaphone, Clock, PlaneTakeoff, Bell } from 'lucide-react'
import { supabase } from './lib/supabase'
import { catFor, initials } from './images'
import { haptic } from './lib/haptic'
import { SkeletonRows } from './Skeleton'

const DOW_ORDER = [1, 2, 3, 4, 5, 6, 0]   // pon..ned (SQL dow: 0=ned...6=sub)
const DOW_LABEL = { 0: 'Nedelja', 1: 'Ponedeljak', 2: 'Utorak', 3: 'Sreda', 4: 'Četvrtak', 5: 'Petak', 6: 'Subota' }
const fmtHM = m => String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0')
const TIME_OPTIONS = Array.from({ length: (23-6)*2 + 1 }, (_, i) => 6*60 + i*30)   // 06:00–23:00 na 30min

export default function Settings({ worker, salon, onWorkerChange }) {
  const [modal, setModal] = useState(null)   // 'profile' | 'hours' | 'photo' | 'timeoff' | 'services' | 'vip' | 'notify' | 'remind' | null

  const titles = { profile: 'Moj profil', hours: 'Radno vreme', photo: 'Slika profila', timeoff: 'Odmor', services: 'Cene i usluge', vip: 'VIP termini', notify: 'Obaveštenje', remind: 'Podsetnici klijentima' }

  function open(key) { haptic('tap'); setModal(key) }
  function close() { setModal(null) }

  return (
    <div>
      <div className="pagehead"><h2>Podešavanja</h2></div>
      <div className="settings-list">
        <button className="settings-row" onClick={() => open('profile')}><span className="s-ic"><User size={13} strokeWidth={1.75} /></span>Moj profil<span className="chev">›</span></button>
        <button className="settings-row" onClick={() => open('photo')}><span className="s-ic"><ImageIcon size={13} strokeWidth={1.75} /></span>Slika profila<span className="chev">›</span></button>
        <button className="settings-row" onClick={() => open('services')}><span className="s-ic"><Banknote size={13} strokeWidth={1.75} /></span>Cene i usluge<span className="chev">›</span></button>
        <button className="settings-row" onClick={() => open('vip')}><span className="s-ic"><Crown size={13} strokeWidth={1.75} /></span>VIP termini<span className="chev">›</span></button>
        <button className="settings-row" onClick={() => open('notify')}><span className="s-ic"><Megaphone size={13} strokeWidth={1.75} /></span>Obaveštenje<span className="chev">›</span></button>
        <button className="settings-row" onClick={() => open('remind')}><span className="s-ic"><Bell size={13} strokeWidth={1.75} /></span>Podsetnici klijentima<span className="chev">›</span></button>
        <button className="settings-row" onClick={() => open('hours')}><span className="s-ic"><Clock size={13} strokeWidth={1.75} /></span>Radno vreme<span className="chev">›</span></button>
        <button className="settings-row" onClick={() => open('timeoff')}><span className="s-ic"><PlaneTakeoff size={13} strokeWidth={1.75} /></span>Odmor<span className="chev">›</span></button>
      </div>

      {modal && createPortal((
        <motion.div className="settings-modal-backdrop"
          initial={{ opacity: 0 }} animate={{ opacity: 1 }}
          transition={{ duration: 0.18 }} onClick={close}>
          <motion.div className="settings-modal" onClick={e => e.stopPropagation()}
            initial={{ y: '100%' }} animate={{ y: 0 }}
            transition={{ type: 'spring', stiffness: 420, damping: 38 }}
          >
            <div className="sheet-handle" />
            <div className="sheet-header">
              <b>{titles[modal]}</b>
              <button className="sheet-close" onClick={close}>✕</button>
            </div>
            <div className="sheet-body">
              {modal === 'profile' && <ProfileSection worker={worker} salon={salon} />}
              {modal === 'photo' && <PhotoSection worker={worker} onWorkerChange={onWorkerChange} />}
              {modal === 'hours' && <HoursSection worker={worker} salon={salon} />}
              {modal === 'timeoff' && <TimeOffSection worker={worker} />}
              {modal === 'services' && <ServicesSection worker={worker} />}
              {modal === 'vip' && <ServicesSection worker={worker} vip />}
              {modal === 'notify' && <NotifySection worker={worker} salon={salon} />}
              {modal === 'remind' && <RemindSection worker={worker} onWorkerChange={onWorkerChange} />}
            </div>
          </motion.div>
        </motion.div>
      ), document.body)}
    </div>
  )
}

const DUR_OPTIONS = [15, 20, 30, 40, 45, 60, 75, 90, 105, 120, 150, 180]
const din = v => Number(v).toLocaleString('sr-RS') + ' din'
const durTxt = m => m>=60 ? (m%60 ? Math.floor(m/60)+'h '+(m%60)+'min' : Math.floor(m/60)+'h') : m+'min'

const DAY_HOURS = [12, 13, 14, 15, 16, 17, 18, 19, 20, 21]
const HOURS_BEFORE = [1, 2, 3, 4, 5, 6]
const satiTxt = n => n === 1 ? '1 sat' : n <= 4 ? `${n} sata` : `${n} sati`

function RemindSection({ worker, onWorkerChange }) {
  const [dayHour, setDayHour] = useState(worker.remind_day_hour ?? 19)
  const [hrs, setHrs] = useState(worker.remind_hours_before ?? 3)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [err, setErr] = useState(null)

  async function save() {
    setErr(null); setSaving(true)
    const { error } = await supabase.from('workers')
      .update({ remind_day_hour: Number(dayHour), remind_hours_before: Number(hrs) })
      .eq('id', worker.id)
    setSaving(false)
    if (error) { setErr(error.message); haptic('warning'); return }
    haptic('success'); setSaved(true); onWorkerChange?.()
    setTimeout(() => setSaved(false), 1800)
  }

  return (
    <div>
      <p className="tiny" style={{ marginBottom: 14 }}>
        Tvoji klijenti dobijaju notifikaciju na telefon pre zakazanog termina. Ovde biraš kada.
      </p>

      <div className="hourrow">
        <div className="hourrow-head">
          <b>Dan pre termina</b>
          <select value={dayHour} onChange={e => setDayHour(e.target.value)}>
            <option value={0}>Isključeno</option>
            {DAY_HOURS.map(h => <option key={h} value={h}>u {String(h).padStart(2, '0')}:00</option>)}
          </select>
        </div>
      </div>

      <div className="hourrow">
        <div className="hourrow-head">
          <b>Na dan termina</b>
          <select value={hrs} onChange={e => setHrs(e.target.value)}>
            <option value={0}>Isključeno</option>
            {HOURS_BEFORE.map(h => <option key={h} value={h}>{satiTxt(h)} pre</option>)}
          </select>
        </div>
      </div>

      {err && <p className="err">{err}</p>}
      <button className="btn" disabled={saving} onClick={save} style={{ marginTop: 14 }}>
        {saving ? 'Čuvam…' : saved ? '✓ Sačuvano' : 'Sačuvaj'}
      </button>
    </div>
  )
}

function NotifySection({ worker, salon }) {
  const [title, setTitle] = useState('')
  const [body, setBody] = useState('')
  const [sending, setSending] = useState(false)
  const [sent, setSent] = useState(false)
  const [err, setErr] = useState(null)

  async function send() {
    setErr(null)
    if (!title.trim() || !body.trim()) { setErr('Popuni naslov i poruku.'); return }
    setSending(true)
    const { error } = await supabase.from('notifications').insert({
      salon_id: salon.id, title: title.trim(), body: body.trim(),
    })
    setSending(false)
    if (error) { setErr(error.message); haptic('warning'); return }
    haptic('success'); setTitle(''); setBody(''); setSent(true)
    setTimeout(() => setSent(false), 2200)
  }

  return (
    <div>
      <p className="tiny" style={{ marginBottom: 14 }}>
        Poruka stiže odmah svim klijentima koji imaju aplikaciju, u njihov Obaveštenja tab.
      </p>
      <input className="f" placeholder="Naslov (npr. 'Radimo i sutra')" value={title} onChange={e => setTitle(e.target.value)} />
      <textarea className="f" rows={4} placeholder="Poruka…" value={body} onChange={e => setBody(e.target.value)}
        style={{ resize: 'vertical', fontFamily: 'inherit' }} />
      {err && <p className="err">{err}</p>}
      <button className="btn" disabled={sending} onClick={send}>
        {sending ? 'Šaljem…' : sent ? '✓ Poslato' : 'Pošalji svim klijentima'}
      </button>
    </div>
  )
}

function ServicesSection({ worker, vip = false }) {
  const [rows, setRows] = useState(null)
  const [editing, setEditing] = useState(null)   // id usluge koja se trenutno uredjuje
  const [form, setForm] = useState({ name_sr: '', duration_min: 30, price_rsd: '' })
  const [adding, setAdding] = useState(false)
  const [newForm, setNewForm] = useState({ name_sr: '', duration_min: 30, price_rsd: '' })
  const [err, setErr] = useState(null)
  const [uploadingId, setUploadingId] = useState(null)
  const [cropFor, setCropFor] = useState(null)   // { service, file }

  function load() {
    supabase.from('services').select('*').eq('worker_id', worker.id).eq('is_vip', vip).order('sort')
      .then(({ data }) => setRows(data || []))
  }
  useEffect(load, [worker.id, vip])

  async function uploadPhoto(service, file) {
    if (!file) return
    haptic('tap'); setUploadingId(service.id); setErr(null)
    const path = `${worker.id}/${service.id}.jpg`
    const { error: upErr } = await supabase.storage.from('service-photos')
      .upload(path, file, { upsert: true, cacheControl: '3600', contentType: 'image/jpeg' })
    if (upErr) { setErr(upErr.message); setUploadingId(null); haptic('warning'); return }
    const { data } = supabase.storage.from('service-photos').getPublicUrl(path)
    const url = `${data.publicUrl}?t=${Date.now()}`
    const { error: updErr } = await supabase.from('services').update({ image_url: url }).eq('id', service.id)
    setUploadingId(null)
    if (updErr) { setErr(updErr.message); haptic('warning'); return }
    haptic('success'); load()
  }

  function startEdit(s) {
    haptic('tap')
    setEditing(s.id)
    setForm({ name_sr: s.name_sr, duration_min: s.duration_min, price_rsd: s.price_rsd })
  }

  async function saveEdit(id) {
    setErr(null)
    if (!form.name_sr.trim() || !form.price_rsd) { setErr('Popuni naziv i cenu.'); return }
    const { error } = await supabase.from('services').update({
      name_sr: form.name_sr.trim(), duration_min: Number(form.duration_min), price_rsd: Number(form.price_rsd),
    }).eq('id', id)
    if (error) { setErr(error.message); haptic('warning'); return }
    haptic('success'); setEditing(null); load()
  }

  async function toggleActive(s) {
    haptic('tap')
    await supabase.from('services').update({ active: !s.active }).eq('id', s.id)
    load()
  }

  async function addService() {
    setErr(null)
    if (!newForm.name_sr.trim() || !newForm.price_rsd) { setErr('Popuni naziv i cenu.'); return }
    const maxSort = rows.reduce((m, r) => Math.max(m, r.sort || 0), 0)
    const { error } = await supabase.from('services').insert({
      worker_id: worker.id, name_sr: newForm.name_sr.trim(),
      duration_min: Number(newForm.duration_min), price_rsd: Number(newForm.price_rsd),
      active: true, sort: maxSort + 1, is_vip: vip,
    })
    if (error) { setErr(error.message); haptic('warning'); return }
    haptic('success'); setNewForm({ name_sr: '', duration_min: 30, price_rsd: '' }); setAdding(false); load()
  }

  if (rows === null) return <SkeletonRows count={3} />

  return (
    <div>
      {cropFor && (
        <ImageCropper file={cropFor.file} shape="square" onCancel={() => setCropFor(null)}
          onDone={blob => { const svc = cropFor.service; setCropFor(null); uploadPhoto(svc, blob) }} />
      )}
      {vip && rows.length === 0 && !adding && (
        <p className="tiny" style={{ marginBottom: 14 }}>Ovde dodaješ posebne VIP termine sa sopstvenom cenom — nezavisno od redovnog cenovnika.</p>
      )}
      {rows.map(s => (
        <div key={s.id} className="svc-edit-row" style={{ opacity: s.active ? 1 : 0.5 }}>
          {editing === s.id ? (
            <div>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 10 }}>
                {s.image_url ? (
                  <img src={s.image_url} alt="" style={{ width: 44, height: 44, borderRadius: 8, objectFit: 'cover' }} />
                ) : (
                  <div style={{ width: 44, height: 44, borderRadius: 8, background: 'var(--ink2)' }} />
                )}
                <label className="ghost" style={{ width: 'auto', padding: '7px 11px', fontSize: 12.5, cursor: 'pointer', position: 'relative', overflow: 'hidden' }}>
                  {uploadingId === s.id ? 'Otpremam…' : s.image_url ? 'Zameni sliku' : 'Dodaj sliku'}
                  <input type="file" accept="image/*" disabled={uploadingId === s.id}
                    onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) setCropFor({ service: s, file: f }) }}
                    style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
                </label>
              </div>
              <input className="f" value={form.name_sr} onChange={e => setForm(f => ({ ...f, name_sr: e.target.value }))} placeholder="Naziv usluge" />
              <div className="hourrow-times" style={{ marginBottom: 8 }}>
                <select value={form.duration_min} onChange={e => setForm(f => ({ ...f, duration_min: e.target.value }))}>
                  {DUR_OPTIONS.map(d => <option key={d} value={d}>{durTxt(d)}</option>)}
                </select>
                <input className="f" type="number" inputMode="numeric" value={form.price_rsd}
                  onChange={e => setForm(f => ({ ...f, price_rsd: e.target.value }))} placeholder="Cena (din)" style={{ marginBottom: 0 }} />
              </div>
              {err && <p className="err">{err}</p>}
              <div style={{ display: 'flex', gap: 8 }}>
                <button className="btn" style={{ marginTop: 0 }} onClick={() => saveEdit(s.id)}>Sačuvaj</button>
                <button className="ghost" onClick={() => { setEditing(null); setErr(null) }}>Otkaži</button>
              </div>
            </div>
          ) : (
            <div className="svc-edit-head" onClick={() => startEdit(s)}>
              {s.image_url ? (
                <img src={s.image_url} alt="" style={{ width: 36, height: 36, borderRadius: 7, objectFit: 'cover', flex: 'none' }} />
              ) : (
                <div style={{ width: 36, height: 36, borderRadius: 7, background: 'var(--ink2)', flex: 'none' }} />
              )}
              <span className="grow">
                <span className="name">{s.name_sr}</span><br/>
                <span className="tiny">{durTxt(s.duration_min)} · {din(s.price_rsd)}</span>
              </span>
              <button className="ghost" style={{ width: 'auto', padding: '7px 11px' }}
                onClick={e => { e.stopPropagation(); toggleActive(s) }}>
                {s.active ? 'Ugasi' : 'Vrati'}
              </button>
            </div>
          )}
        </div>
      ))}

      {adding ? (
        <div className="svc-edit-row">
          <input className="f" value={newForm.name_sr} onChange={e => setNewForm(f => ({ ...f, name_sr: e.target.value }))} placeholder="Naziv nove usluge" />
          <div className="hourrow-times" style={{ marginBottom: 8 }}>
            <select value={newForm.duration_min} onChange={e => setNewForm(f => ({ ...f, duration_min: e.target.value }))}>
              {DUR_OPTIONS.map(d => <option key={d} value={d}>{durTxt(d)}</option>)}
            </select>
            <input className="f" type="number" inputMode="numeric" value={newForm.price_rsd}
              onChange={e => setNewForm(f => ({ ...f, price_rsd: e.target.value }))} placeholder="Cena (din)" style={{ marginBottom: 0 }} />
          </div>
          {err && <p className="err">{err}</p>}
          <div style={{ display: 'flex', gap: 8 }}>
            <button className="btn" style={{ marginTop: 0 }} onClick={addService}>Dodaj</button>
            <button className="ghost" onClick={() => { setAdding(false); setErr(null) }}>Otkaži</button>
          </div>
        </div>
      ) : (
        <button className="ghost" style={{ width: '100%', marginTop: 4 }} onClick={() => { haptic('tap'); setAdding(true) }}>
          ＋ {vip ? 'Dodaj VIP termin' : 'Dodaj novu uslugu'}
        </button>
      )}
    </div>
  )
}

function TimeOffSection({ worker }) {
  const [rows, setRows] = useState(null)
  const [start, setStart] = useState('')
  const [end, setEnd] = useState('')
  const [note, setNote] = useState('')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState(null)

  function load() {
    supabase.from('worker_time_off').select('*').eq('worker_id', worker.id)
      .order('start_date').then(({ data }) => setRows(data || []))
  }
  useEffect(load, [worker.id])

  async function add() {
    setErr(null)
    if (!start || !end) { setErr('Izaberi oba datuma.'); return }
    if (end < start) { setErr('Krajnji datum mora biti posle početnog.'); return }
    setSaving(true)
    const { error } = await supabase.from('worker_time_off')
      .insert({ worker_id: worker.id, start_date: start, end_date: end, note: note.trim() || null })
    setSaving(false)
    if (error) { setErr(error.message); haptic('warning'); return }
    haptic('success'); setStart(''); setEnd(''); setNote(''); load()
  }

  async function remove(id) {
    haptic('tap')
    await supabase.from('worker_time_off').delete().eq('id', id)
    load()
  }

  const todayISO = new Date().toISOString().slice(0, 10)
  const fmtD = ds => { const d = new Date(ds+'T00:00:00'); return d.getDate()+'.'+(d.getMonth()+1)+'.'+d.getFullYear()+'.' }

  return (
    <div>
      <p className="tiny" style={{ marginBottom: 14 }}>
        Dodaj period kad ne radiš (godišnji, bolovanje, slobodan dan…) — klijenti neće moći da zakažu u tom periodu. Za kraće pauze u toku dana koristi "Blokiraj 30 min" na Rasporedu.
      </p>

      {rows === null ? <SkeletonRows count={2} /> : rows.length === 0 ? (
        <p className="tiny" style={{ marginBottom: 14 }}>Trenutno nema zakazanog odmora.</p>
      ) : rows.map(r => (
        <div key={r.id} className="timeoff-row">
          <span className="grow">
            <span className="name">{fmtD(r.start_date)} – {fmtD(r.end_date)}</span>
            {r.note && <><br/><span className="tiny">{r.note}</span></>}
          </span>
          <button className="tl-card-x" style={{ position: 'static' }} onClick={() => remove(r.id)}>Ukloni</button>
        </div>
      ))}

      <div className="eyebrow">Dodaj novi period</div>
      <div className="hourrow-times" style={{ marginBottom: 8 }}>
        <input className="f" type="date" min={todayISO} value={start} onChange={e => setStart(e.target.value)} />
        <span>–</span>
        <input className="f" type="date" min={start || todayISO} value={end} onChange={e => setEnd(e.target.value)} />
      </div>
      <input className="f" placeholder="Napomena (opciono, npr. 'Godišnji')" value={note} onChange={e => setNote(e.target.value)} />
      {err && <p className="err">{err}</p>}
      <button className="btn" disabled={saving} onClick={add}>{saving ? 'Čuvam…' : 'Dodaj period'}</button>
    </div>
  )
}

function PhotoSection({ worker, onWorkerChange }) {
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState(null)
  const [pending, setPending] = useState(null)   // izabrana slika koja ceka izrezivanje
  const c = catFor(worker.role_sr)

  function onPick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) { setErr(null); setPending(file) }
  }

  async function upload(blob) {
    setPending(null); setBusy(true); setErr(null)
    const path = `${worker.id}/avatar.jpg`
    const { error: upErr } = await supabase.storage.from('worker-photos')
      .upload(path, blob, { upsert: true, cacheControl: '3600', contentType: 'image/jpeg' })
    if (upErr) { setErr(upErr.message); setBusy(false); haptic('warning'); return }
    const { data } = supabase.storage.from('worker-photos').getPublicUrl(path)
    const url = `${data.publicUrl}?t=${Date.now()}`   // cache-bust da se odmah vidi nova slika
    const { error: updErr } = await supabase.from('workers').update({ photo_url: url }).eq('id', worker.id)
    setBusy(false)
    if (updErr) { setErr(updErr.message); haptic('warning'); return }
    haptic('success')
    onWorkerChange?.()
  }

  return (
    <div style={{ textAlign: 'center' }}>
      {worker.photo_url ? (
        <img src={worker.photo_url} alt="" className="photo-preview" />
      ) : (
        <div className="profile-avatar" style={{ background: `linear-gradient(150deg, ${c.from}, ${c.to})` }}>
          {initials(worker.name)}
        </div>
      )}
      <p className="tiny" style={{ margin: '14px 0' }}>Ova slika je vidljiva klijentima kod izbora tebe kao radnika.</p>
      <label className="btn" style={{ display: 'block', cursor: 'pointer' }}>
        {busy ? 'Otpremam…' : 'Izaberi novu sliku'}
        <input type="file" accept="image/*" onChange={onPick} disabled={busy}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0 }} />
      </label>
      {err && <p className="err" style={{ marginTop: 8 }}>{err}</p>}
      {pending && <ImageCropper file={pending} shape="circle" onCancel={() => setPending(null)} onDone={upload} />}
    </div>
  )
}

function ProfileSection({ worker, salon }) {
  const c = catFor(worker.role_sr)
  return (
    <div style={{ textAlign: 'center' }}>
      {worker.photo_url ? (
        <img src={worker.photo_url} alt="" className="profile-avatar" style={{ objectFit: 'cover' }} />
      ) : (
        <div className="profile-avatar" style={{ background: `linear-gradient(150deg, ${c.from}, ${c.to})` }}>
          {initials(worker.name)}
        </div>
      )}
      <div style={{ fontFamily: 'Fraunces, serif', fontSize: 21, color: 'var(--text)' }}>{worker.name}</div>
      <div className="tiny" style={{ marginTop: 2 }}>{worker.role_sr}</div>
      <div className="tiny" style={{ marginTop: 10 }}>{salon.name}</div>
      <button className="ghost" style={{ width: '100%', marginTop: 18 }}
        onClick={() => { haptic('tap'); supabase.auth.signOut() }}>
        Odjavi se
      </button>
    </div>
  )
}

function HoursSection({ worker, salon }) {
  const [rows, setRows] = useState(null)   // { [dow]: {is_off, opens_min, closes_min} | null(=isto kao salon) }
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => {
    supabase.from('worker_hours').select('*').eq('worker_id', worker.id)
      .then(({ data }) => {
        const map = {}
        DOW_ORDER.forEach(d => { map[d] = null })
        ;(data || []).forEach(r => { map[r.dow] = { is_off: r.is_off, opens_min: r.opens_min, closes_min: r.closes_min } })
        setRows(map)
      })
  }, [worker.id])

  function setMode(d, mode) {
    haptic('tap')
    setRows(r => ({ ...r, [d]: mode === 'salon' ? null : mode === 'off' ? { is_off: true, opens_min: null, closes_min: null }
      : { is_off: false, opens_min: salon.opens_min, closes_min: salon.closes_min } }))
  }
  function setTime(d, field, val) {
    setRows(r => ({ ...r, [d]: { ...r[d], [field]: Number(val) } }))
  }

  async function save() {
    setSaving(true)
    await supabase.from('worker_hours').delete().eq('worker_id', worker.id)
    const toInsert = DOW_ORDER.filter(d => rows[d] !== null).map(d => ({ worker_id: worker.id, dow: d, ...rows[d] }))
    if (toInsert.length) await supabase.from('worker_hours').insert(toInsert)
    setSaving(false); setSaved(true); haptic('success')
    setTimeout(() => setSaved(false), 1800)
  }

  if (rows === null) return <SkeletonRows count={3} />

  return (
    <div>
      <p className="tiny" style={{ marginBottom: 14 }}>
        Salon inače radi {fmtHM(salon.opens_min)}–{fmtHM(salon.closes_min)}. Ovde možeš da podesiš drugačije vreme za pojedine dane, ili da uzmeš slobodan dan.
      </p>
      {DOW_ORDER.map(d => {
        const cfg = rows[d]
        const mode = cfg === null ? 'salon' : cfg.is_off ? 'off' : 'custom'
        return (
          <div key={d} className="hourrow">
            <div className="hourrow-head">
              <b>{DOW_LABEL[d]}</b>
              <select value={mode} onChange={e => setMode(d, e.target.value)}>
                <option value="salon">Kao salon</option>
                <option value="custom">Prilagođeno</option>
                <option value="off">Ne radi</option>
              </select>
            </div>
            {mode === 'custom' && (
              <div className="hourrow-times">
                <select value={cfg.opens_min} onChange={e => setTime(d, 'opens_min', e.target.value)}>
                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{fmtHM(t)}</option>)}
                </select>
                <span>–</span>
                <select value={cfg.closes_min} onChange={e => setTime(d, 'closes_min', e.target.value)}>
                  {TIME_OPTIONS.map(t => <option key={t} value={t}>{fmtHM(t)}</option>)}
                </select>
              </div>
            )}
          </div>
        )
      })}
      <button className="btn" disabled={saving} onClick={save} style={{ marginTop: 14 }}>
        {saving ? 'Čuvam…' : saved ? '✓ Sačuvano' : 'Sačuvaj radno vreme'}
      </button>
    </div>
  )
}