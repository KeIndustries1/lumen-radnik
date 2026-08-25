import { useEffect, useState } from 'react'
import { supabase } from './lib/supabase'
import ClientProfile from './ClientProfile'

const fmt = m => String(Math.floor(m/60)).padStart(2,'0') + ':' + String(m%60).padStart(2,'0')
const dur = m => m>=60 ? (m%60 ? Math.floor(m/60)+'h '+(m%60)+'min' : Math.floor(m/60)+'h') : m+'min'
const din = v => v.toLocaleString('sr-RS') + ' din'
const iso = d => { const x=new Date(d); return x.getFullYear()+'-'+String(x.getMonth()+1).padStart(2,'0')+'-'+String(x.getDate()).padStart(2,'0') }
const DOW = ['pon','uto','sre','čet','pet','sub','ned']
const todayISO = iso(new Date())
const DAY_START = 9*60, DAY_END = 20*60, PX_PER_MIN = 1.7  // 9-20h, 60min = 102px visine

export default function Schedule({ worker, salon }) {
  const [date, setDate] = useState(todayISO)
  const [rows, setRows] = useState(null)
  const [showBook, setShowBook] = useState(false)
  const [openClient, setOpenClient] = useState(null)

  function load() {
    supabase.from('appointments')
      .select('id, kind, appt_date, start_min, duration_min, note, status, clients(id, name, phone), appointment_services(services(name_sr))')
      .eq('worker_id', worker.id).eq('appt_date', date).eq('status', 'confirmed')
      .order('start_min')
      .then(({ data }) => setRows(data || []))
  }
  useEffect(load, [date, worker.id])

  async function unblock(id) { await supabase.from('appointments').delete().eq('id', id); load() }
  async function cancel(id) { await supabase.from('appointments').update({ status: 'cancelled' }).eq('id', id); load() }

  const week = weekOf(date)

  return (
    <div>
      <div className="pagehead"><h2>Raspored</h2></div>
      <div className="dbar">
        <b className="grow">{dayTitle(date)}</b>
        <button className="nav" onClick={() => setDate(iso(shift(date, -1)))}>‹</button>
        <button className="nav" onClick={() => setDate(iso(shift(date, 1)))}>›</button>
        <button className="nav dark" onClick={() => setShowBook(true)}>＋</button>
      </div>

      <div className="week">
        {week.map(d => (
          <button key={iso(d)} className={'wd' + (iso(d)===date?' on':d.getDay()===0?' off':'')} onClick={()=>setDate(iso(d))}>
            <small>{DOW[(d.getDay()+6)%7]}</small><b>{d.getDate()}</b>
          </button>
        ))}
      </div>

      {rows===null ? <p className="tiny">Učitavanje…</p> : (
        <DayTimeline rows={rows} onUnblock={unblock} onCancel={cancel} onOpenClient={setOpenClient} />
      )}
      {openClient && <ClientProfile client={openClient} salon={salon} onClose={() => setOpenClient(null)} />}

      <button className="ghost" style={{marginTop:12, width:'100%'}} onClick={()=>blockQuick(worker.id, date, load)}>
        ＋ Blokiraj sledećih 30 min
      </button>

      {showBook && (
        <BookForClient worker={worker} salon={salon} date={date}
          onDone={() => { setShowBook(false); load() }}
          onClose={() => setShowBook(false)} />
      )}
    </div>
  )
}

function DayTimeline({ rows, onUnblock, onCancel, onOpenClient }) {
  const hours = []
  for (let h = DAY_START/60; h <= DAY_END/60; h++) hours.push(h)
  const totalH = (DAY_END - DAY_START) / 60

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
        {rows.length === 0 && (
          <div className="tl-empty">Slobodan dan — nema zakazanih termina.</div>
        )}
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
              <span className="tl-card-time">{fmt(a.start_min)} · {dur(a.duration_min)}</span>
              <span className="tl-card-name">{a.clients?.name || '—'}</span>
              {height > 50 && <span className="tl-card-sub">{a.appointment_services.map(x=>x.services.name_sr).join(' + ')}</span>}
              <button className="tl-card-x" onClick={(e)=>{ e.stopPropagation(); onCancel(a.id) }}>Otkaži</button>
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

function BookForClient({ worker, salon, date, onDone, onClose }) {
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
      .then(({ data }) => setSlots((data||[]).map(r=>r.start_min)))
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

  return (
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
                <span className="grow"><span className="name">{s.name_sr}</span><br/><span className="tiny">{dur(s.duration_min)}</span></span>
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
  )
}

function weekOf(ds) {
  const mon = shift(ds, -((new Date(ds+'T00:00:00').getDay()+6)%7))
  return Array.from({length:7}, (_,i) => shift(iso(mon), i))
}
function shift(ds, n) { const d = new Date(ds+'T00:00:00'); d.setDate(d.getDate()+n); return d }
function dayTitle(ds) {
  const d = new Date(ds+'T00:00:00')
  if (ds===todayISO) return 'Danas'
  return d.getDate()+'.'+(d.getMonth()+1)+'.'
}