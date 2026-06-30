import { useState, useCallback, useRef, useEffect } from 'react'
import * as pdfjsLib from 'pdfjs-dist'
import { extractRooms } from '../../services/claudeApi'
import { useAppStore } from '../../store/useAppStore'

pdfjsLib.GlobalWorkerOptions.workerSrc = '/pdf.worker.min.mjs'

// ── типы ─────────────────────────────────────────────────────────────────────
const TYPE_COLOR = {
  office:    '#6366F1',
  corridor:  '#94A3B8',
  bathroom:  '#64748B',
  kitchen:   '#F59E0B',
  storage:   '#8B5CF6',
  technical: '#F97316',
  hall:      '#10B981',
  other:     '#6B7280',
}
const TYPE_LABEL = {
  office:'Кабинет/Офис', corridor:'Коридор', bathroom:'Санузел',
  kitchen:'Кухня', storage:'Кладовая', technical:'Техническое',
  hall:'Холл/Лестница', other:'Прочее',
}

// ── canvas-утилиты ────────────────────────────────────────────────────────────
async function renderPdfPage(pdf, pageNum, scale = 2) {
  const page = await pdf.getPage(pageNum)
  const vp = page.getViewport({ scale })
  const canvas = document.createElement('canvas')
  canvas.width = vp.width; canvas.height = vp.height
  await page.render({ canvasContext: canvas.getContext('2d'), viewport: vp }).promise
  return canvas
}

async function fileToCanvas(file, scale = 2) {
  if (file.type === 'application/pdf') {
    const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
    return renderPdfPage(pdf, 1, scale)
  }
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = e => {
      const img = new Image()
      img.onload = () => {
        const MAX = 3000
        let w = img.naturalWidth, h = img.naturalHeight
        if (w > MAX || h > MAX) { const r = Math.min(MAX/w, MAX/h); w = Math.round(w*r); h = Math.round(h*r) }
        const c = document.createElement('canvas'); c.width = w; c.height = h
        c.getContext('2d').drawImage(img, 0, 0, w, h)
        resolve(c)
      }
      img.onerror = reject; img.src = e.target.result
    }
    reader.onerror = reject; reader.readAsDataURL(file)
  })
}

async function pdfAllPages(file, scale = 1.5) {
  const pdf = await pdfjsLib.getDocument({ data: await file.arrayBuffer() }).promise
  const pages = []
  for (let i = 1; i <= pdf.numPages; i++) pages.push(await renderPdfPage(pdf, i, scale))
  return pages
}

// ── автокроп: проекции (Вариант А) ───────────────────────────────────────────
function autocropCanvas(src) {
  const W = src.width, H = src.height
  const d = src.getContext('2d').getImageData(0, 0, W, H).data
  const luma = i => 0.299*d[i] + 0.587*d[i+1] + 0.114*d[i+2]

  const rowD = new Float32Array(H)
  for (let y = 0; y < H; y++) {
    let n = 0
    for (let x = 0; x < W; x++) if (luma((y*W+x)*4) < 200) n++
    rowD[y] = n / W
  }
  const colD = new Float32Array(W)
  for (let x = 0; x < W; x++) {
    let n = 0
    for (let y = 0; y < H; y++) if (luma((y*W+x)*4) < 200) n++
    colD[x] = n / H
  }

  const smooth = (arr, win) => {
    const out = new Float32Array(arr.length)
    for (let i = 0; i < arr.length; i++) {
      let s = 0, c = 0
      for (let j = Math.max(0,i-win); j <= Math.min(arr.length-1,i+win); j++) { s += arr[j]; c++ }
      out[i] = s/c
    }
    return out
  }
  const rowS = smooth(rowD, Math.max(1, Math.round(H*0.02)))
  const colS = smooth(colD, Math.max(1, Math.round(W*0.02)))

  const T = 0.003
  let top=0, bot=H-1, left=0, right=W-1
  for (let y=0;y<H;y++)   { if (rowS[y]>T) { top=y; break } }
  for (let y=H-1;y>=0;y--){ if (rowS[y]>T) { bot=y; break } }
  for (let x=0;x<W;x++)   { if (colS[x]>T) { left=x; break } }
  for (let x=W-1;x>=0;x--){ if (colS[x]>T) { right=x; break } }

  const pad = Math.round(Math.min(W,H)*0.012)
  top  = Math.max(0, top-pad);  bot   = Math.min(H-1, bot+pad)
  left = Math.max(0, left-pad); right = Math.min(W-1, right+pad)

  const out = document.createElement('canvas')
  out.width = right-left; out.height = bot-top
  out.getContext('2d').drawImage(src, left, top, out.width, out.height, 0, 0, out.width, out.height)
  return out
}

// ── flood-fill: определение границ помещения ──────────────────────────────────
// Возвращает { dataUrl, x, y, w, h } (0..1 от размеров srcCanvas) или null.
function floodFillRoom(srcCanvas, clickX, clickY, hexColor) {
  const W = srcCanvas.width, H = srcCanvas.height
  const imgData = srcCanvas.getContext('2d').getImageData(0, 0, W, H).data
  const luma = i => 0.299*imgData[i] + 0.587*imgData[i+1] + 0.114*imgData[i+2]
  const pixIdx = (x, y) => (y * W + x) * 4

  // Стартовый пиксель должен быть «светлым» (в помещении, не на стене)
  if (luma(pixIdx(clickX, clickY)) < 160) return null

  const visited = new Uint8Array(W * H)
  const qx = new Int32Array(W * H)
  const qy = new Int32Array(W * H)
  let head = 0, tail = 0
  let minX = clickX, maxX = clickX, minY = clickY, maxY = clickY

  visited[clickY * W + clickX] = 1
  qx[tail] = clickX; qy[tail] = clickY; tail++

  // 8-связный обход — лучше огибает мелкие подписи и тонкие линии
  const DX = [-1,-1,-1, 0, 0, 1, 1, 1]
  const DY = [-1, 0, 1,-1, 1,-1, 0, 1]

  while (head < tail) {
    const cx = qx[head], cy = qy[head]; head++
    for (let d = 0; d < 8; d++) {
      const nx = cx + DX[d], ny = cy + DY[d]
      if (nx < 0 || nx >= W || ny < 0 || ny >= H) continue
      const vi = ny * W + nx
      if (visited[vi]) continue
      if (luma(pixIdx(nx, ny)) < 160) continue
      visited[vi] = 1
      qx[tail] = nx; qy[tail] = ny; tail++
      if (nx < minX) minX = nx; if (nx > maxX) maxX = nx
      if (ny < minY) minY = ny; if (ny > maxY) maxY = ny
    }
  }

  const filled = tail
  const total  = W * H
  if (filled < total * 0.0008) return null  // слишком маленькая область
  if (filled > total * 0.45)   return null  // заливка «вытекла» наружу

  const bw = maxX - minX + 1, bh = maxY - minY + 1
  const r = parseInt(hexColor.slice(1,3), 16)
  const g = parseInt(hexColor.slice(3,5), 16)
  const b = parseInt(hexColor.slice(5,7), 16)

  const maskCanvas = document.createElement('canvas')
  maskCanvas.width = bw; maskCanvas.height = bh
  const mCtx = maskCanvas.getContext('2d')
  const outData = mCtx.createImageData(bw, bh)
  for (let i = 0; i < filled; i++) {
    const j = ((qy[i] - minY) * bw + (qx[i] - minX)) * 4
    outData.data[j]   = r
    outData.data[j+1] = g
    outData.data[j+2] = b
    outData.data[j+3] = 90   // ~35% непрозрачность
  }
  mCtx.putImageData(outData, 0, 0)

  return {
    dataUrl: maskCanvas.toDataURL('image/png'),
    x: minX / W, y: minY / H,
    w: bw / W,   h: bh / H,
  }
}

const toDataUrl = (canvas, q=0.88) => canvas.toDataURL('image/jpeg', q)
const ACCEPT = '.pdf,.jpg,.jpeg,.png,.webp'

// ── маркер-пин ────────────────────────────────────────────────────────────────
function MarkerPin({ number, type, x, y, selected }) {
  const color = TYPE_COLOR[type] || TYPE_COLOR.other
  return (
    <div
      data-marker-num={number}
      style={{
        position:'absolute', left:`${x*100}%`, top:`${y*100}%`,
        transform:'translate(-50%,-100%)',
        cursor:'grab', userSelect:'none',
        zIndex: selected ? 20 : 10,
        pointerEvents:'all',
      }}
    >
      <div style={{
        width:30, height:30, borderRadius:'50% 50% 50% 0', transform:'rotate(-45deg)',
        background: color,
        border:`2.5px solid rgba(255,255,255,0.9)`,
        boxShadow: selected
          ? `0 0 0 3px ${color}55, 0 4px 12px rgba(0,0,0,0.3)`
          : '0 2px 8px rgba(0,0,0,0.22)',
        display:'flex', alignItems:'center', justifyContent:'center',
        transition:'box-shadow .12s',
      }}>
        <span style={{
          transform:'rotate(45deg)', color:'#fff',
          fontWeight:700, fontSize:8, lineHeight:1,
          fontFamily:"'JetBrains Mono',monospace",
          maxWidth:20, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap',
        }}>{number}</span>
      </div>
      <div style={{ width:6, height:4, background:'rgba(0,0,0,0.18)', borderRadius:'50%', margin:'-2px auto 0', filter:'blur(2px)' }}/>
    </div>
  )
}

// ── главный компонент ─────────────────────────────────────────────────────────
export default function BTIRecognizer({ onClose }) {
  const {
    btiPlanImage, btiRooms, btiMarkers, btiRoomMasks,
    setBtiPlanImage, setBtiRooms, mergeBtiRooms,
    setBtiMarker, removeBtiMarker,
    setBtiRoomMask, removeBtiRoomMask,
    clearBti,
  } = useAppStore()

  const [isDrag,      setIsDrag]      = useState(false)
  const [loading,     setLoading]     = useState(false)
  const [loadMsg,     setLoadMsg]     = useState('')
  const [error,       setError]       = useState(null)
  const [pendingRoom, setPendingRoom] = useState(null)
  const [selectedNum, setSelectedNum] = useState(null)
  const [exLoading,   setExLoading]   = useState(false)

  const planImgRef   = useRef(null)
  const exInputRef   = useRef(null)
  const draggingRef  = useRef(null)
  const planCanvasRef = useRef(null)   // ссылка на кроп-канвас для flood-fill

  // Восстанавливаем канвас из сохранённого dataURL при маунте
  useEffect(() => {
    if (!btiPlanImage || planCanvasRef.current) return
    const img = new Image()
    img.onload = () => {
      const c = document.createElement('canvas')
      c.width = img.naturalWidth; c.height = img.naturalHeight
      c.getContext('2d').drawImage(img, 0, 0)
      planCanvasRef.current = c
    }
    img.src = btiPlanImage
  }, [btiPlanImage])

  // ── drag маркеров ────────────────────────────────────────────────────────
  useEffect(() => {
    const move = e => {
      if (!draggingRef.current || !planImgRef.current) return
      const rect = planImgRef.current.getBoundingClientRect()
      setBtiMarker(draggingRef.current, {
        x: Math.max(0, Math.min(1, (e.clientX - rect.left)  / rect.width)),
        y: Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height)),
      })
    }
    const up = () => { draggingRef.current = null }
    document.addEventListener('mousemove', move)
    document.addEventListener('mouseup',   up)
    return () => { document.removeEventListener('mousemove', move); document.removeEventListener('mouseup', up) }
  }, [setBtiMarker])

  // ── обработка файла плана ─────────────────────────────────────────────────
  const processFile = useCallback(async file => {
    setLoading(true); setError(null); setLoadMsg('Читаю файл…')
    try {
      const canvas = await fileToCanvas(file, 2)
      const origB64 = toDataUrl(canvas).split(',')[1]

      setLoadMsg('Обрезаю поля…')
      const cropped = autocropCanvas(canvas)
      planCanvasRef.current = cropped   // сохраняем канвас для flood-fill
      setBtiPlanImage(toDataUrl(cropped, 0.92))
      setBtiRooms([])

      setLoadMsg('Извлекаю список помещений…')
      const rooms = await extractRooms(origB64, 'image/jpeg')
      setBtiRooms(Array.isArray(rooms) ? rooms : [])
    } catch (e) {
      setError(e.code === 'NO_KEY'
        ? 'Добавьте VITE_ANTHROPIC_API_KEY в .env для распознавания'
        : `Ошибка: ${e.message}`)
    } finally { setLoading(false); setLoadMsg('') }
  }, [setBtiPlanImage, setBtiRooms])

  // ── обработка экспликации ─────────────────────────────────────────────────
  const processExplication = useCallback(async file => {
    setExLoading(true)
    try {
      const canvases = file.type === 'application/pdf'
        ? await pdfAllPages(file, 1.5)
        : [await fileToCanvas(file, 1.5)]

      for (const c of canvases) {
        const rooms = await extractRooms(toDataUrl(c, 0.85).split(',')[1], 'image/jpeg')
        if (Array.isArray(rooms)) mergeBtiRooms(rooms)
      }
    } catch (e) {
      setError(`Ошибка экспликации: ${e.message}`)
    } finally { setExLoading(false) }
  }, [mergeBtiRooms])

  // ── drag-and-drop зона ────────────────────────────────────────────────────
  const onDrop = useCallback(e => {
    e.preventDefault(); setIsDrag(false)
    const file = e.dataTransfer.files[0]
    if (file) processFile(file)
  }, [processFile])
  const onDragOver  = useCallback(e => { e.preventDefault(); setIsDrag(true) }, [])
  const onDragLeave = useCallback(e => { if (!e.currentTarget.contains(e.relatedTarget)) setIsDrag(false) }, [])

  // ── клик по плану → маркер + flood-fill маска ─────────────────────────────
  const handlePlanClick = useCallback(e => {
    if (!pendingRoom || !planImgRef.current) return
    if (e.target.closest('[data-marker-num]')) return

    const rect = planImgRef.current.getBoundingClientRect()
    const nx = Math.max(0, Math.min(1, (e.clientX - rect.left)  / rect.width))
    const ny = Math.max(0, Math.min(1, (e.clientY - rect.top) / rect.height))

    setBtiMarker(pendingRoom, { x: nx, y: ny })

    if (planCanvasRef.current) {
      const cv  = planCanvasRef.current
      const px  = Math.round(nx * cv.width)
      const py  = Math.round(ny * cv.height)
      const room  = btiRooms.find(r => r.number === pendingRoom)
      const color = TYPE_COLOR[room?.type || 'other']
      const mask  = floodFillRoom(cv, px, py, color)
      if (mask) setBtiRoomMask(pendingRoom, mask)
      else      removeBtiRoomMask(pendingRoom)
    }

    setPendingRoom(null)
  }, [pendingRoom, setBtiMarker, btiRooms, setBtiRoomMask, removeBtiRoomMask])

  // ── mousedown на маркере → начало drag ────────────────────────────────────
  const handleContainerMouseDown = useCallback(e => {
    const el = e.target.closest('[data-marker-num]')
    if (!el) return
    e.preventDefault()
    draggingRef.current = el.dataset.markerNum
    setSelectedNum(el.dataset.markerNum)
  }, [])

  // ── пустое состояние ──────────────────────────────────────────────────────
  if (!btiPlanImage) {
    return (
      <div
        style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', background:'#F3F5FA', position:'relative' }}
        onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
      >
        {isDrag && (
          <div style={{ position:'absolute', inset:0, zIndex:50, background:'rgba(238,242,255,0.92)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
            <div style={{ position:'absolute', inset:16, border:'2.5px dashed #6366F1', borderRadius:18 }}/>
            <div style={{ textAlign:'center' }}>
              <div style={{ fontSize:20, fontWeight:700, color:'#4338CA', marginBottom:8 }}>Отпустите файл</div>
              <div style={{ fontSize:13, color:'#6366F1' }}>PDF или фото поэтажного плана</div>
            </div>
          </div>
        )}

        {loading ? (
          <div style={{ flex:1, display:'flex', flexDirection:'column', alignItems:'center', justifyContent:'center', gap:20 }}>
            <div style={{ display:'flex', gap:6 }}>
              {[0,1,2].map(i => <div key={i} style={{ width:10, height:10, borderRadius:'50%', background:'#6366F1', animation:`bimDot 1.2s ease-in-out ${i*0.2}s infinite` }}/>)}
            </div>
            <div style={{ fontSize:15, fontWeight:600, color:'#4338CA' }}>{loadMsg}</div>
          </div>
        ) : (
          <div style={{ flex:1, display:'flex', alignItems:'center', justifyContent:'center', padding:40 }}>
            <div style={{ display:'flex', gap:48, alignItems:'center', maxWidth:720, width:'100%' }}>
              <div style={{ flex:'none', display:'flex', flexDirection:'column', alignItems:'center', gap:16 }}>
                <svg width="130" height="130" viewBox="0 0 130 130" fill="none">
                  <rect x="10" y="15" width="110" height="95" rx="5" fill="#F0F4FF" stroke="#C7D2FE" strokeWidth="1.5"/>
                  <rect x="22" y="28" width="38" height="30" rx="2" fill="#E0E7FF" stroke="#A5B4FC" strokeWidth="1"/>
                  <rect x="68" y="28" width="40" height="30" rx="2" fill="#EEF2FF" stroke="#C7D2FE" strokeWidth="1"/>
                  <rect x="22" y="66" width="86" height="14" rx="2" fill="#F5F3FF" stroke="#DDD6FE" strokeWidth="1"/>
                  <rect x="22" y="87" width="40" height="10" rx="2" fill="#F0F9FF" stroke="#BAE6FD" strokeWidth="1"/>
                  <rect x="68" y="87" width="40" height="10" rx="2" fill="#FFF7ED" stroke="#FED7AA" strokeWidth="1"/>
                  <circle cx="41" cy="43" r="6" fill="#6366F1"/>
                  <circle cx="88" cy="43" r="6" fill="#10B981"/>
                </svg>
                <div style={{ textAlign:'center' }}>
                  <div style={{ fontSize:15, fontWeight:700, color:'#0D1117', marginBottom:6 }}>Загрузка плана БТИ</div>
                  <div style={{ fontSize:12, color:'#6B7280', lineHeight:1.7 }}>
                    Перетащите PDF или фото<br/>поэтажного плана в эту область
                  </div>
                </div>
              </div>

              <div style={{ flex:1, display:'flex', flexDirection:'column', gap:10 }}>
                {[['PDF','Сканы БТИ, экспорт из САПР'],['JPG / PNG','Фото плана'],['WEBP','Фото со смартфона']].map(([fmt,desc]) => (
                  <div key={fmt} style={{ display:'flex', alignItems:'center', gap:12, background:'#FFFFFF', border:'1px solid #E8ECF5', borderRadius:12, padding:'11px 16px' }}>
                    <span style={{ width:42, height:34, borderRadius:8, background:'#EEF2FF', display:'flex', alignItems:'center', justifyContent:'center', fontSize:11, fontWeight:700, color:'#6366F1', flex:'none', fontFamily:"'JetBrains Mono',monospace" }}>{fmt}</span>
                    <div>
                      <div style={{ fontSize:13, fontWeight:500, color:'#0D1117' }}>{fmt}</div>
                      <div style={{ fontSize:11, color:'#9CA3AF' }}>{desc}</div>
                    </div>
                  </div>
                ))}
                <label style={{ marginTop:4, display:'flex', alignItems:'center', justifyContent:'center', gap:8, background:'linear-gradient(135deg,#4F46E5,#7C3AED)', color:'#fff', fontWeight:600, fontSize:13, padding:'11px 0', borderRadius:10, cursor:'pointer', fontFamily:'inherit' }}>
                  <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
                  Выбрать файл
                  <input type="file" accept={ACCEPT} style={{ display:'none' }} onChange={e => e.target.files[0] && processFile(e.target.files[0])}/>
                </label>
                {error && <div style={{ fontSize:12, color:'#DC2626', background:'#FFF1F2', border:'1px solid #FECDD3', borderRadius:8, padding:'8px 12px' }}>{error}</div>}
              </div>
            </div>
          </div>
        )}
      </div>
    )
  }

  // ── план загружен ─────────────────────────────────────────────────────────
  return (
    <div
      style={{ display:'flex', flexDirection:'column', flex:1, overflow:'hidden', background:'#F3F5FA', position:'relative' }}
      onDragOver={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
    >
      {isDrag && (
        <div style={{ position:'absolute', inset:0, zIndex:50, background:'rgba(238,242,255,0.9)', backdropFilter:'blur(4px)', display:'flex', alignItems:'center', justifyContent:'center', pointerEvents:'none' }}>
          <div style={{ position:'absolute', inset:12, border:'2.5px dashed #6366F1', borderRadius:18 }}/>
          <div style={{ fontSize:18, fontWeight:700, color:'#4338CA' }}>Загрузить другой план</div>
        </div>
      )}

      {/* Тулбар */}
      <div style={{ height:52, flex:'none', background:'#FFFFFF', borderBottom:'1px solid #E8ECF5', display:'flex', alignItems:'center', gap:12, padding:'0 18px' }}>
        <button onClick={onClose} style={{ display:'flex', alignItems:'center', gap:6, background:'#F3F5FA', border:'1px solid #E8ECF5', borderRadius:8, padding:'6px 12px', fontSize:12, fontWeight:500, color:'#374151', cursor:'pointer', fontFamily:'inherit' }}>
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M15 18l-6-6 6-6"/></svg>
          К зданию
        </button>

        <span style={{ fontSize:13, fontWeight:600, color:'#0D1117' }}>
          План этажа · {btiRooms.length > 0 ? `${btiRooms.length} помещений` : 'загрузка данных…'}
        </span>

        {/* Подсказка: сколько помещений уже отмечено */}
        {btiRooms.length > 0 && (
          <span style={{ fontSize:11, color:'#9CA3AF', background:'#F3F5FA', border:'1px solid #E8ECF5', borderRadius:6, padding:'3px 8px' }}>
            {Object.keys(btiRoomMasks).length} / {btiRooms.length} нанесено на план
          </span>
        )}

        <label style={{ marginLeft:'auto', display:'flex', alignItems:'center', gap:6, background:'none', border:'1px solid #E8ECF5', borderRadius:8, padding:'6px 12px', fontSize:12, color:'#6B7280', cursor:'pointer', fontFamily:'inherit' }}>
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg>
          Загрузить другой
          <input type="file" accept={ACCEPT} style={{ display:'none' }} onChange={e => { if (e.target.files[0]) { clearBti(); planCanvasRef.current = null; processFile(e.target.files[0]) }}}/>
        </label>
      </div>

      {/* Баннер размещения маркера */}
      {pendingRoom && (
        <div style={{ flex:'none', background:'linear-gradient(90deg,#EEF2FF,#F5F3FF)', borderBottom:'1px solid #C7D2FE', padding:'9px 18px', display:'flex', alignItems:'center', gap:12 }}>
          <div style={{ width:8, height:8, borderRadius:'50%', background:'#6366F1', animation:'bimDot 1.2s ease-in-out infinite', flex:'none' }}/>
          <span style={{ fontSize:13, color:'#3730A3', fontWeight:500 }}>
            Нажмите внутри помещения <strong>№ {pendingRoom}</strong> на плане — контур будет закрашен автоматически
          </span>
          <button onClick={() => setPendingRoom(null)} style={{ marginLeft:'auto', fontSize:12, color:'#6B7280', background:'none', border:'1px solid #E8ECF5', borderRadius:7, padding:'4px 12px', cursor:'pointer', fontFamily:'inherit' }}>
            Отмена
          </button>
        </div>
      )}

      {/* Основной контент */}
      <div style={{ flex:1, display:'flex', overflow:'hidden' }}>

        {/* Левая область: подложка плана с масками и маркерами */}
        <div
          style={{ flex:1, overflow:'auto', padding:20, cursor: pendingRoom ? 'crosshair' : 'default' }}
          onClick={handlePlanClick}
          onMouseDown={handleContainerMouseDown}
        >
          <div style={{ position:'relative', display:'inline-block', width:'100%', minWidth:320 }}>
            <img
              ref={planImgRef}
              src={btiPlanImage}
              draggable={false}
              style={{ width:'100%', display:'block', borderRadius:14, border:'1px solid #E0E5F7', boxShadow:'0 2px 12px rgba(29,78,216,0.08)', userSelect:'none' }}
            />

            {/* Маски помещений (flood-fill) */}
            {Object.entries(btiRoomMasks).map(([num, mask]) => (
              <img
                key={`mask-${num}`}
                src={mask.dataUrl}
                draggable={false}
                style={{
                  position:'absolute',
                  left:`${mask.x * 100}%`,
                  top:`${mask.y * 100}%`,
                  width:`${mask.w * 100}%`,
                  height:`${mask.h * 100}%`,
                  pointerEvents:'none',
                  opacity: selectedNum === num ? 0.75 : 0.45,
                  transition:'opacity .15s',
                  borderRadius:3,
                }}
              />
            ))}

            {/* Маркер-пины поверх масок */}
            {Object.entries(btiMarkers).map(([num, pos]) => {
              const room = btiRooms.find(r => r.number === num)
              return (
                <MarkerPin
                  key={num}
                  number={num}
                  type={room?.type || 'other'}
                  x={pos.x} y={pos.y}
                  selected={selectedNum === num}
                />
              )
            })}
          </div>
        </div>

        {/* Правая панель: список помещений */}
        <aside style={{ width:300, flex:'none', background:'#FFFFFF', borderLeft:'1px solid #E8ECF5', display:'flex', flexDirection:'column', overflow:'hidden' }}>

          <div style={{ padding:'14px 16px 10px', borderBottom:'1px solid #F0F0F5' }}>
            <div style={{ fontSize:10, color:'#9CA3AF', textTransform:'uppercase', letterSpacing:'.6px', fontWeight:600, marginBottom:6, fontFamily:"'JetBrains Mono',monospace" }}>
              ПОМЕЩЕНИЯ {btiRooms.length > 0 && `(${btiRooms.length})`}
            </div>
            {loading && (
              <div style={{ display:'flex', alignItems:'center', gap:8, fontSize:12, color:'#6366F1' }}>
                <div style={{ display:'flex', gap:3 }}>
                  {[0,1,2].map(i => <div key={i} style={{ width:5, height:5, borderRadius:'50%', background:'#6366F1', animation:`bimDot 1s ease-in-out ${i*0.15}s infinite` }}/>)}
                </div>
                {loadMsg}
              </div>
            )}
          </div>

          <div style={{ flex:1, overflow:'auto' }}>
            {btiRooms.length === 0 && !loading ? (
              <div style={{ padding:20, textAlign:'center', color:'#9CA3AF', fontSize:12, lineHeight:1.7 }}>
                Данные помещений не обнаружены<br/>на плане. Добавьте экспликацию.
              </div>
            ) : (
              btiRooms.map(room => {
                const hasMask    = !!btiRoomMasks[room.number]
                const hasMarker  = !!btiMarkers[room.number]
                const isPending  = pendingRoom === room.number
                const isSelected = selectedNum === room.number
                const color      = TYPE_COLOR[room.type] || TYPE_COLOR.other

                return (
                  <div
                    key={room.number}
                    style={{
                      display:'flex', alignItems:'center', gap:10,
                      padding:'9px 14px',
                      background: isPending ? '#EEF2FF' : isSelected ? '#F8F9FE' : 'transparent',
                      borderBottom:'1px solid #F5F5F8',
                      cursor:'pointer',
                      transition:'background .1s',
                    }}
                    onClick={() => setSelectedNum(room.number)}
                  >
                    {/* цветная точка: залита если маска уже есть */}
                    <div style={{
                      width:10, height:10, borderRadius:'50%',
                      background: hasMask ? color : 'transparent',
                      border: hasMask ? 'none' : `2px solid ${color}`,
                      flex:'none', transition:'all .15s',
                    }}/>

                    {/* номер */}
                    <span style={{ fontSize:11, fontWeight:700, color:'#6B7280', fontFamily:"'JetBrains Mono',monospace", minWidth:24 }}>
                      {room.number}
                    </span>

                    {/* название и площадь */}
                    <div style={{ flex:1, minWidth:0 }}>
                      <div style={{ fontSize:12, fontWeight:500, color:'#0D1117', overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap', textTransform:'capitalize' }}>
                        {room.name || TYPE_LABEL[room.type] || '—'}
                      </div>
                      <div style={{ fontSize:10, color:'#9CA3AF' }}>
                        {TYPE_LABEL[room.type] || room.type}{room.area != null ? ` · ${room.area} м²` : ''}
                      </div>
                    </div>

                    {/* кнопка пина */}
                    <button
                      onClick={e => {
                        e.stopPropagation()
                        if (isPending) { setPendingRoom(null); return }
                        setPendingRoom(room.number)
                        setSelectedNum(room.number)
                      }}
                      title={hasMarker ? 'Переразметить помещение' : 'Отметить на плане'}
                      style={{ width:28, height:28, borderRadius:7, border:`1px solid ${isPending ? '#6366F1' : '#E8ECF5'}`, background: isPending ? '#EEF2FF' : '#F8F9FD', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flex:'none', transition:'all .1s' }}
                    >
                      <svg width="13" height="13" viewBox="0 0 24 24" fill={hasMask ? color : 'none'} stroke={isPending ? '#6366F1' : hasMask ? color : '#9CA3AF'} strokeWidth="2">
                        <path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/>
                      </svg>
                    </button>

                    {/* кнопка удаления маркера + маски */}
                    {isSelected && (hasMarker || hasMask) && (
                      <button
                        onClick={e => {
                          e.stopPropagation()
                          removeBtiMarker(room.number)
                          removeBtiRoomMask(room.number)
                          setSelectedNum(null)
                        }}
                        title="Удалить с плана"
                        style={{ width:24, height:24, borderRadius:6, border:'1px solid #FECDD3', background:'#FFF1F2', cursor:'pointer', display:'flex', alignItems:'center', justifyContent:'center', flex:'none', color:'#DC2626' }}
                      >
                        <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
                      </button>
                    )}
                  </div>
                )
              })
            )}
          </div>

          {/* Кнопка добавить экспликацию */}
          <div style={{ padding:14, borderTop:'1px solid #F0F0F5' }}>
            {error && <div style={{ fontSize:11, color:'#DC2626', marginBottom:10, background:'#FFF1F2', border:'1px solid #FECDD3', borderRadius:7, padding:'7px 10px' }}>{error}</div>}
            <label style={{
              display:'flex', alignItems:'center', justifyContent:'center', gap:8,
              background: exLoading ? '#F3F5FA' : 'linear-gradient(135deg,#F0F4FF,#F5F3FF)',
              border:'1.5px dashed #A5B4FC', borderRadius:10,
              padding:'10px 0', cursor: exLoading ? 'default' : 'pointer',
              fontSize:12, fontWeight:600, color:'#4338CA', fontFamily:'inherit',
            }}>
              {exLoading ? (
                <>
                  <div style={{ display:'flex', gap:3 }}>
                    {[0,1,2].map(i => <div key={i} style={{ width:5, height:5, borderRadius:'50%', background:'#6366F1', animation:`bimDot 1s ease-in-out ${i*0.15}s infinite` }}/>)}
                  </div>
                  Читаю экспликацию…
                </>
              ) : (
                <>
                  <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14 2 14 8 20 8"/><line x1="12" y1="18" x2="12" y2="12"/><line x1="9" y1="15" x2="15" y2="15"/></svg>
                  Добавить экспликацию
                </>
              )}
              <input ref={exInputRef} type="file" accept={ACCEPT} style={{ display:'none' }} disabled={exLoading}
                onChange={e => { if (e.target.files[0]) processExplication(e.target.files[0]); e.target.value = '' }}/>
            </label>
            <div style={{ marginTop:8, fontSize:10, color:'#9CA3AF', textAlign:'center', lineHeight:1.5 }}>
              После загрузки нажмите <svg style={{verticalAlign:'middle'}} width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2"><path d="M21 10c0 7-9 13-9 13s-9-6-9-13a9 9 0 0 1 18 0z"/><circle cx="12" cy="10" r="3"/></svg> у помещения<br/>и кликните внутри него на плане
            </div>
          </div>
        </aside>
      </div>
    </div>
  )
}
