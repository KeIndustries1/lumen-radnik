// WorkIn (šablon Katalog): vlasnik menja sliku početnog ekrana — svoja fotografija ili nacrtan buket
import { useState } from 'react'
import { supabase } from '../lib/supabase'
import { haptic } from '../lib/haptic'
import Bouquet from './Bouquet'
import { shrink } from './OrdersBoard'

export default function HeroEdit({ salon, onSalonChange }) {
  const [url, setUrl] = useState(salon.hero_image_url || null)
  const [drawOn, setDrawOn] = useState(salon.shop?.hero?.on !== false && !!salon.shop?.hero?.design)
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const hasDrawing = !!salon.shop?.hero?.design

  async function save(next) {
    const { error } = await supabase.rpc('set_hero', { p_salon: salon.id, p_url: next })
    if (error) throw error
    setUrl(next); setDrawOn(!next && hasDrawing)
    onSalonChange?.({ hero_image_url: next, shop: salon.shop ? { ...salon.shop, hero: { ...salon.shop.hero, on: !next } } : salon.shop })
  }
  async function pick(file) {
    if (!file) return
    setBusy(true); setErr('')
    try {
      const blob = await shrink(file, 1600)
      const path = `hero/${salon.id}/${Date.now()}.jpg`
      const { error } = await supabase.storage.from('order-photos').upload(path, blob, { contentType: 'image/jpeg' })
      if (error) throw error
      await save(supabase.storage.from('order-photos').getPublicUrl(path).data.publicUrl)
      haptic('success')
    } catch (e) { haptic('warning'); setErr(e.message || String(e)) }
    setBusy(false)
  }
  async function reset() {
    setBusy(true); setErr('')
    try { await save(null); haptic('success') } catch (e) { haptic('warning'); setErr(e.message || String(e)) }
    setBusy(false)
  }

  const showPhoto = url && !drawOn
  return (
    <div style={{ textAlign: 'center' }}>
      <div style={{ height: 220, borderRadius: 16, overflow: 'hidden', border: '1px solid var(--line)', display: 'grid', placeItems: 'center',
        background: showPhoto ? `center/cover no-repeat url(${url})` : 'radial-gradient(120% 85% at 50% -8%, color-mix(in srgb, var(--rouge) 38%, transparent) 0%, transparent 62%), var(--ink)' }}>
        {!showPhoto && drawOn && <Bouquet shop={salon.shop} design={salon.shop.hero.design} size={210} />}
        {!showPhoto && !drawOn && <span className="tiny">Samo boje teme</span>}
      </div>
      <p className="tiny" style={{ margin: '14px 0' }}>Ovo kupci vide na početnom ekranu aplikacije, iznad imena.</p>
      <label className="btn" style={{ display: 'block', cursor: 'pointer', position: 'relative' }}>
        {busy ? 'Otpremam…' : showPhoto ? 'Promeni fotografiju' : 'Stavi svoju fotografiju'}
        <input type="file" accept="image/*" disabled={busy} aria-label="Izaberi fotografiju za početni ekran"
          onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; pick(f) }}
          style={{ position: 'absolute', inset: 0, opacity: 0, cursor: 'pointer' }} />
      </label>
      {showPhoto && (
        <button className="ghost" disabled={busy} style={{ width: '100%', marginTop: 8 }} onClick={reset}>
          {hasDrawing ? 'Vrati nacrtan buket' : 'Ukloni fotografiju'}
        </button>
      )}
      {err && <p className="err" style={{ marginTop: 8 }}>{err}</p>}
    </div>
  )
}
