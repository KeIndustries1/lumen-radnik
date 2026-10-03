// WorkIn za šablon Katalog i porudžbine: porudžbine po danu (kao raspored) ili sve aktivne.
// Klik na karticu otvara sve što je kupac naručio, uplatu i statuse.
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { haptic } from '../lib/haptic'
import Bouquet from './Bouquet'
import { din, defaultShop } from './engine'

const STATUS = ['awaiting_payment', 'confirmed', 'in_progress', 'ready', 'done']
const LABEL = { awaiting_payment: 'Čeka uplatu', confirmed: 'Potvrđeno', in_progress: 'U izradi', ready: 'Spremno', done: 'Isporučeno', cancelled: 'Otkazano' }
const NEXT = { confirmed: 'Počni izradu', in_progress: 'Buket je spreman', ready: 'Isporučeno' }
const COLOR = { awaiting_payment: '#F2A7BF', confirmed: '#A9C3F2', in_progress: '#F2D48A', ready: '#9FDDB9', done: '#9A8D96', cancelled: '#8A7F86' }
const MONTHS = ['Januar', 'Februar', 'Mart', 'April', 'Maj', 'Jun', 'Jul', 'Avgust', 'Septembar', 'Oktobar', 'Novembar', 'Decembar']
const DOW = ['Pon', 'Uto', 'Sre', 'Čet', 'Pet', 'Sub', 'Ned']
const DAYNAME = ['Nedelja', 'Ponedeljak', 'Utorak', 'Sreda', 'Četvrtak', 'Petak', 'Subota']
const iso = d => { const x = new Date(d); return x.getFullYear() + '-' + String(x.getMonth() + 1).padStart(2, '0') + '-' + String(x.getDate()).padStart(2, '0') }
const addDays = (ds, n) => { const d = new Date(ds + 'T00:00:00'); d.setDate(d.getDate() + n); return iso(d) }
const weekStart = ds => { const d = new Date(ds + 'T00:00:00'); return addDays(ds, -((d.getDay() + 6) % 7)) }
const todayISO = iso(new Date())
const fmt = ds => { const d = new Date(ds + 'T00:00:00'); return `${DAYNAME[d.getDay()]}, ${d.getDate()}. ${MONTHS[d.getMonth()].toLowerCase()}` }

const CSS = `
.ob-head{display:flex;align-items:center;gap:8px;padding:4px 0 10px}
.ob-month{flex:1;font-family:'Fraunces',serif;font-size:21px;color:var(--text)}
.ob-tabs{display:flex;gap:6px;background:var(--ink2);border-radius:12px;padding:4px;margin-bottom:12px}
.ob-tabs button{flex:1;padding:9px;border-radius:9px;color:var(--muted);font-weight:600;font-size:13.5px;background:none;border:0}
.ob-tabs button.on{background:var(--rouge);color:#fff}
.ob-week{display:flex;align-items:center;gap:2px;margin-bottom:14px}
.ob-wnav{width:24px;height:44px;border:none;background:none;color:var(--text);opacity:.45;flex:none;font-size:18px}
.ob-days{flex:1;display:grid;grid-template-columns:repeat(7,1fr)}
.ob-day{display:flex;flex-direction:column;align-items:center;gap:4px;padding:2px 0;background:none;border:0;color:var(--text)}
.ob-dow{font-size:11px;opacity:.55}
.ob-num{width:32px;height:32px;border-radius:50%;display:grid;place-items:center;font-weight:600;font-size:15px}
.ob-day.today .ob-num{color:var(--rouge)}
.ob-day.sel .ob-num{background:var(--rouge);color:#fff}
.ob-dot{width:4px;height:4px;border-radius:50%;background:transparent}
.ob-dot.on{background:var(--rouge)}
.ob-card{display:flex;gap:11px;align-items:center;width:100%;text-align:left;background:var(--card);border:1px solid var(--line);border-left:4px solid var(--rouge);border-radius:12px;padding:10px 12px;margin-bottom:8px;color:var(--text)}
.ob-thumb{width:54px;height:54px;border-radius:12px;overflow:hidden;background:var(--ink2);flex:none;display:grid;place-items:center}
.ob-thumb img{width:100%;height:100%;object-fit:cover}
.ob-chip{font-size:11.5px;font-weight:700;padding:3px 8px;border-radius:8px;background:var(--ink2)}
.ob-row{display:flex;justify-content:space-between;gap:12px;padding:9px 0;border-bottom:1px solid var(--line);font-size:14px}
.ob-row span:first-child{color:var(--muted)}
.ob-row b{text-align:right}
.ob-dotc{display:inline-block;width:12px;height:12px;border-radius:50%;margin-right:6px;vertical-align:-1px;box-shadow:inset 0 0 0 1px rgba(255,255,255,.25)}
.ob-steps{display:flex;gap:4px;margin:8px 0 10px}
.ob-steps i{flex:1;height:5px;border-radius:3px;background:var(--line)}
.ob-steps i.on{background:var(--rouge)}
.ob-stage{height:200px;border-radius:16px;border:1px solid var(--line);overflow:hidden;display:grid;place-items:center;background:radial-gradient(circle at 50% 38%,var(--card) 0%,var(--ink) 80%)}
.ob-stage img{width:100%;height:100%;object-fit:cover}
.ob-inspo{width:100%;border-radius:12px;margin-top:8px;max-height:260px;object-fit:cover}
.ob-sheet{max-height:90vh;max-height:90dvh;overflow-y:auto}
.ob-flex{display:flex;align-items:center;gap:8px}
.ob-sheet .btn,.ob-tabs button.on,.ob-day.sel .ob-num{color:var(--on-rouge,#fff)}
`

function Detail({ shop, o, onClose, onChange }) {
  const [busy, setBusy] = useState(false)
  const c = o.contact || {}
  const si = STATUS.indexOf(o.status)
  async function setStatus(status) {
    setBusy(true); haptic('tap')
    const patch = { status, ...(status === 'confirmed' && o.status === 'awaiting_payment' ? { paid_at: new Date().toISOString() } : {}) }
    const { error } = await supabase.from('orders').update(patch).eq('id', o.id)
    setBusy(false)
    if (error) { haptic('warning'); alert(error.message); return }
    haptic('success'); onChange({ ...o, ...patch })
  }
  const tel = String(c.phone || '').replace(/\s/g, '')
  return (
    <div className="sheet" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="inner ob-sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div><b>{c.first} {c.last}</b><div className="tiny">#{o.number} · za {fmt(o.due_date)}</div></div>
          <button className="sheet-close" onClick={onClose} aria-label="Zatvori">✕</button>
        </div>

        {(o.items || []).map((it, k) => (
          <div key={k} style={{ marginBottom: 14 }}>
            <div className="ob-stage">{it.photo ? <img src={it.photo} alt="" /> : <Bouquet shop={shop} design={it.design} size={200} keychain={it.keychain} />}</div>
            <div className="eyebrow">{it.title} · {din(it.price)}</div>
            {(it.lines || []).map((l, j) => <div key={j} className="ob-row"><span>{l.label}</span><b>{l.hex && <i className="ob-dotc" style={{ background: l.hex }} />}{l.value}</b></div>)}
            {it.design?.inspo && <img className="ob-inspo" src={it.design.inspo} alt="Slika inspiracije" />}
          </div>
        ))}
        {o.card_message && <div className="ob-row"><span>Poruka za karticu</span><b>„{o.card_message}“</b></div>}

        <div className="eyebrow">Status</div>
        {o.status !== 'cancelled' && <div className="ob-steps">{STATUS.map((s, k) => <i key={s} className={k <= si ? 'on' : ''} />)}</div>}
        <div className="ob-flex" style={{ justifyContent: 'space-between', gap: 10 }}>
          <span className="ob-chip" style={{ color: COLOR[o.status], fontSize: 13 }}>{LABEL[o.status]}</span>
          {NEXT[o.status] && <button className="btn" style={{ width: 'auto', margin: 0, padding: '11px 16px' }} disabled={busy} onClick={() => setStatus(STATUS[si + 1])}>{NEXT[o.status]}</button>}
        </div>

        <div className="eyebrow">Plaćanje</div>
        <div className="ob-row"><span>Ukupno</span><b>{din(o.total)}</b></div>
        {o.deposit > 0 && <div className="ob-row"><span>Avans</span><b>{din(o.deposit)}</b></div>}
        {o.deposit > 0 && <div className="ob-row"><span>Poziv na broj</span><b>{o.number}</b></div>}
        {o.status === 'awaiting_payment' && <button className="btn" disabled={busy} onClick={() => setStatus('confirmed')}>Uplata je stigla</button>}
        {o.paid_at && <p className="tiny">Avans uplaćen {new Date(o.paid_at).toLocaleDateString('sr-RS')}. Ostatak: {din(o.total - o.deposit)}</p>}

        <div className="eyebrow">Kupac i isporuka</div>
        <div className="ob-row"><span>Telefon</span><b>{c.phone}</b></div>
        <div className="ob-row"><span>Email</span><b>{c.email}</b></div>
        <div className="ob-row"><span>Isporuka</span><b>{o.fulfil === 'delivery' ? shop.order?.delivery?.label || 'Slanje' : shop.order?.pickup?.label || 'Lično preuzimanje'}</b></div>
        {o.fulfil === 'delivery' && <div className="ob-row"><span>Adresa</span><b>{c.address}, {c.zip} {c.city}</b></div>}
        <div className="ob-flex" style={{ gap: 8, marginTop: 10 }}>
          {tel && <a className="ghost" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }} href={`tel:${tel}`}>Pozovi</a>}
          {c.email && <a className="ghost" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }} href={`mailto:${c.email}?subject=${encodeURIComponent('Porudžbina #' + o.number)}`}>Pošalji mejl</a>}
        </div>
        {!['done', 'cancelled'].includes(o.status) && (
          <button className="ghost" style={{ width: '100%', marginTop: 14, color: '#e88a9c' }} disabled={busy}
            onClick={() => { if (window.confirm(`Otkazati porudžbinu #${o.number}?`)) setStatus('cancelled') }}>Otkaži porudžbinu</button>
        )}
      </div>
    </div>
  )
}

export default function OrdersBoard({ salon }) {
  const shop = salon.shop || defaultShop()
  const [rows, setRows] = useState(null)
  const [date, setDate] = useState(todayISO)
  const [mode, setMode] = useState('day')
  const [open, setOpen] = useState(null)
  const touch = useRef(null)

  function load() {
    supabase.from('orders').select('*').eq('salon_id', salon.id).order('due_date').order('created_at')
      .then(({ data }) => {
        const list = data || []
        setRows(list)
        // prvi put: skoči na prvi dan koji ima aktivnu porudžbinu
        setDate(d => (d === todayISO && !list.some(o => o.due_date === todayISO) ? (list.find(o => o.due_date >= todayISO && !['done', 'cancelled'].includes(o.status))?.due_date || d) : d))
      })
  }
  useEffect(() => {
    load()
    const ch = supabase.channel('orders-' + salon.id)
      .on('postgres_changes', { event: '*', schema: 'public', table: 'orders', filter: `salon_id=eq.${salon.id}` }, load)
      .subscribe()
    return () => { supabase.removeChannel(ch) }
  }, [salon.id])

  const active = (rows || []).filter(o => !['done', 'cancelled'].includes(o.status))
  const busy = new Set(active.map(o => o.due_date))
  const mon = weekStart(date)
  const days = Array.from({ length: 7 }, (_, i) => addDays(mon, i))
  const list = mode === 'day' ? (rows || []).filter(o => o.due_date === date) : active
  const d = new Date(date + 'T00:00:00')
  const openOrder = (rows || []).find(o => o.id === open)

  const card = o => {
    const first = (o.items || [])[0]
    return (
      <button key={o.id} className="ob-card" style={{ borderLeftColor: COLOR[o.status] }} onClick={() => { haptic('tap'); setOpen(o.id) }}>
        <span className="ob-thumb">{first?.photo ? <img src={first.photo} alt="" /> : first?.design ? <Bouquet shop={shop} design={first.design} size={54} keychain={first.keychain} /> : null}</span>
        <span className="grow">
          <span className="ob-flex" style={{ justifyContent: 'space-between' }}><span className="name">{o.contact?.first} {o.contact?.last}</span><span className="tiny">#{o.number}</span></span>
          <span className="tiny" style={{ display: 'block', marginTop: 1 }}>{(o.items || []).map(i => i.summary || i.title).join(' + ')}</span>
          <span className="ob-flex" style={{ gap: 6, marginTop: 6, flexWrap: 'wrap' }}>
            <span className="ob-chip" style={{ color: COLOR[o.status] }}>{LABEL[o.status]}</span>
            <span className="ob-chip" style={{ color: 'var(--muted)' }}>{o.fulfil === 'delivery' ? 'Slanje' : 'Preuzimanje'}</span>
            {mode === 'all' && <span className="ob-chip" style={{ color: 'var(--muted)' }}>{fmt(o.due_date)}</span>}
          </span>
        </span>
      </button>
    )
  }

  return (
    <div>
      <style>{CSS}</style>
      <div className="ob-head">
        <b className="ob-month">{mode === 'day' ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : 'Porudžbine'}</b>
        <span className="tiny">{active.length} aktivne</span>
      </div>
      <div className="ob-tabs">
        <button className={mode === 'day' ? 'on' : ''} onClick={() => { haptic('tap'); setMode('day') }}>Po danu</button>
        <button className={mode === 'all' ? 'on' : ''} onClick={() => { haptic('tap'); setMode('all') }}>Sve aktivne</button>
      </div>

      {mode === 'day' && (
        <div className="ob-week" onTouchStart={e => { touch.current = e.touches[0].clientX }}
          onTouchEnd={e => { if (touch.current == null) return; const dx = e.changedTouches[0].clientX - touch.current; touch.current = null; if (Math.abs(dx) > 45) setDate(addDays(date, dx < 0 ? 7 : -7)) }}>
          <button className="ob-wnav" onClick={() => setDate(addDays(date, -7))} aria-label="Prethodna nedelja">‹</button>
          <div className="ob-days">
            {days.map((ds, i) => (
              <button key={ds} className={'ob-day' + (ds === date ? ' sel' : '') + (ds === todayISO ? ' today' : '')} onClick={() => { haptic('tap'); setDate(ds) }}>
                <span className="ob-dow">{DOW[i]}</span><span className="ob-num">{Number(ds.slice(8))}</span><span className={'ob-dot' + (busy.has(ds) ? ' on' : '')} />
              </button>
            ))}
          </div>
          <button className="ob-wnav" onClick={() => setDate(addDays(date, 7))} aria-label="Sledeća nedelja">›</button>
        </div>
      )}

      {mode === 'day' && <div className="eyebrow" style={{ marginTop: 0 }}>{fmt(date)}</div>}
      {rows === null ? <p className="tiny">Učitavam…</p> : list.length ? list.map(card) : (
        <div className="card"><p className="tiny" style={{ margin: 0 }}>{mode === 'day' ? 'Nema porudžbina za ovaj dan.' : 'Nema aktivnih porudžbina.'}</p></div>
      )}

      {openOrder && <Detail shop={shop} o={openOrder} onClose={() => setOpen(null)} onChange={n => setRows(rs => rs.map(x => (x.id === n.id ? n : x)))} />}
    </div>
  )
}
