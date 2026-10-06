import type { ReactNode } from 'react'
import { Link } from 'react-router-dom'
import type { GalleryPostSummary } from '../../api/galleryApi'
import type { AssetSummary } from '../../api/assetApi'

/** 유저 카드에 필요한 최소 필드 — 팔로잉/팔로워 응답 타입이 페이지마다 달라 공통 부분만 받음 */
export interface ProfileUserSummary {
  userId: number
  nickname: string
  profileImageUrl: string | null
  followerCount: number
}

const THUMB_FALLBACK = 'linear-gradient(135deg,var(--color-surface),var(--color-surface-container))'

/** 갤러리 작품 카드(정사각형 썸네일 + hover 시 제목·통계). showAuthor면 작가 이름도 표시(좋아요 탭) */
export function WorkCard({ post, showAuthor = false }: { post: GalleryPostSummary; showAuthor?: boolean }) {
  return (
    <Link to={`/gallery/${post.postId}`}
      className="group aspect-square rounded-xl overflow-hidden relative"
      style={{ background: 'var(--color-surface-container)' }}>
      {post.thumbnailUrl
        ? <img src={post.thumbnailUrl} alt={post.title} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
        : <div className="w-full h-full" style={{ background: THUMB_FALLBACK }} />
      }
      <div className="absolute inset-0 bg-black/50 opacity-0 group-hover:opacity-100 transition-opacity flex flex-col items-center justify-center gap-1">
        <p className="text-xs font-bold text-white text-center px-2 line-clamp-2">{post.title}</p>
        {showAuthor && <p className="text-xs" style={{ color: '#ccc' }}>{post.authorNickname}</p>}
        <div className="flex items-center gap-2 text-xs" style={{ color: '#ccc' }}>
          <span>♥ {post.likeCount}</span>
          <span>👁 {post.viewCount}</span>
        </div>
      </div>
    </Link>
  )
}

/** 에셋 카드(썸네일 + 제목·가격·좋아요) */
export function AssetCard({ asset }: { asset: AssetSummary }) {
  return (
    <Link to={`/assets/${asset.assetId}`}
      className="group rounded-xl overflow-hidden border transition-all hover:-translate-y-0.5 hover:shadow-xl hover:border-primary"
      style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}>
      <div className="aspect-square overflow-hidden">
        {asset.thumbnailUrl
          ? <img src={asset.thumbnailUrl} alt={asset.title} className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
          : <div className="w-full h-full" style={{ background: THUMB_FALLBACK }} />
        }
      </div>
      <div className="p-2">
        <p className="text-xs font-bold truncate">{asset.title}</p>
        <div className="flex items-center justify-between mt-1">
          <span className="text-xs font-bold" style={{ color: asset.isFree ? 'var(--color-success)' : 'var(--color-primary)' }}>
            {asset.isFree ? '무료' : `₩${asset.price.toLocaleString()}`}
          </span>
          <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>♥ {asset.likeCount}</span>
        </div>
      </div>
    </Link>
  )
}

/** 팔로잉/팔로워 유저 카드 — 카드 전체가 프로필 링크(버튼 모양 배지 없음) */
export function UserCard({ user }: { user: ProfileUserSummary }) {
  return (
    <Link to={`/profile/${user.nickname}`}
      className="rounded-xl border p-4 text-center hover:shadow-md hover:border-primary transition-all"
      style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}>
      <div className="w-14 h-14 rounded-xl flex items-center justify-center text-white font-bold text-xl mx-auto mb-2 overflow-hidden"
        style={{ background: user.profileImageUrl ? undefined : 'linear-gradient(135deg,var(--color-primary),var(--color-secondary))' }}>
        {user.profileImageUrl
          ? <img src={user.profileImageUrl} alt={user.nickname} className="w-full h-full object-cover" />
          : user.nickname.slice(0, 2).toUpperCase()
        }
      </div>
      <div className="font-bold text-sm truncate">{user.nickname}</div>
      <div className="text-xs mt-0.5" style={{ color: 'var(--color-on-surface-variant)' }}>
        팔로워 {user.followerCount.toLocaleString()}
      </div>
    </Link>
  )
}

/** 빈 탭 안내 — action이 있으면 행동 유도 버튼 표시(이때 문구도 굵게) */
export function EmptyTab({ icon, text, action }: { icon: string; text: string; action?: { to: string; label: string } }) {
  return (
    <div className="flex flex-col items-center justify-center py-24 gap-3">
      <span className="material-symbols-outlined text-4xl" style={{ color: 'var(--color-outline)' }}>{icon}</span>
      <p className={`text-sm${action ? ' font-bold' : ''}`} style={{ color: 'var(--color-on-surface-variant)' }}>{text}</p>
      {action && (
        <Link to={action.to}
          className="px-4 py-2 rounded-xl font-bold text-sm hover:opacity-90"
          style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
          {action.label}
        </Link>
      )}
    </div>
  )
}

/** 로딩 스켈레톤 — square: 작품·에셋 3열 6칸 / user: 유저 카드 4칸 */
export function GridSkeleton({ variant }: { variant: 'square' | 'user' }) {
  if (variant === 'user') {
    return (
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
        {Array.from({ length: 4 }).map((_, i) => (
          <div key={i} className="rounded-xl border p-4 animate-pulse"
            style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)', height: 140 }} />
        ))}
      </div>
    )
  }
  return (
    <div className="grid grid-cols-3 gap-4">
      {Array.from({ length: 6 }).map((_, i) => (
        <div key={i} className="aspect-square rounded-xl animate-pulse" style={{ background: 'var(--color-surface-container)' }} />
      ))}
    </div>
  )
}

/** 카드 그리드 래퍼 — square: 3열 / user: 반응형 2~4열 */
export function CardGrid({ variant, children }: { variant: 'square' | 'user'; children: ReactNode }) {
  return (
    <div className={variant === 'user' ? 'grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3' : 'grid grid-cols-3 gap-4'}>
      {children}
    </div>
  )
}
