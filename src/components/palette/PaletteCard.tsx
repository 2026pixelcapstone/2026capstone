import { Link } from 'react-router-dom'
import type { PaletteSummary } from '../../api/paletteApi'

/** 색 줄무늬 — 색 수가 많으면 칸이 얇아질 뿐 전부 보여줌 */
export function PaletteStrip({ colors, height = 56, rounded = true }: { colors: string[]; height?: number; rounded?: boolean }) {
  return (
    <div className={`flex w-full overflow-hidden${rounded ? ' rounded-lg' : ''}`} style={{ height }}>
      {colors.map((c, i) => (
        <div key={`${c}-${i}`} className="flex-1 min-w-0" style={{ background: c }} title={c} />
      ))}
    </div>
  )
}

/** 작성자 표시 — 공식 팔레트는 'PixelPilot 기본' */
export function PaletteAuthor({ palette }: { palette: Pick<PaletteSummary, 'isOfficial' | 'authorNickname'> }) {
  if (palette.isOfficial) {
    return (
      <span className="inline-flex items-center gap-1" style={{ color: 'var(--color-primary)' }}>
        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>verified</span>
        PixelPilot 기본
      </span>
    )
  }
  return <span>{palette.authorNickname ?? '알 수 없음'}</span>
}

/** 팔레트 카드(목록·프로필 탭 공용) — onSelect가 있으면 링크 대신 선택 버튼(에디터 불러오기 모달) */
export default function PaletteCard({ palette, onSelect }: { palette: PaletteSummary; onSelect?: (p: PaletteSummary) => void }) {
  const body = (
    <>
      <PaletteStrip colors={palette.colors} />
      <div className="px-1 pt-2">
        <p className="text-sm font-bold truncate">{palette.name}</p>
        <div className="flex items-center justify-between mt-0.5 text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
          <span className="truncate"><PaletteAuthor palette={palette} /></span>
          <span className="flex items-center gap-2 shrink-0">
            <span>{palette.colorCount}색</span>
            <span>♥ {palette.likeCount}</span>
          </span>
        </div>
      </div>
    </>
  )
  const className = 'block w-full text-left rounded-xl border p-2.5 transition-all hover:-translate-y-0.5 hover:shadow-xl hover:border-primary'
  const style = { background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }

  return onSelect
    ? <button type="button" onClick={() => onSelect(palette)} className={className} style={style}>{body}</button>
    : <Link to={`/community/palettes/${palette.paletteId}`} className={className} style={style}>{body}</Link>
}
