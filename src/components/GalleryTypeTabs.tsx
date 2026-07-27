import { Link } from 'react-router-dom'

/**
 * 자유 ↔ 전용 갤러리 전환 세그먼트 탭.
 * 네비 드롭다운 없이도 갤러리 페이지 안에서 서로 오갈 수 있게 한다.
 */
export default function GalleryTypeTabs({ current }: { current: 'free' | 'dedicated' }) {
  const base = 'px-5 py-2 rounded-lg text-sm font-bold transition-colors'
  return (
    <div className="inline-flex gap-1 p-1 rounded-xl mb-8"
      style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline)' }}>
      <Link to="/gallery/free"
        aria-current={current === 'free' ? 'page' : undefined}
        className={`${base} ${current === 'free' ? 'bg-primary text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
        자유 갤러리
      </Link>
      <Link to="/gallery/exclusive"
        aria-current={current === 'dedicated' ? 'page' : undefined}
        className={`${base} ${current === 'dedicated' ? 'bg-accent text-on-primary' : 'text-on-surface-variant hover:text-on-surface'}`}>
        전용 갤러리
      </Link>
    </div>
  )
}
