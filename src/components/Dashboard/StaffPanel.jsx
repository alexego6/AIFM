// Окно «Исполнители» в Дашборде: реестр персон активного объекта.
// Переименование (id стабилен — привязки тикетов сохраняются), добавление,
// удаление с перераспределением открытых тикетов дня.

import { useState } from 'react'
import { useStaffStore } from '../../store/useStaffStore'
import { useTicketsStore } from '../../store/useTicketsStore'

const KIND_LABEL = {
  engineer:   'Инженер',
  technician: 'Техник',
  watchman:   'Суточник',
}

const KIND_COLOR = {
  engineer:   '#7C3AED',
  technician: '#1D4ED8',
  watchman:   '#059669',
}

const inputStyle = {
  fontSize: 12, padding: '6px 10px', borderRadius: 8, border: '1px solid #E2E8F0',
  fontFamily: 'inherit', color: '#0D1117', outline: 'none', width: '100%',
}

function PersonRow({ person, onRename, onRemove }) {
  const [editing, setEditing] = useState(false)
  const [name, setName] = useState(person.name)
  const [role, setRole] = useState(person.role)
  const color = KIND_COLOR[person.kind] ?? '#6B7280'

  async function save() {
    await onRename(person.id, { name, role })
    setEditing(false)
  }

  if (editing) {
    return (
      <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', background: '#F8FAFC', borderRadius: 8 }}>
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
          <input style={inputStyle} value={name} onChange={e => setName(e.target.value)} placeholder="ФИО" autoFocus />
          <input style={inputStyle} value={role} onChange={e => setRole(e.target.value)} placeholder="Должность" />
        </div>
        <button onClick={save}
          style={{ fontSize: 12, fontWeight: 600, color: '#FFFFFF', background: '#1D4ED8', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
          Сохранить
        </button>
        <button onClick={() => { setName(person.name); setRole(person.role); setEditing(false) }}
          style={{ fontSize: 12, color: '#6B7280', background: 'none', border: '1px solid #E2E8F0', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
          Отмена
        </button>
      </div>
    )
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, border: '1px solid #F1F5F9' }}>
      <div style={{ width: 30, height: 30, borderRadius: '50%', flexShrink: 0, background: color + '15', border: `1px solid ${color}33`, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 10, fontWeight: 700, color }}>
        {person.name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase()}
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontSize: 13, fontWeight: 600, color: '#0D1117', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{person.name}</div>
        <div style={{ fontSize: 11, color: '#6B7280' }}>{person.role}{person.shift ? ` · смена ${person.shift}` : ''}</div>
      </div>
      <span style={{ fontSize: 10, fontWeight: 600, color, background: color + '12', padding: '2px 8px', borderRadius: 5, flexShrink: 0 }}>
        {KIND_LABEL[person.kind] ?? person.kind}
      </span>
      <button title="Переименовать" onClick={() => setEditing(true)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4, display: 'flex' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
      </button>
      <button title="Удалить" onClick={() => onRemove(person)}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#9CA3AF', padding: 4, display: 'flex' }}>
        <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M3 6h18M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2m3 0v14a2 2 0 0 1-2 2H7a2 2 0 0 1-2-2V6"/></svg>
      </button>
    </div>
  )
}

export default function StaffPanel({ buildingId }) {
  const { staff, renamePerson, removePerson, addPerson } = useStaffStore()
  const { tickets, redistributeAfterRemoval } = useTicketsStore()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [newRole, setNewRole] = useState('')

  const list = staff.filter(p => p.buildingId === buildingId)

  async function handleRemove(person) {
    const openDates = [...new Set(
      tickets.filter(t => t.assigneeId === person.id && t.status === 'open').map(t => t.date)
    )]
    await removePerson(person.id)
    if (openDates.length > 0) {
      const remaining = useStaffStore.getState().staff
      await redistributeAfterRemoval(person.id, remaining, openDates)
    }
  }

  async function handleAdd() {
    if (!newName.trim() && !newRole.trim()) { setAdding(false); return }
    await addPerson(buildingId, { name: newName, role: newRole })
    setNewName(''); setNewRole(''); setAdding(false)
  }

  return (
    <div style={{ background: '#FFFFFF', border: '1px solid #E8ECF5', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
        <h3 style={{ margin: 0, fontSize: 14, fontWeight: 600, color: '#0D1117' }}>Исполнители</h3>
        <button onClick={() => setAdding(true)}
          style={{ fontSize: 12, fontWeight: 600, color: '#1D4ED8', background: '#EFF6FF', border: '1px solid #BFDBFE', borderRadius: 8, padding: '5px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
          + Добавить
        </button>
      </div>

      {list.length === 0 && (
        <div style={{ fontSize: 12, color: '#9CA3AF', padding: '16px 0', textAlign: 'center' }}>
          Реестр пуст — применение ТЗ заполнит штат автоматически
        </div>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, maxHeight: 320, overflowY: 'auto' }}>
        {list.map(p => (
          <PersonRow key={p.id} person={p} onRename={renamePerson} onRemove={handleRemove} />
        ))}
      </div>

      {adding && (
        <div style={{ display: 'flex', gap: 8, alignItems: 'center', padding: '8px 12px', background: '#F8FAFC', borderRadius: 8 }}>
          <div style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 6 }}>
            <input style={inputStyle} value={newName} onChange={e => setNewName(e.target.value)} placeholder="ФИО" autoFocus />
            <input style={inputStyle} value={newRole} onChange={e => setNewRole(e.target.value)} placeholder="Должность (Техник-электрик, Инженер…)" />
          </div>
          <button onClick={handleAdd}
            style={{ fontSize: 12, fontWeight: 600, color: '#FFFFFF', background: '#1D4ED8', border: 'none', borderRadius: 8, padding: '7px 14px', cursor: 'pointer', fontFamily: 'inherit' }}>
            Добавить
          </button>
          <button onClick={() => setAdding(false)}
            style={{ fontSize: 12, color: '#6B7280', background: 'none', border: '1px solid #E2E8F0', borderRadius: 8, padding: '7px 12px', cursor: 'pointer', fontFamily: 'inherit' }}>
            Отмена
          </button>
        </div>
      )}
    </div>
  )
}
