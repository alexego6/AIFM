import { useRef, useState } from 'react'

const ACCEPT = '.docx,.pdf,.txt,.xlsx,.xls'

export default function TZUploadZone({ onFile }) {
  const [drag, setDrag] = useState(false)
  const inputRef = useRef()

  function handleDrop(e) {
    e.preventDefault()
    setDrag(false)
    const file = e.dataTransfer.files[0]
    if (file) onFile(file)
  }

  function handleChange(e) {
    const file = e.target.files[0]
    if (file) onFile(file)
    e.target.value = ''
  }

  return (
    <div style={{ flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 40 }}>
      <div
        onDragOver={e => { e.preventDefault(); setDrag(true) }}
        onDragLeave={e => { if (!e.currentTarget.contains(e.relatedTarget)) setDrag(false) }}
        onDrop={handleDrop}
        style={{
          width: '100%', maxWidth: 560,
          border: `2px dashed ${drag ? '#1D4ED8' : '#CBD5E1'}`,
          borderRadius: 18,
          background: drag ? 'rgba(29,78,216,0.04)' : '#FFFFFF',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 16, padding: '48px 40px',
          transition: 'border-color 0.2s, background 0.2s',
          userSelect: 'none',
        }}
      >
        <svg width="52" height="52" viewBox="0 0 24 24" fill="none" stroke={drag ? '#1D4ED8' : '#94A3B8'} strokeWidth="1.3">
          <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
          <polyline points="14 2 14 8 20 8"/>
          <path d="M8 13h8M8 17h5"/>
        </svg>

        <div style={{ textAlign: 'center' }}>
          <div style={{ fontSize: 18, fontWeight: 600, color: drag ? '#1D4ED8' : '#1E293B', marginBottom: 6 }}>
            {drag ? 'Отпустите файл ТЗ' : 'Загрузите техническое задание'}
          </div>
          <div style={{ fontSize: 13, color: '#64748B', lineHeight: 1.6 }}>
            Перетащите файл в эту область или нажмите кнопку ниже
          </div>
        </div>

        <label style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          padding: '11px 28px', borderRadius: 10, cursor: 'pointer',
          background: 'linear-gradient(135deg,#1D4ED8,#7C3AED)',
          color: '#FFFFFF', fontSize: 14, fontWeight: 600,
          fontFamily: "'Golos Text',system-ui,sans-serif",
        }}>
          <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
            <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
            <polyline points="17 8 12 3 7 8"/>
            <line x1="12" y1="3" x2="12" y2="15"/>
          </svg>
          Выбрать файл
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPT}
            style={{ display: 'none' }}
            onChange={handleChange}
          />
        </label>

        <div style={{ display: 'flex', gap: 8, fontSize: 11, color: '#94A3B8', letterSpacing: '.3px' }}>
          {['DOCX', 'XLSX', 'XLS', 'PDF', 'TXT'].map(fmt => (
            <span key={fmt} style={{ background: '#F1F5F9', borderRadius: 6, padding: '3px 10px' }}>{fmt}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
