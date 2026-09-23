import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './lib/supabase'
import ClientProfile from './ClientProfile'
import { SkeletonRows } from './Skeleton'
import { haptic } from './lib/haptic'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone } from 'lucide-react'

const fmt = m => String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0')
const dur = m => m>=60 ? (m%60 ? Math.floor(m/60)+'h '+(m%60)+'min' : Math.floor(m/60)+'h') : m+'min'
const din = v => v.toLocaleString('sr-RS') + ' din'
const iso = d => { const x=new Date(d); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0') }
const todayISO = iso(new Date())
const DAY_START = 9*60, DAY_END = 20*60, PX_PER_MIN = 1.7  // 9-20h, 60min = 102px visine

export default function Schedule({ worker, salon }) {
  const [date, setDate] = useState(todayISO)
  const [rows, setRows] = useState(null)
  const [showBook, setShowBook] = useState(false)
  const [bookAtTime, setBookAtTime] = useState(null)   // sat na koji je kliknuto "+" (predpopunjava vreme)
  const [openClient, setOpenClient] = useState(null)
  const dateInputRef = useRef(null)

  function load() {
    supabase.from('appointments')
      .select('id, kind, appt_date, start_min, duration_min, note, status, clients(id, name, phone, email), appointment_services(services(name_sr))')
      .eq('worker_id', worker.id).eq('appt_date', date).eq('status', 'confirmed')
      .order('start_min')
      .then(({ data }) => setRows(data || []))
  }
  useEffect(load, [date, worker.id])

  async function unblock(id) { haptic('tap'); await supabase.from('appointments').delete().eq('id', id); load() }
  async function cancel(id) { haptic('warning'); await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id); load() }

  function changeDate(d) { haptic('tap'); setDate(d) }
  function shiftDay(n) { haptic('tap'); setDate(iso(shift(date, n))) }
  function openBookAt(hourMin) { haptic('tap'); setBookAtTime(hourMin); setShowBook(true) }
  function openCalendarPicker() {
    haptic('tap')
    const el = dateInputRef.current
    if (el?.showPicker) el.showPicker(); else el?.click()
  }

  return (
    <div>
      <div className="pagehead"><h2>Raspored</h2></div>
      <div className="dbar">
        <button className="nav" onClick={() => shiftDay(-1)}>‹</button>
        <b className="grow" style={{ textAlign: 'center' }}>{dayTitle(date)}</b>
        <button className="nav" onClick={() => shiftDay(1)}>›</button>
        <button className="nav" onClick={openCalendarPicker}>📅</button>
        <input ref={dateInputRef} type="date" value={date} onChange={e => changeDate(e.target.value)}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
        <button className="nav dark" onClick={() => { haptic('tap'); setBookAtTime(null); setShowBook(true) }}>＋</button>
      </div>

      {rows===null ? <SkeletonRows count={3} /> : (
        <AnimatePresence mode="wait">
          <motion.div key={date}
            initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}>
            <DayTimeline rows={rows} onUnblock={unblock} onCancel={cancel} onOpenClient={setOpenClient} onQuickAdd={openBookAt} />
          </motion.div>
        </AnimatePresence>
      )}
      {openClient && <ClientProfile client={openClient} salon={salon} onClose={() => setOpenClient(null)} />}

      <button className="ghost" style={{marginTop:12, width:'100%'}} onClick={()=>{ haptic('tap'); blockQuick(worker.id, date, load) }}>
        ＋ Blokiraj sledećih 30 min
      </button>

      {showBook && (
        <BookForClient worker={worker} salon={salon} date={date} initialTime={bookAtTime}
          onDone={() => { setShowBook(false); load() }}
          onClose={() => setShowBook(false)} />
      )}
    </div>
  )
}

function DayTimeline({ rows, onUnblock, onCancel, onOpenClient, onQuickAdd }) {
  const hours = []
  for (let h = DAY_START/60; h <= DAY_END/60; h++) hours.push(h)
  const totalH = (DAY_END - DAY_START) / 60

  function isHourFree(h) {
    const start = h*60, end = start+60
    return !rows.some(a => a.start_min < end && a.start_min + a.duration_min > start)
  }

  return (
    <div className="timeline">
      <div className="tl-hours" style={{ height: totalH * 60 * PX_PER_MIN }}>
        {hours.map(h => (
          <div key={h} className="tl-hour" style={{ top: (h*60 - DAY_START) * PX_PER_MIN }}>
            <span>{String(h).padStart(2,'0')}:00</span>
            <div className="tl-hourline" />
          </div>
        ))}
      </div>

      <div className="tl-events" style={{ height: totalH * 60 * PX_PER_MIN }}>
        {hours.slice(0, -1).filter(h => isHourFree(h)).map(h => (
          <button key={h} className="tl-plus"
            style={{ top: (h*60 - DAY_START) * PX_PER_MIN, height: 60 * PX_PER_MIN - 3 }}
            onClick={() => onQuickAdd(h*60)}>＋</button>
        ))}
        {rows.map(a => {
          const top = Math.max(0, (a.start_min - DAY_START) * PX_PER_MIN)
          const height = Math.max(34, a.duration_min * PX_PER_MIN - 3)
          if (a.kind === 'block') {
            return (
              <div key={a.id} className="tl-card blk" style={{ top, height }} onClick={() => onUnblock(a.id)}>
                <span className="tl-card-time">{fmt(a.start_min)}</span>
                <span className="tl-card-name">{a.note || 'Pauza'}</span>
                {height > 50 && <span className="tl-card-sub">zatvoreno za zakazivanje</span>}
              </div>
            )
          }
          return (
            <div key={a.id} className="tl-card" style={{ top, height }}
              onClick={() => a.clients && onOpenClient(a.clients)}>
              <span className="tl-card-time">{fmt(a.start_min)}</span>
              <span className="tl-card-div" />
              <span className="tl-card-mid">
                <span className="tl-card-name">{a.clients?.name || '—'}</span>
                <span className="tl-card-sub">{a.appointment_services.map(x=>x.services.name_sr).join(' + ')}</span>
              </span>
              {a.clients?.phone && (
                <a className="tl-card-call" href={`tel:${a.clients.phone.replace(/\s/g,'')}`}
                  onClick={e => e.stopPropagation()}>
                  <Phone size={12} strokeWidth={1.75} />
                </a>
              )}
              {height > 58 && (
                <button className="tl-card-x" onClick={(e)=>{ e.stopPropagation(); onCancel(a.id) }}>Otkaži</button>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}

async function blockQuick(workerId, date, reload) {
  await supabase.from('appointments').insert({
    worker_id: workerId, kind: 'block', appt_date: date, start_min: 9*60, duration_min: 30, note: 'Pauza',
  })
  reload()
}

function BookForClient({ worker, salon, date, initialTime, onDone, onClose }) {
  const [step, setStep] = useState(1)
  const [q, setQ] = useState('')
  const [results, setResults] = useState([])
  const [client, setClient] = useState(null)
  const [newName, setNewName] = useState('')
  const [newPhone, setNewPhone] = useState('')
  const [services, setServices] = useState([])
  const [chosen, setChosen] = useState([])
  const [slots, setSlots] = useState([])
  const [time, setTime] = useState(null)
  const [err, setErr] = useState(null)

  useEffect(() => {
    supabase.from('services').select('*').eq('worker_id', worker.id).eq('active', true).order('sort')
      .then(({ data }) => setServices(data || []))
  }, [worker.id])

  function search(v) {
    setQ(v)
    if (v.length < 2) { setResults([]); return }
    supabase.from('clients').select('*').eq('salon_id', salon.id)
      .or(`name.ilike.%${v}%,phone.ilike.%${v}%`).limit(8)
      .then(({ data }) => setResults(data || []))
  }

  async function addNewClient() {
    if (!newName.trim()) return
    const { data, error } = await supabase.from('clients')
      .insert({ salon_id: salon.id, name: newName.trim(), phone: newPhone.trim() })
      .select().single()
    if (error) { setErr(error.message); return }
    setClient(data); setStep(2)
  }

  function toggleService(id) { setChosen(c => c.includes(id) ? c.filter(x=>x!==id) : [...c, id]); setTime(null) }
  const totalDur = () => chosen.reduce((a,id) => a + services.find(s=>s.id===id).duration_min, 0)

  function goSlots() {
    supabase.rpc('available_slots', { p_worker: worker.id, p_date: date, p_duration: totalDur() })
      .then(({ data }) => {
        const list = (data||[]).map(r=>r.start_min)
        setSlots(list)
        if (initialTime !== null && list.includes(initialTime)) setTime(initialTime)
      })
    setStep(3)
  }

  async function confirm() {
    setErr(null)
    const { data: appt, error } = await supabase.from('appointments').insert({
      salon_id: salon.id, worker_id: worker.id, client_id: client.id,
      kind: 'appt', appt_date: date, start_min: time, duration_min: totalDur(),
    }).select().single()
    if (error) { setErr(error.code==='23P01' ? 'Termin je zauzet — izaberite drugo vreme.' : error.message); return }
    await supabase.from('appointment_services').insert(
      chosen.map(id => { const s=services.find(x=>x.id===id); return { appointment_id: appt.id, service_id: id, price_rsd: s.price_rsd, duration_min: s.duration_min } })
    )
    onDone()
  }

  return createPortal((
    <div className="sheet" onClick={e=>{ if(e.target===e.currentTarget) onClose() }}>
      <div className="inner">
        {step===1 && (
          <div>
            <h2>Za koga zakazujete?</h2>
            <input className="f" placeholder="Pretraga imenika" value={q} onChange={e=>search(e.target.value)} />
            {results.map(c => (
              <button key={c.id} className="pick" onClick={()=>{ setClient(c); setStep(2) }}>
                <span className="grow"><span className="name">{c.name}</span><br/><span className="tiny">{c.phone}</span></span>
              </button>
            ))}
            <div className="eyebrow">Novi klijent</div>
            <input className="f" placeholder="Ime i prezime" value={newName} onChange={e=>setNewName(e.target.value)} />
            <input className="f" placeholder="Telefon" value={newPhone} onChange={e=>setNewPhone(e.target.value)} />
            <button className="ghost" style={{width:'100%'}} onClick={addNewClient}>Dodaj i nastavi</button>
            <button className="ghost" style={{width:'100%', marginTop:8}} onClick={onClose}>Odustani</button>
          </div>
        )}
        {step===2 && client && (
          <div>
            <h2>{client.name}</h2>
            {services.map(s => (
              <button key={s.id} className={'pick'+(chosen.includes(s.id)?' sel':'')} onClick={()=>toggleService(s.id)}>
                <span className="chk">{chosen.includes(s.id)?'✓':''}</span>
                <span className="grow"><span className="name">{s.is_vip && <span className="vip-badge">VIP</span>}{s.name_sr}</span><br/><span className="tiny">{dur(s.duration_min)}</span></span>
                <span className="price">{din(s.price_rsd)}</span>
              </button>
            ))}
            {chosen.length>0 && <button className="btn" onClick={goSlots}>Dalje · {dur(totalDur())}</button>}
            <button className="ghost" style={{width:'100%', marginTop:8}} onClick={onClose}>Odustani</button>
          </div>
        )}
        {step===3 && (
          <div>
            <h2>Vreme — {date}</h2>
            <div className="slots">
              {slots.map(t => <button key={t} className={'slot'+(time===t?' on':'')} onClick={()=>setTime(t)}>{fmt(t)}</button>)}
            </div>
            {err && <p style={{color:'#A8324F'}}>{err}</p>}
            {time!==null && <button className="btn" onClick={confirm}>Zakaži {fmt(time)}</button>}
            <button className="ghost" style={{width:'100%', marginTop:8}} onClick={onClose}>Odustani</button>
          </div>
        )}
      </div>
    </div>
  ), document.body)
}

function shift(ds, n) { const d = new Date(ds+'T00:00:00'); d.setDate(d.getDate()+n); return d }
function dayTitle(ds) {
  const d = new Date(ds+'T00:00:00')
  if (ds===todayISO) return 'Danas'
  return d.getDate()+'.'+(d.getMonth()+1)+'.'
}