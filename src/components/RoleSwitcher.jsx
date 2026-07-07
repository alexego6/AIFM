// Переключатель роли в шапке (вместо захардкоженного «И. Петров»).
// Клиентские представления, НЕ безопасность. Для техника — выбор персоны.

import { useState, useEffect } from 'react'
import { useSessionStore } from '../store/useSessionStore'
import { useStaffStore } from '../store/useStaffStore'
import { ROLES } from '../config/roleAccess'

const ROLE_COLORS = {
  executor: '#059669',
  chief:    '#1D4ED8',
  customer: '#D97706',
  director: '#7C3AED',
}

export default function RoleSwitcher() {
  const { role, personId, setRole } = useSessionStore()
  const { staff, loadFromDB } = useStaffStore()
  const [open, setOpen] = useState(false)

  useEffect(() => { loadFromDB() }, [])  // eslint-disable-line react-hooks/exhaustive-deps

  const person = staff.find(p => p.id === personId)
  const color = ROLE_COLORS[role] ?? '#1D4ED8'
  const displayName = role === 'executor' && person ? person.name : ROLES[role]?.label ?? role
  const displayRole = role === 'executor' && person ? person.role : ROLES[role]?.short ?? ''
  const initials = displayName.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()

  return (
    <div style={{ position: 'relative' }}>
      <button onClick={() => setOpen(o => !o)}
        style={{ display: 'flex', alignItems: 'center', gap: 10, paddingLeft: 4, background: 'none', border: 'none',
          cursor: 'pointer', fontFamily: 'inherit', borderLeft: '1px solid #E8ECF5', marginLeft: 2 }}>
        <div style={{ width: 34, height: 34, borderRadius: '50%', background: `linear-gradient(135deg,${color},#1D4ED8)`,
          display: 'flex', alignItems: 'center', justifyContent: 'center', fontWeight: 600, fontSize: 13, color: '#FFFFFF' }}>
          {initials}
        </div>
        <div style={{ lineHeight: 1.15, textAlign: 'left' }}>
          <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1117' }}>{displayName}</div>
          <div style={{ fontSize: 11, color: '#9CA3AF' }}>{displayRole}</div>
        </div>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="#9CA3AF" strokeWidth="2">
          <polyline points="6 9 12 15 18 9"/>
        </svg>
      </button>

      {open && (
        <div style={{ position: 'absolute', right: 0, top: 46, zIndex: 200, background: '#FFFFFF',
          border: '1px solid #E8ECF5', borderRadius: 12, boxShadow: '0 8px 30px rgba(0,0,0,.12)',
          padding: 8, width: 280, display: 'flex', flexDirection: 'column', gap: 2 }}>
          <div style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase',
            letterSpacing: '.5px', padding: '6px 10px' }}>
            Роль (представление)
          </div>
          {Object.entries(ROLES).map(([key, r]) => (
            <div key={key}>
              <button
                onClick={() => {
                  if (key !== 'executor') { setRole(key); setOpen(false) }
                }}
                style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', textAlign: 'left',
                  padding: '8px 10px', borderRadius: 8, border: 'none', fontFamily: 'inherit', fontSize: 13,
                  cursor: key === 'executor' ? 'default' : 'pointer',
                  background: role === key ? '#EFF6FF' : 'transparent',
                  color: role === key ? '#1D4ED8' : '#0D1117',
                  fontWeight: role === key ? 600 : 400 }}>
                <span style={{ width: 8, height: 8, borderRadius: '50%', background: ROLE_COLORS[key], flexShrink: 0 }} />
                {r.label}
              </button>
              {/* Техник: выбор персоны из реестра */}
              {key === 'executor' && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 1, paddingLeft: 22, maxHeight: 180, overflowY: 'auto' }}>
                  {staff.length === 0 && (
                    <div style={{ fontSize: 11, color: '#9CA3AF', padding: '4px 10px' }}>Реестр пуст — примените ТЗ</div>
                  )}
                  {staff.map(p => (
                    <button key={p.id}
                      onClick={() => { setRole('executor', p.id); setOpen(false) }}
                      style={{ textAlign: 'left', padding: '5px 10px', borderRadius: 7, border: 'none',
                        fontFamily: 'inherit', fontSize: 12, cursor: 'pointer',
                        background: personId === p.id ? '#ECFDF5' : 'transparent',
                        color: personId === p.id ? '#059669' : '#374151',
                        fontWeight: personId === p.id ? 600 : 400 }}>
                      {p.name} <span style={{ color: '#9CA3AF' }}>· {p.role}</span>
                    </button>
                  ))}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
