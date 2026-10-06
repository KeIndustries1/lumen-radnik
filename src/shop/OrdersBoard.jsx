// WorkIn za šablon Katalog i porudžbine: porudžbine po danu (kao raspored) ili sve aktivne.
// Klik na karticu otvara sve što je kupac naručio, uplatu i statuse.
import { useEffect, useRef, useState } from 'react'
import { supabase } from '../lib/supabase'
import { haptic } from '../lib/haptic'
import Bouquet from './Bouquet'
import { din, defaultShop, onList, nm, productPrice, byId, photosOf, packOf, isBox, totalCount } from './engine'

const STATUS = ['awaiting_payment', 'confirmed', 'in_progress', 'ready', 'done']
const LABEL = { awaiting_payment: 'Čeka odobrenje', confirmed: 'Potvrđeno', in_progress: 'U izradi', ready: 'Spremno', done: 'Isporučeno', cancelled: 'Otkazano' }
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
.ob-prod{display:flex;gap:12px;align-items:center;background:var(--card);border:1px solid var(--line);border-radius:12px;padding:10px 12px;margin-bottom:8px}
.ob-prod .ob-thumb{width:72px;height:72px}
.ob-pics{display:flex;gap:8px;margin-top:8px;flex-wrap:wrap}
.ob-pic{position:relative;width:76px;height:76px;border-radius:12px;overflow:hidden;background:var(--ink2);display:grid;place-items:center;flex:none}
.ob-pic img{width:100%;height:100%;object-fit:cover}
.ob-pic.first{box-shadow:0 0 0 2px var(--rouge)}
.ob-pic.add{border:1px dashed var(--line);background:transparent;color:var(--rouge);font-size:26px;cursor:pointer}
.ob-pic.add input{position:absolute;inset:0;opacity:0;cursor:pointer}
.ob-picx{position:absolute;top:2px;right:2px;width:26px;height:26px;border-radius:50%;background:rgba(0,0,0,.6);color:#fff;font-size:11px;border:0}
.ob-picfirst{position:absolute;left:0;right:0;bottom:0;background:rgba(0,0,0,.6);color:#fff;font-size:10.5px;font-weight:700;padding:4px 0;border:0}
.ob-pbtn{display:inline-flex;align-items:center;min-height:36px;padding:0 12px;border-radius:9px;background:transparent;box-shadow:inset 0 0 0 1px var(--line);color:var(--rouge);font-weight:600;font-size:13px;border:0;cursor:pointer;position:relative;overflow:hidden}
.ob-pbtn input{position:absolute;inset:0;opacity:0;cursor:pointer}
`

// "21 cvet · Kutija" / "Privezak"
function kindOf(shop, it) {
  if (it.keychain) return 'Privezak'
  const n = totalCount(it.design)
  const w = n % 10 === 1 && n % 100 !== 11 ? 'cvet' : [2, 3, 4].includes(n % 10) && ![12, 13, 14].includes(n % 100) ? 'cveta' : 'cvetova'
  return `${n} ${w} · ${isBox(packOf(shop, it.design)) ? 'Kutija' : 'Buket'}`
}

function Detail({ shop, o, onClose, onChange }) {
  const [track, setTrack] = useState(o.tracking || '')
  const [ask, setAsk] = useState(false)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const c = o.contact || {}
  const si = STATUS.indexOf(o.status)
  async function setStatus(status) {
    setBusy(true); haptic('tap')
    const patch = { status, ...(status === 'confirmed' && o.status === 'awaiting_payment' ? { paid_at: new Date().toISOString() } : {}), ...(status === 'cancelled' ? { cancel_reason: 'owner' } : {}) }
    const { error } = await supabase.from('orders').update(patch).eq('id', o.id)
    setBusy(false)
    if (error) { haptic('warning'); setErr(error.message); return }
    setErr(''); haptic('success'); onChange({ ...o, ...patch })
  }
  async function saveTracking() {
    setBusy(true); haptic('tap')
    const patch = { tracking: track.trim() || null }
    const { error } = await supabase.from('orders').update(patch).eq('id', o.id)
    setBusy(false)
    if (error) { haptic('warning'); setErr(error.message); return }
    setErr(''); haptic('success'); onChange({ ...o, ...patch })
  }
  const tel = String(c.phone || '').replace(/\s/g, '')
  return (
    <div className="sheet" onClick={e => { if (e.target === e.currentTarget) onClose() }}>
      <div className="inner ob-sheet">
        <div className="sheet-handle" />
        <div className="sheet-header">
          <div><b>{c.first} {c.last}</b><div className="tiny">#{o.number} · {fmt(o.due_date)}{o.due_time ? ` · ${o.due_time}` : ''}</div></div>
          <button className="sheet-close" onClick={onClose} aria-label="Zatvori">✕</button>
        </div>

        {(o.items || []).map((it, k) => (
          <div key={k} style={{ marginBottom: 14 }}>
            <div className="ob-stage">{it.photo ? <img src={it.photo} alt="" /> : <Bouquet shop={shop} design={it.design} size={200} keychain={it.keychain} />}</div>
            <div className="eyebrow">{it.title} · {kindOf(shop, it)} · {din(it.price)}</div>
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
        {o.status === 'awaiting_payment' && <button className="btn" disabled={busy} onClick={() => setStatus('confirmed')}>Uplata je stigla, potvrdi porudžbinu</button>}
        {o.status === 'awaiting_payment' && <p className="tiny">Kupac dobija obaveštenje čim potvrdiš.{shop.order?.autoCancel !== false ? ` Ako ne potvrdiš za ${shop.order?.payHours || 48}h, porudžbina se sama otkazuje.` : ''}</p>}
        {o.status === 'cancelled' && o.cancel_reason && <p className="tiny">{o.cancel_reason === 'client' ? 'Kupac je otkazao porudžbinu.' : o.cancel_reason === 'auto' ? 'Otkazano samo, uplata nije potvrđena u roku.' : 'Otkazala si porudžbinu.'}</p>}
        {o.paid_at && <p className="tiny">Avans uplaćen {new Date(o.paid_at).toLocaleDateString('sr-RS')}. Ostatak: {din(o.total - o.deposit)}</p>}

        <div className="eyebrow">Kupac i isporuka</div>
        <div className="ob-row"><span>Telefon</span><b>{c.phone}</b></div>
        <div className="ob-row"><span>Email</span><b>{c.email}</b></div>
        <div className="ob-row"><span>Isporuka</span><b>{o.fulfil === 'delivery' ? shop.order?.delivery?.label || 'Slanje' : shop.order?.pickup?.label || 'Lično preuzimanje'}</b></div>
        {o.fulfil === 'delivery' && <div className="ob-row"><span>Adresa</span><b>{c.address}, {c.zip} {c.city}</b></div>}
        {o.fulfil === 'pickup' && o.due_time && <div className="ob-row"><span>Preuzimanje</span><b>{fmt(o.due_date)} · {o.due_time}</b></div>}
        {o.fulfil === 'delivery' && o.status !== 'cancelled' && (
          <div style={{ marginTop: 10 }}>
            <div className="tiny" style={{ marginBottom: 6 }}>Broj pošiljke za praćenje (kupac ga dobija u obaveštenju)</div>
            <div className="ob-flex">
              <input className="f" style={{ flex: 1, minHeight: 44, margin: 0 }} value={track} placeholder="npr. BEX broj pošiljke" aria-label="Broj pošiljke" onChange={e => setTrack(e.target.value)} />
              <button className="btn" style={{ width: 'auto', margin: 0, padding: '11px 16px' }} disabled={busy || track.trim() === (o.tracking || '')} onClick={saveTracking}>Sačuvaj</button>
            </div>
          </div>
        )}
        <div className="ob-flex" style={{ gap: 8, marginTop: 10 }}>
          {tel && <a className="ghost" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }} href={`tel:${tel}`}>Pozovi</a>}
          {c.email && <a className="ghost" style={{ flex: 1, textAlign: 'center', textDecoration: 'none' }} href={`mailto:${c.email}?subject=${encodeURIComponent('Porudžbina #' + o.number)}`}>Pošalji mejl</a>}
        </div>
        {err && <p className="tiny" style={{ color: '#F28B8B' }}>{err}</p>}
        {!['done', 'cancelled'].includes(o.status) && (ask ? (
          <div className="ob-flex" style={{ gap: 8, marginTop: 14 }}>
            <button className="ghost" style={{ flex: 1 }} onClick={() => setAsk(false)}>Ne</button>
            <button className="btn" style={{ flex: 1, margin: 0 }} disabled={busy} onClick={() => { setAsk(false); setStatus('cancelled') }}>Da, otkaži #{o.number}</button>
          </div>
        ) : (
          <button className="ghost" style={{ width: '100%', marginTop: 14, color: '#e88a9c' }} disabled={busy} onClick={() => setAsk(true)}>Otkaži porudžbinu</button>
        ))}
      </div>
    </div>
  )
}

// Slika iz telefona → JPEG najviše 1000px
export function shrink(file, max = 1000) {
  return new Promise((res, rej) => {
    const img = new Image()
    img.onload = () => {
      const k = Math.min(1, max / Math.max(img.width, img.height))
      const c = document.createElement('canvas'); c.width = Math.round(img.width * k); c.height = Math.round(img.height * k)
      c.getContext('2d').drawImage(img, 0, 0, c.width, c.height)
      c.toBlob(b => (b ? res(b) : rej(new Error('Slika nije pročitana.'))), 'image/jpeg', 0.86)
      URL.revokeObjectURL(img.src)
    }
    img.onerror = () => rej(new Error('Slika nije pročitana.'))
    img.src = URL.createObjectURL(file)
  })
}

// Katalog: vlasnik stavlja svoje slike proizvoda, do 3 po proizvodu (bez slike kupci vide crtež)
function Products({ salon, shop, setShop }) {
  const [busy, setBusy] = useState(null)
  const [err, setErr] = useState('')
  async function save(p, photos) {
    const { error } = await supabase.rpc('set_product_photos', { p_salon: salon.id, p_product: p.id, p_photos: photos })
    if (error) throw error
    setShop(sh => ({ ...sh, products: sh.products.map(x => (x.id === p.id ? { ...x, photos, photo: photos[0] || null, photoBy: photos.length ? 'workin' : null } : x)) }))
  }
  async function run(p, fn) {
    setBusy(p.id); setErr('')
    try { await fn(); haptic('success') } catch (e) { haptic('warning'); setErr(e.message || String(e)) }
    setBusy(null)
  }
  const add = (p, file) => file && run(p, async () => {
    const blob = await shrink(file)
    const path = `shop/${salon.id}/${p.id}-${Date.now()}.jpg`
    const { error } = await supabase.storage.from('order-photos').upload(path, blob, { contentType: 'image/jpeg' })
    if (error) throw error
    await save(p, [...photosOf(p), supabase.storage.from('order-photos').getPublicUrl(path).data.publicUrl].slice(0, 3))
  })
  const remove = (p, k) => run(p, () => save(p, photosOf(p).filter((_, j) => j !== k)))
  const first = (p, k) => run(p, () => { const a = photosOf(p); return save(p, [a[k], ...a.filter((_, j) => j !== k)]) })
  const prods = onList(shop.products)
  return (
    <div>
      <p className="tiny" style={{ marginTop: 0 }}>Do 3 slike po buketu, prva je naslovna. Bez slike kupci vide crtež.</p>
      {err && <p className="tiny" style={{ color: '#F28B8B' }}>{err}</p>}
      {prods.map(p => {
        const kc = byId(shop.groups, p.group)?.type === 'keychain'
        const ph = photosOf(p)
        return (
          <div key={p.id} className="ob-prod">
            <span className="grow">
              <span className="ob-flex" style={{ justifyContent: 'space-between' }}><span className="name">{nm(p, 'sr')}</span><span className="tiny">{din(productPrice(shop, p, p.design))}</span></span>
              <span className="ob-pics">
                {ph.map((src, k) => (
                  <span key={src} className={'ob-pic' + (k === 0 ? ' first' : '')}>
                    <img src={src} alt={`Slika ${k + 1}`} />
                    <button className="ob-picx" disabled={!!busy} aria-label={`Obriši sliku ${k + 1}`} onClick={() => remove(p, k)}>✕</button>
                    {k > 0 && <button className="ob-picfirst" disabled={!!busy} onClick={() => first(p, k)}>Naslovna</button>}
                  </span>
                ))}
                {!ph.length && <span className="ob-pic draw"><Bouquet shop={shop} design={p.design} size={72} keychain={kc} /></span>}
                {ph.length < 3 && (
                  <label className={'ob-pic add' + (busy === p.id ? ' busy' : '')}>{busy === p.id ? '…' : '+'}
                    <input type="file" accept="image/*" disabled={!!busy} aria-label={`Dodaj sliku za ${nm(p, 'sr')}`} onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; add(p, f) }} />
                  </label>
                )}
              </span>
            </span>
          </div>
        )
      })}
    </div>
  )
}

export default function OrdersBoard({ salon }) {
  const [shop, setShop] = useState(() => salon.shop || defaultShop())
  useEffect(() => { if (salon.shop) setShop(salon.shop) }, [salon.shop])
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
  // neradni dani: kupci ih ne vide u izboru datuma
  const offSet = new Set(shop.order?.offDates || [])
  const [offBusy, setOffBusy] = useState(false)
  const [offErr, setOffErr] = useState('')
  async function toggleOff() {
    setOffBusy(true); setOffErr(''); haptic('tap')
    const next = [...(offSet.has(date) ? [...offSet].filter(x => x !== date) : [...offSet, date])].filter(x => x >= todayISO).sort()
    const { error } = await supabase.rpc('set_off_dates', { p_salon: salon.id, p_dates: next })
    setOffBusy(false)
    if (error) { haptic('warning'); setOffErr(error.message); return }
    haptic('success'); setShop(sh => ({ ...sh, order: { ...sh.order, offDates: next } }))
  }
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
          <span className="tiny" style={{ display: 'block', marginTop: 1, color: 'var(--text)' }}>{fmt(o.due_date)}{o.due_time ? ` · ${o.due_time}` : ''}</span>
          <span className="tiny" style={{ display: 'block', marginTop: 1 }}>{(o.items || []).map(i => kindOf(shop, i)).join(' + ')}</span>
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
        <b className="ob-month">{mode === 'day' ? `${MONTHS[d.getMonth()]} ${d.getFullYear()}` : mode === 'prod' ? 'Katalog' : 'Porudžbine'}</b>
        <span className="tiny">{active.length} aktivne</span>
      </div>
      <div className="ob-tabs">
        <button className={mode === 'day' ? 'on' : ''} onClick={() => { haptic('tap'); setMode('day') }}>Po danu</button>
        <button className={mode === 'all' ? 'on' : ''} onClick={() => { haptic('tap'); setMode('all') }}>Sve aktivne</button>
        <button className={mode === 'prod' ? 'on' : ''} onClick={() => { haptic('tap'); setMode('prod') }}>Slike</button>
      </div>
      {mode === 'prod' && <Products salon={salon} shop={shop} setShop={setShop} />}

      {mode === 'day' && (
        <div className="ob-week" onTouchStart={e => { touch.current = e.touches[0].clientX }}
          onTouchEnd={e => { if (touch.current == null) return; const dx = e.changedTouches[0].clientX - touch.current; touch.current = null; if (Math.abs(dx) > 45) setDate(addDays(date, dx < 0 ? 7 : -7)) }}>
          <button className="ob-wnav" onClick={() => setDate(addDays(date, -7))} aria-label="Prethodna nedelja">‹</button>
          <div className="ob-days">
            {days.map((ds, i) => (
              <button key={ds} className={'ob-day' + (ds === date ? ' sel' : '') + (ds === todayISO ? ' today' : '')} onClick={() => { haptic('tap'); setDate(ds) }}>
                <span className="ob-dow">{DOW[i]}</span><span className="ob-num" style={offSet.has(ds) ? { textDecoration: 'line-through', opacity: .45 } : undefined}>{Number(ds.slice(8))}</span><span className={'ob-dot' + (busy.has(ds) ? ' on' : '')} />
              </button>
            ))}
          </div>
          <button className="ob-wnav" onClick={() => setDate(addDays(date, 7))} aria-label="Sledeća nedelja">›</button>
        </div>
      )}

      {mode === 'day' && (
        <div className="ob-flex" style={{ justifyContent: 'space-between', marginBottom: 8 }}>
          <div className="eyebrow" style={{ margin: 0, flex: 1 }}>{fmt(date)}</div>
          {date >= todayISO && (
            <button className="ob-pbtn" disabled={offBusy} onClick={toggleOff} aria-pressed={offSet.has(date)}>
              {offBusy ? '…' : offSet.has(date) ? 'Ipak primam porudžbine' : 'Ne primam porudžbine ovog dana'}
            </button>
          )}
        </div>
      )}
      {mode === 'day' && offSet.has(date) && <p className="tiny" style={{ marginTop: 0 }}>Kupci ne mogu da izaberu ovaj dan.</p>}
      {offErr && <p className="tiny" style={{ color: '#F28B8B' }}>{offErr}</p>}
      {mode === 'prod' ? null : rows === null ? <p className="tiny">Učitavam…</p> : list.length ? list.map(card) : (
        <div className="card"><p className="tiny" style={{ margin: 0 }}>{mode === 'day' ? 'Nema porudžbina za ovaj dan.' : 'Nema aktivnih porudžbina.'}</p></div>
      )}

      {openOrder && <Detail shop={shop} o={openOrder} onClose={() => setOpen(null)} onChange={n => setRows(rs => rs.map(x => (x.id === n.id ? n : x)))} />}
    </div>
  )
}
