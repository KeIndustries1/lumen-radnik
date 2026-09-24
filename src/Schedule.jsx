import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { supabase } from './lib/supabase'
import ClientProfile from './ClientProfile'
import { SkeletonRows } from './Skeleton'
import { haptic } from './lib/haptic'
import { motion, AnimatePresence } from 'framer-motion'
import { Phone, X, CalendarDays, Plus, ChevronLeft, ChevronRight } from 'lucide-react'

const fmt = m => String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0')
const dur = m => m>=60 ? (m%60 ? Math.floor(m/60)+'h '+(m%60)+'min' : Math.floor(m/60)+'h') : m+'min'
const din = v => v.toLocaleString('sr-RS') + ' din'
const iso = d => { const x=new Date(d); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0') }
const todayISO = iso(new Date())
const addDays = (ds, n) => { const d = new Date(ds+'T00:00:00'); d.setDate(d.getDate()+n); return iso(d) }
const weekStart = ds => { const d = new Date(ds+'T00:00:00'); return addDays(ds, -((d.getDay()+6)%7)) }   // ponedeljak

const MONTHS = ['Januar','Februar','Mart','April','Maj','Jun','Jul','Avgust','Septembar','Oktobar','Novembar','Decembar']
const DOW = ['Pon','Uto','Sre','Čet','Pet','Sub','Ned']

const PX = 2   // piksela po minutu → 15 min = 30px, 1h = 120px

export default function Schedule({ worker, salon }) {
  const [date, setDate] = useState(todayISO)
  const [rows, setRows] = useState(null)
  const [busyDays, setBusyDays] = useState(new Set())
  const [showBook, setShowBook] = useState(false)
  const [bookAtTime, setBookAtTime] = useState(null)
  const [openClient, setOpenClient] = useState(null)
  const dateInputRef = useRef(null)

  // radno vreme salona, zaokruženo na cele sate
  const dayStart = Math.floor((salon?.opens_min ?? 9*60) / 60) * 60
  const dayEnd = Math.ceil((salon?.closes_min ?? 20*60) / 60) * 60

  function load() {
    supabase.from('appointments')
      .select('id, kind, appt_date, start_min, duration_min, note, status, clients(id, name, phone, email), appointment_services(services(name_sr))')
      .eq('worker_id', worker.id).eq('appt_date', date).eq('status', 'confirmed')
      .order('start_min')
      .then(({ data }) => setRows(data || []))
  }
  useEffect(load, [date, worker.id])

  // tačkice ispod dana koji imaju termine
  const wk = weekStart(date)
  useEffect(() => {
    supabase.from('appointments').select('appt_date')
      .eq('worker_id', worker.id).eq('kind', 'appt').eq('status', 'confirmed')
      .gte('appt_date', wk).lte('appt_date', addDays(wk, 6))
      .then(({ data }) => setBusyDays(new Set((data || []).map(r => r.appt_date))))
  }, [wk, worker.id, rows])

  async function unblock(id) { haptic('tap'); await supabase.from('appointments').delete().eq('id', id); load() }
  async function cancel(a) {
    if (!window.confirm(`Otkazati termin u ${fmt(a.start_min)}${a.clients?.name ? ' — ' + a.clients.name : ''}?`)) return
    haptic('warning'); await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', a.id); load()
  }

  function pick(d) { if (d !== date) { haptic('tap'); setDate(d) } }
  function openBookAt(m) { haptic('tap'); setBookAtTime(m); setShowBook(true) }
  function openCalendarPicker() {
    haptic('tap')
    const el = dateInputRef.current
    if (el?.showPicker) el.showPicker(); else el?.click()
  }

  const d = new Date(date+'T00:00:00')

  return (
    <div>
      <style>{CSS}</style>

      <div className="sch-head">
        <button className="sch-icon" onClick={openCalendarPicker} aria-label="Kalendar"><CalendarDays size={18} strokeWidth={1.75} /></button>
        <b className="sch-month">{MONTHS[d.getMonth()]} {d.getFullYear()}</b>
        {date !== todayISO && <button className="sch-today" onClick={() => pick(todayISO)}>Danas</button>}
        <button className="sch-icon accent" onClick={() => { haptic('tap'); setBookAtTime(null); setShowBook(true) }} aria-label="Novi termin">
          <Plus size={18} strokeWidth={2} />
        </button>
        <input ref={dateInputRef} type="date" value={date} onChange={e => e.target.value && pick(e.target.value)}
          style={{ position: 'absolute', width: 1, height: 1, opacity: 0, pointerEvents: 'none' }} />
      </div>

      <WeekStrip date={date} busyDays={busyDays} onPick={pick} />

      {rows === null ? <SkeletonRows count={3} /> : (
        <AnimatePresence mode="wait">
          <motion.div key={date}
            initial={{ opacity: 0, x: 14 }} animate={{ opacity: 1, x: 0 }} exit={{ opacity: 0, x: -14 }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}>
            <DayTimeline rows={rows} date={date} start={dayStart} end={dayEnd}
              onSwipe={n => pick(addDays(date, n))}
              onUnblock={unblock} onCancel={cancel} onOpenClient={setOpenClient} onQuickAdd={openBookAt} />
          </motion.div>
        </AnimatePresence>
      )}
      {openClient && <ClientProfile client={openClient} salon={salon} onClose={() => setOpenClient(null)} />}

      <button className="ghost" style={{ marginTop: 12, width: '100%' }}
        onClick={() => { haptic('tap'); blockQuick(worker.id, date, dayStart, load) }}>
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

// ================= Traka sa danima =================
function WeekStrip({ date, busyDays, onPick }) {
  const mon = weekStart(date)
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i))
  const touch = useRef(null)

  function onTouchStart(e) { touch.current = e.touches[0].clientX }
  function onTouchEnd(e) {
    if (touch.current === null) return
    const dx = e.changedTouches[0].clientX - touch.current
    touch.current = null
    if (Math.abs(dx) > 45) onPick(addDays(date, dx < 0 ? 7 : -7))   // swipe = cela nedelja
  }

  return (
    <div className="sch-week" onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      <button className="sch-wnav" onClick={() => onPick(addDays(date, -7))} aria-label="Prethodna nedelja">
        <ChevronLeft size={16} strokeWidth={1.75} />
      </button>
      <div className="sch-days">
        {days.map((ds, i) => {
          const sel = ds === date, today = ds === todayISO
          return (
            <button key={ds} className={'sch-day' + (sel ? ' sel' : '') + (today ? ' today' : '')} onClick={() => onPick(ds)}>
              <span className="sch-dow">{DOW[i]}</span>
              <span className="sch-num">{Number(ds.slice(8))}</span>
              <span className={'sch-dot' + (busyDays.has(ds) ? ' on' : '')} />
            </button>
          )
        })}
      </div>
      <button className="sch-wnav" onClick={() => onPick(addDays(date, 7))} aria-label="Sledeća nedelja">
        <ChevronRight size={16} strokeWidth={1.75} />
      </button>
    </div>
  )
}

// ================= Vremenska osa + kartice =================
function DayTimeline({ rows, date, start, end, onSwipe, onUnblock, onCancel, onOpenClient, onQuickAdd }) {
  const height = (end - start) * PX
  const ticks = []
  for (let m = start; m <= end; m += 15) ticks.push(m)

  const hours = []
  for (let m = start; m < end; m += 60) hours.push(m)
  const isHourFree = h => !rows.some(a => a.start_min < h + 60 && a.start_min + a.duration_min > h)

  // linija "sada"
  const [nowMin, setNowMin] = useState(() => { const n = new Date(); return n.getHours()*60 + n.getMinutes() })
  useEffect(() => {
    const t = setInterval(() => { const n = new Date(); setNowMin(n.getHours()*60 + n.getMinutes()) }, 60000)
    return () => clearInterval(t)
  }, [])
  const showNow = date === todayISO && nowMin >= start && nowMin <= end

  // swipe levo/desno = sledeći/prethodni dan
  const touch = useRef(null)
  function onTouchStart(e) { touch.current = { x: e.touches[0].clientX, y: e.touches[0].clientY } }
  function onTouchEnd(e) {
    if (!touch.current) return
    const dx = e.changedTouches[0].clientX - touch.current.x
    const dy = e.changedTouches[0].clientY - touch.current.y
    touch.current = null
    if (Math.abs(dx) > 70 && Math.abs(dx) > Math.abs(dy) * 1.5) onSwipe(dx < 0 ? 1 : -1)
  }

  return (
    <div className="sch-tl" style={{ height: height + 20 }} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
      {/* osa */}
      {ticks.map(m => {
        const major = m % 60 === 0
        return (
          <div key={m} className={'sch-tick' + (major ? ' major' : '')} style={{ top: 10 + (m - start) * PX }}>
            <span className="sch-label">{major ? fmt(m) : m % 60}</span>
            <span className="sch-line" />
          </div>
        )
      })}

      <div className="sch-events" style={{ top: 10, height }}>
        {/* slobodni sati */}
        {hours.filter(isHourFree).map(h => (
          <button key={h} className="sch-plus" style={{ top: (h - start) * PX + 2, height: 60 * PX - 4 }}
            onClick={() => onQuickAdd(h)}>＋</button>
        ))}

        {/* termini */}
        {rows.map(a => {
          const top = (a.start_min - start) * PX + 1
          const h = Math.max(a.duration_min * PX - 2, 20)   // tačno koliko traje
          const compact = h < 46
          const timeTxt = `${fmt(a.start_min)}–${fmt(a.start_min + a.duration_min)}`

          if (a.kind === 'block') {
            return (
              <div key={a.id} className={'sch-card blk' + (compact ? ' compact' : '')} style={{ top, height: h }}
                onClick={() => onUnblock(a.id)}>
                <span className="sch-time">{timeTxt}</span>
                <span className="sch-name">{a.note || 'Pauza'}</span>
              </div>
            )
          }

          const services = a.appointment_services.map(x => x.services.name_sr).join(' + ')
          return (
            <div key={a.id} className={'sch-card' + (compact ? ' compact' : '')} style={{ top, height: h }}
              onClick={() => a.clients && onOpenClient(a.clients)}>
              <div className="sch-body">
                <div className="sch-row1">
                  <span className="sch-time">{timeTxt}</span>
                  <span className="sch-name">{a.clients?.name || '—'}</span>
                </div>
                {!compact && <div className="sch-sub">{services}</div>}
              </div>
              <div className="sch-actions">
                {a.clients?.phone && (
                  <a className="sch-btn" href={`tel:${a.clients.phone.replace(/\s/g,'')}`}
                    onClick={e => e.stopPropagation()} aria-label="Pozovi">
                    <Phone size={12} strokeWidth={1.75} />
                  </a>
                )}
                <button className="sch-btn" onClick={e => { e.stopPropagation(); onCancel(a) }} aria-label="Otkaži">
                  <X size={12} strokeWidth={2} />
                </button>
              </div>
            </div>
          )
        })}

        {showNow && <div className="sch-now" style={{ top: (nowMin - start) * PX }} />}
      </div>
    </div>
  )
}

// blokira narednih 30 min (danas od sledećih punih 15 min, drugi dan od otvaranja)
async function blockQuick(workerId, date, dayStart, reload) {
  let startMin = dayStart
  if (date === todayISO) {
    const n = new Date()
    startMin = Math.max(dayStart, Math.ceil((n.getHours()*60 + n.getMinutes()) / 15) * 15)
  }
  const { error } = await supabase.from('appointments').insert({
    worker_id: workerId, kind: 'block', appt_date: date, start_min: startMin, duration_min: 30, note: 'Pauza',
  })
  if (error) { haptic('warning'); alert(error.code === '23P01' ? 'Tih 30 minuta je već zauzeto.' : error.message); return }
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

// ================= Stilovi (samo za raspored) =================
const CSS = `
.sch-head { display:flex; align-items:center; gap:8px; padding:4px 0 10px; }
.sch-month { flex:1; font-family:'Fraunces', serif; font-size:21px; color:var(--text); }
.sch-icon { width:36px; height:36px; border-radius:10px; display:grid; place-items:center;
  background:var(--card); border:1px solid var(--line); color:var(--text); padding:0; flex:none; }
.sch-icon.accent { background:var(--rouge); border-color:var(--rouge); color:#fff; }
.sch-today { height:30px; padding:0 12px; border-radius:15px; font-size:12.5px;
  background:transparent; border:1px solid var(--rouge); color:var(--rouge); flex:none; }

.sch-week { display:flex; align-items:center; gap:2px; margin-bottom:14px;
  background:var(--card); border:1px solid var(--line); border-radius:14px; padding:8px 4px; }
.sch-wnav { width:24px; height:44px; padding:0; border:none; background:none; color:var(--text); opacity:.45; flex:none; }
.sch-days { flex:1; display:grid; grid-template-columns:repeat(7, 1fr); }
.sch-day { display:flex; flex-direction:column; align-items:center; gap:4px; padding:2px 0;
  background:none; border:none; color:var(--text); }
.sch-dow { font-size:11px; opacity:.55; }
.sch-num { width:32px; height:32px; border-radius:50%; display:grid; place-items:center;
  font-size:14px; font-weight:600; transition:background .15s, color .15s; }
.sch-day.today .sch-num { color:var(--rouge); }
.sch-day.sel .sch-num { background:var(--rouge); color:#fff; }
.sch-dot { width:4px; height:4px; border-radius:50%; background:transparent; }
.sch-dot.on { background:var(--rouge); opacity:.8; }
.sch-day.sel .sch-dot.on { opacity:.4; }

.sch-tl { position:relative; margin-top:4px; touch-action:pan-y; }
.sch-tick { position:absolute; left:0; right:0; height:0; }
.sch-label { position:absolute; left:0; width:44px; transform:translateY(-50%);
  text-align:right; font-size:10.5px; color:var(--text); opacity:.4; font-variant-numeric:tabular-nums; }
.sch-tick.major .sch-label { font-size:12.5px; font-weight:700; opacity:.9; }
.sch-line { position:absolute; left:52px; right:0; top:0; border-top:1px solid var(--line); opacity:.35; }
.sch-tick.major .sch-line { opacity:1; }

.sch-events { position:absolute; left:56px; right:0; }
.sch-plus { position:absolute; left:0; right:0; border:1px dashed var(--line); border-radius:10px;
  background:transparent; color:var(--text); opacity:0; font-size:18px; transition:opacity .15s; }
.sch-plus:active, .sch-plus:hover { opacity:.35; }

.sch-card { position:absolute; left:0; right:0; display:flex; gap:6px; overflow:hidden;
  background:var(--card); border:1px solid var(--line); border-left:3px solid var(--rouge);
  border-radius:9px; padding:6px 6px 6px 9px; cursor:pointer; box-sizing:border-box; }
.sch-card.compact { align-items:center; padding-top:0; padding-bottom:0; }
.sch-body { flex:1; min-width:0; }
.sch-row1 { display:flex; gap:7px; align-items:baseline; min-width:0; }
.sch-time { font-size:11.5px; font-weight:700; color:var(--text); white-space:nowrap; font-variant-numeric:tabular-nums; }
.sch-name { font-size:13px; font-weight:600; color:var(--text); white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
.sch-sub { font-size:12px; color:var(--text); opacity:.6; margin-top:3px;
  display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden; }
.sch-actions { display:flex; gap:4px; align-items:flex-start; flex:none; }
.sch-card.compact .sch-actions { align-items:center; }
.sch-btn { width:24px; height:24px; border-radius:7px; display:grid; place-items:center; padding:0;
  background:transparent; border:1px solid var(--line); color:var(--text); opacity:.75; }

.sch-card.blk { border-left-color:var(--line); gap:7px; align-items:baseline;
  background:repeating-linear-gradient(135deg, transparent 0 6px, var(--line) 6px 7px), var(--card); opacity:.8; }
.sch-card.blk.compact { align-items:center; }

.sch-now { position:absolute; left:-6px; right:0; height:0; border-top:2px solid var(--rouge); z-index:3; pointer-events:none; }
.sch-now::before { content:''; position:absolute; left:-4px; top:-6px; width:10px; height:10px; border-radius:50%; background:var(--rouge); }
`