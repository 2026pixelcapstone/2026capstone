import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { GalleryPostSummary } from '../../api/galleryApi'

// thumbnailUrl 없을 때 id 기반 그라디언트 placeholder
const GRADIENTS = [
  'linear-gradient(135deg, #6a0dad, var(--color-surface-container), #0d4f8c)',
  'linear-gradient(135deg, #1a3a5c, #2d6a8f, #e8f4f8)',
  'linear-gradient(135deg, #ff6b35, #f7c59f, #4ecdc4)',
  'linear-gradient(135deg, #2c1810, #8b4513, #d4a574)',
  'linear-gradient(135deg, var(--color-accent), #c0392b, #2c3e50)',
  'linear-gradient(135deg, #0d2818, #1a5c2a, #2d8f3e)',
  'linear-gradient(135deg, #1a0a2e, #4a1060, #8b2de0)',
  'linear-gradient(135deg, #0a1628, #0d3a6b, #1a6bbf)',
]
export function gradientOf(id: number) {
  return GRADIENTS[id % GRADIENTS.length]
}

export function SkeletonCard({ className }: { className?: string }) {
  return <div className={`animate-pulse rounded-lg ${className ?? ''}`} style={{ background: 'var(--color-surface-container)' }} />
}

/** 가운데 피드 섹션 헤더(제목 + 전체 보기) */
export function SectionHeader({ eyebrow, title, to, linkLabel }: { eyebrow?: string; title: string; to?: string; linkLabel?: string }) {
  return (
    <div className="flex justify-between items-end mb-4">
      <div>
        {eyebrow && (
          <span className="block text-xs font-bold tracking-widest uppercase mb-1" style={{ color: 'var(--color-primary)' }}>{eyebrow}</span>
        )}
        <h2 className="text-xl font-bold tracking-tight">{title}</h2>
      </div>
      {to && linkLabel && (
        <Link to={to} className="flex items-center gap-1 font-semibold text-sm hover:underline underline-offset-4 shrink-0"
          style={{ color: 'var(--color-primary)' }}>
          {linkLabel}
          <span className="material-symbols-outlined text-base">arrow_forward</span>
        </Link>
      )}
    </div>
  )
}

/** 작품 정사각 타일(hover 시 제목·작가, 전용 갤러리면 작은 배지) */
export function WorkTile({ post }: { post: GalleryPostSummary }) {
  return (
    <Link to={`/gallery/${post.postId}`} className="aspect-square rounded-lg overflow-hidden relative group"
      style={{ background: post.thumbnailUrl ? undefined : gradientOf(post.postId) }}>
      {post.thumbnailUrl && (
        <img src={post.thumbnailUrl} alt={post.title} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
      )}
      {post.galleryType === 'DEDICATED' && (
        <span className="absolute top-1.5 left-1.5 px-1.5 py-0.5 rounded text-[10px] font-bold"
          style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>.ppit</span>
      )}
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1 p-2">
        <span className="text-white font-bold text-sm text-center line-clamp-2">{post.title}</span>
        <span className="text-xs" style={{ color: 'rgba(255,255,255,0.75)' }}>by {post.authorNickname} · ♥ {post.likeCount}</span>
      </div>
    </Link>
  )
}

/** 레일 안 작은 카드 */
export function RailCard({ title, icon, to, linkLabel, children }: { title: string; icon: string; to?: string; linkLabel?: string; children: ReactNode }) {
  return (
    <section className="rounded-xl border p-4" style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-bold flex items-center gap-1.5">
          <span className="material-symbols-outlined text-base" style={{ color: 'var(--color-primary)' }}>{icon}</span>
          {title}
        </h3>
        {to && linkLabel && (
          <Link to={to} className="text-xs font-bold hover:underline" style={{ color: 'var(--color-primary)' }}>{linkLabel}</Link>
        )}
      </div>
      {children}
    </section>
  )
}
