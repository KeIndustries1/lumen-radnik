import { useEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'

// ============================================================
// Izrezivanje slike pre otpremanja (kao na Instagramu):
// prevuci prstom da pomeris sliku, klizac ili dva prsta za zum.
// shape: 'circle' (slika profila) ili 'square' (slika usluge)
// onDone(blob) dobija gotovu JPEG sliku 800x800.
// ============================================================
const V = 280          // velicina prozora za izrezivanje (px)
const OUT = 800        // velicina izlazne slike (px)

export default function ImageCropper({ file, shape = 'circle', onCancel, onDone }) {
  const [img, setImg] = useState(null)
  const [zoom, setZoom] = useState(1)
  const [pos, setPos] = useState({ x: 0, y: 0 })
  const drag = useRef(null)
  const pinch = useRef(null)
  const pointers = useRef(new Map())

  useEffect(() => {
    const url = URL.createObjectURL(file)
    const i = new Image()
    i.onload = () => {
      setImg(i)
      const s = baseScale(i)
      setPos({ x: (V - i.width * s) / 2, y: (V - i.height * s) / 2 })
    }
    i.src = url
    return () => URL.revokeObjectURL(url)
  }, [file])

  const baseScale = i => Math.max(V / i.width, V / i.height)
  const scale = img ? baseScale(img) * zoom : 1
  const dw = img ? img.width * scale : 0
  const dh = img ? img.height * scale : 0

  function clamp(p, w = dw, h = dh) {
    return { x: Math.min(0, Math.max(V - w, p.x)), y: Math.min(0, Math.max(V - h, p.y)) }
  }

  function applyZoom(z) {
    if (!img) return
    const nz = Math.min(4, Math.max(1, z))
    const ns = baseScale(img) * nz
    // zadrzi centar prozora na istom mestu slike
    const cx = (V / 2 - pos.x) / scale
    const cy = (V / 2 - pos.y) / scale
    const next = { x: V / 2 - cx * ns, y: V / 2 - cy * ns }
    setZoom(nz)
    setPos(clamp(next, img.width * ns, img.height * ns))
  }

  function onPointerDown(e) {
    e.currentTarget.setPointerCapture(e.pointerId)
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      pinch.current = { dist: Math.hypot(a.x - b.x, a.y - b.y), zoom }
      drag.current = null
    } else {
      drag.current = { sx: e.clientX, sy: e.clientY, px: pos.x, py: pos.y }
    }
  }
  function onPointerMove(e) {
    if (!pointers.current.has(e.pointerId)) return
    pointers.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    if (pinch.current && pointers.current.size === 2) {
      const [a, b] = [...pointers.current.values()]
      const d = Math.hypot(a.x - b.x, a.y - b.y)
      applyZoom(pinch.current.zoom * (d / pinch.current.dist))
    } else if (drag.current) {
      setPos(clamp({ x: drag.current.px + e.clientX - drag.current.sx, y: drag.current.py + e.clientY - drag.current.sy }))
    }
  }
  function onPointerUp(e) {
    pointers.current.delete(e.pointerId)
    if (pointers.current.size < 2) pinch.current = null
    if (pointers.current.size === 0) drag.current = null
  }

  function save() {
    const canvas = document.createElement('canvas')
    canvas.width = OUT; canvas.height = OUT
    const ctx = canvas.getContext('2d')
    ctx.drawImage(img, -pos.x / scale, -pos.y / scale, V / scale, V / scale, 0, 0, OUT, OUT)
    canvas.toBlob(b => b && onDone(b), 'image/jpeg', 0.9)
  }

  return createPortal(
    <div className="cropper-backdrop">
      <div className="cropper-box">
        <div className="cropper-title">Podesi sliku</div>
        <div className="cropper-hint">Prevuci da pomeriš · raširi prste ili klizač za zum</div>

        <div className="cropper-frame" style={{ width: V, height: V }}
          onPointerDown={onPointerDown} onPointerMove={onPointerMove}
          onPointerUp={onPointerUp} onPointerCancel={onPointerUp}
          onWheel={e => applyZoom(zoom - e.deltaY * 0.002)}>
          {img && (
            <img src={img.src} alt="" draggable={false}
              style={{ position: 'absolute', left: pos.x, top: pos.y, width: dw, height: dh, maxWidth: 'none' }} />
          )}
          <div className={'cropper-mask ' + shape} />
        </div>

        <input type="range" min="1" max="4" step="0.01" value={zoom}
          onChange={e => applyZoom(Number(e.target.value))} className="cropper-zoom" />

        <div style={{ display: 'flex', gap: 8 }}>
          <button className="ghost" onClick={onCancel}>Otkaži</button>
          <button className="btn" style={{ marginTop: 0 }} disabled={!img} onClick={save}>Sačuvaj</button>
        </div>
      </div>
    </div>,
    document.body
  )
}