import { useMemo } from 'react'
import { useTZStore } from '../../store/useTZStore'
import { usePlatformStore } from '../../store/usePlatformStore'
import TZScheduleView from '../TZAnalyzer/TZScheduleView'

const EmptyState = () => (
  <div style={{
    background: '#FFFFFF', border: '1px solid #E8ECF5', borderRadius: 14, padding: 48,
    display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12,
  }}>
    <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="#CBD5E1" strokeWidth="1.4">
      <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z"/>
      <polyline points="14 2 14 8 20 8"/>
      <path d="M8 13h8M8 17h5"/>
    </svg>
    <div style={{ fontSize: 15, fontWeight: 600, color: '#64748B' }}>Нет данных о графике ТО</div>
    <div style={{ fontSize: 13, color: '#94A3B8', textAlign: 'center', lineHeight: 1.6 }}>
      Загрузите и проанализируйте ТЗ в разделе «Анализ ТЗ».<br/>
      После Этапа 3 график ТО появится здесь автоматически.
    </div>
  </div>
)

export default function ScheduleTO() {
  const { systems: tzSystems, buildings: tzBuildings, fileName } = useTZStore()
  const { applied, systemsData, buildings: pBuildings, activeBuildingId } = usePlatformStore()

  const [systems, buildings] = useMemo(() => {
    if (!applied || !systemsData.length) return [tzSystems, tzBuildings]
    const filtered = activeBuildingId
      ? systemsData.filter(s => s.buildingId === activeBuildingId)
      : systemsData
    const bldgs = activeBuildingId
      ? pBuildings.filter(b => b.id === activeBuildingId)
      : pBuildings
    return [filtered, bldgs]
  }, [applied, systemsData, pBuildings, activeBuildingId, tzSystems, tzBuildings])

  const hasData = systems.length > 0 && buildings.length > 0
  const source  = applied ? null : fileName

  return (
    <div style={{ flex: 1, overflow: 'auto', padding: 24, display: 'flex', flexDirection: 'column', gap: 20, background: '#F3F5FA' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 14, flexWrap: 'wrap' }}>
        <div>
          <h1 style={{ margin: 0, fontSize: 22, fontWeight: 700, color: '#0D1117' }}>
            График технического обслуживания
          </h1>
          <p style={{ margin: '6px 0 0', fontSize: 13, color: '#6B7280' }}>
            ТО инженерных систем и оборудования по зданиям
          </p>
        </div>
        {source && (
          <div style={{
            marginLeft: 'auto', fontSize: 12, color: '#0369A1',
            background: '#F0F9FF', border: '1px solid #BAE6FD',
            borderRadius: 8, padding: '5px 12px', whiteSpace: 'nowrap',
          }}>
            Источник: {source}
          </div>
        )}
        {applied && (
          <div style={{
            marginLeft: 'auto', fontSize: 12, color: '#059669',
            background: '#F0FDF4', border: '1px solid #A7F3D0',
            borderRadius: 8, padding: '5px 12px', whiteSpace: 'nowrap',
          }}>
            Применено из ТЗ
          </div>
        )}
      </div>

      {!hasData ? <EmptyState /> : (
        <div style={{ background: '#FFFFFF', border: '1px solid #E8ECF5', borderRadius: 14, padding: 20 }}>
          <TZScheduleView systemsData={systems} buildings={buildings} defaultMode="TO" lockMode hideBuildingSwitcher />
        </div>
      )}
    </div>
  )
}
