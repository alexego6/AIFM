import { useRef, useState } from 'react'

const ACCEPT = '.docx,.pdf,.txt'
const ACCEPT_MIME = ['application/vnd.openxmlformats-officedocument.wordprocessingml.document', 'application/pdf', 'text/plain']

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
        onClick={() => inputRef.current?.click()}
        style={{
          width: '100%', maxWidth: 560,
          border: `2px dashed ${drag ? '#1D4ED8' : '#CBD5E1'}`,
          borderRadius: 18,
          background: drag ? 'rgba(29,78,216,0.04)' : '#FFFFFF',
          display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
          gap: 16, padding: '60px 40px',
          cursor: 'pointer',
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
            Перетащите сюда или нажмите для выбора
            <br />
            <strong>DOCX</strong>, <strong>PDF</strong> или <strong>TXT</strong>
          </div>
        </div>

        <div style={{
          display: 'flex', gap: 8,
          fontSize: 11, color: '#94A3B8', letterSpacing: '.3px',
        }}>
          {['DOCX', 'PDF', 'TXT'].map(fmt => (
            <span key={fmt} style={{ background: '#F1F5F9', borderRadius: 6, padding: '3px 10px' }}>{fmt}</span>
          ))}
        </div>

        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          style={{ display: 'none' }}
          onChange={handleChange}
        />
      </div>
    </div>
  )
}
