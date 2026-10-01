import { LocationSuggestions } from './LocationSuggestions'
import { DatePickerPanel } from './DatePickerPanel'
import { GuestsPanel } from './GuestsPanel'
import type { SearchPanel, CompactSearchState } from '@/hooks/useCompactSearch'
import type { CityInfo } from '@/types/listing'

interface SearchPanelProps {
  active: SearchPanel | null
  state: CompactSearchState
  setState: React.Dispatch<React.SetStateAction<CompactSearchState>>
  recommended?: CityInfo[]
  /** 单月（用于 HeroSearch）或双月（用于 CompactTopbar） */
  variant?: 'single' | 'double'
}

/**
 * 搜索面板容器：根据 active 渲染对应的子面板
 * - location: LocationSuggestions
 * - dates: DatePickerPanel
 * - guests: GuestsPanel
 */
export function SearchPanel({
  active,
  state,
  setState,
  recommended,
  variant = 'double',
}: SearchPanelProps) {
  return (
    <>
      {(active === 'location' || active === null) && (
        <div className={(active === 'location' || active === null) ? 'block' : 'hidden'}>
          <LocationSuggestions
            value={state.city}
            onChange={(v) => setState((s) => ({ ...s, city: v }))}
            onPick={(city) => {
              setState((s) => ({ ...s, city }))
              // 选完城市后停在 location panel，不自动跳转
              // 用户可以手动点其他 segment 切换
            }}
            recommended={recommended}
            focused={active === 'location' || active === null}
          />
        </div>
      )}
      {active === 'dates' && (
        <DatePickerPanel
          checkIn={state.checkIn}
          checkOut={state.checkOut}
          variant={variant}
          onChange={(inDate, outDate) => setState((s) => ({ ...s, checkIn: inDate, checkOut: outDate }))}
        />
      )}
      {active === 'guests' && (
        <GuestsPanel
          value={state.guests}
          onChange={(v) => setState((s) => ({ ...s, guests: v }))}
        />
      )}
    </>
  )
}
