import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { assetApi, type AssetResponse, type AssetCommentResponse } from '../api/assetApi'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'
import { getErrorMessage, getErrorStatus } from '../lib/errorUtils'

const RATING_DIST = [78, 15, 5, 1, 1]

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>()
  const assetId = Number(id)
  const { isLoggedIn } = useAuthStore()
  const navigate = useNavigate()

  const [asset, setAsset] = useState<AssetResponse | null>(null)
  const [comments, setComments] = useState<AssetCommentResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [selectedThumb, setSelectedThumb] = useState(0)
  const [purchasing, setPurchasing] = useState(false)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [assetRes, commentsRes] = await Promise.all([
          assetApi.getAsset(assetId),
          assetApi.getComments(assetId, { size: 20 }),
        ])
        setAsset(assetRes.data.data)
        setComments(commentsRes.data.data.content)
      } catch (err) {
        const status = getErrorStatus(err)
        if (status === 403) navigate('/403', { replace: true })
        else if (status && status >= 500) navigate('/500', { replace: true })
        else setAsset(null)
      } finally {
        setLoading(false)
      }
    }
    if (assetId) fetchAll()
  }, [assetId])

  const handleLike = async () => {
    if (!isLoggedIn || !asset) return
    try {
      const res = await assetApi.toggleLike(assetId)
      const isLiked = res.data.data
      setAsset(prev => prev ? {
        ...prev,
        isLiked,
        likeCount: isLiked ? prev.likeCount + 1 : prev.likeCount - 1,
      } : prev)
    } catch (err) {
      toast.error(getErrorMessage(err, '좋아요 처리에 실패했습니다.'))
    }
  }

  const handlePurchase = async () => {
    if (!isLoggedIn || !asset) return
    setPurchasing(true)
    try {
      await assetApi.purchase(assetId)
      setAsset(prev => prev ? { ...prev, isPurchased: true, downloadCount: prev.downloadCount + 1 } : prev)
      toast.success('구매가 완료되었습니다.')
    } catch (err) {
      toast.error(getErrorMessage(err, '구매에 실패했습니다.'))
    } finally {
      setPurchasing(false)
    }
  }

  const handleComment = async () => {
    if (!commentText.trim() || !isLoggedIn) return
    setSubmitting(true)
    try {
      const res = await assetApi.createComment(assetId, { content: commentText.trim() })
      setComments(prev => [res.data.data, ...prev])
      setCommentText('')
      setAsset(prev => prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev)
    } catch (err) {
      toast.error(getErrorMessage(err, '댓글 등록에 실패했습니다.'))
    } finally {
      setSubmitting(false)
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#0d1117' }}>
        <div className="animate-spin rounded-full w-10 h-10 border-2 border-t-transparent" style={{ borderColor: '#2f81f7' }} />
      </div>
    )
  }

  if (!asset) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" style={{ background: '#0d1117', color: '#e6edf3' }}>
        <span className="material-symbols-outlined text-5xl" style={{ color: '#30363d' }}>inventory_2</span>
        <p style={{ color: '#7d8590' }}>에셋을 찾을 수 없습니다.</p>
        <Link to="/assets" className="text-sm font-bold" style={{ color: '#2f81f7' }}>에셋 스토어로 돌아가기</Link>
      </div>
    )
  }

  const images = asset.imageUrls.length > 0 ? asset.imageUrls : [asset.thumbnailUrl].filter(Boolean) as string[]
  const isFreeAsset = asset.isFree || asset.price === 0
  const canDownload = isFreeAsset || asset.isPurchased

  return (
    <div style={{ background: '#0d1117', color: '#e6edf3' }}>
      <div className="max-w-[1440px] mx-auto px-8 py-8">
        {/* 브레드크럼 */}
        <div className="flex items-center gap-2 mb-6 text-sm" style={{ color: '#7d8590' }}>
          <Link to="/assets" className="hover:text-white transition-colors">에셋 스토어</Link>
          <span className="material-symbols-outlined text-sm">chevron_right</span>
          <span style={{ color: '#e6edf3' }}>{asset.title}</span>
        </div>

        {/* 상단: 프리뷰 + 구매 패널 */}
        <div className="flex gap-8 mb-12">
          {/* 프리뷰 */}
          <div className="flex-1">
            <div className="checkerboard rounded-2xl border mb-3 flex items-center justify-center overflow-hidden"
              style={{ height: 320, borderColor: '#30363d' }}>
              {images[selectedThumb]
                ? <img src={images[selectedThumb]} alt={asset.title}
                    className="max-w-full max-h-full object-contain"
                    style={{ imageRendering: 'pixelated' }} />
                : <div className="w-48 h-48 rounded-xl" style={{ background: 'linear-gradient(135deg, #161b22, #21262d)' }} />
              }
            </div>
            {images.length > 1 && (
              <div className="flex gap-2 flex-wrap">
                {images.slice(0, 7).map((url, i) => (
                  <button key={i} onClick={() => setSelectedThumb(i)}
                    className="w-16 h-16 checkerboard rounded-xl border-2 transition-all overflow-hidden"
                    style={{ borderColor: selectedThumb === i ? '#2f81f7' : '#30363d' }}>
                    <img src={url} alt="" className="w-full h-full object-cover" style={{ imageRendering: 'pixelated' }} />
                  </button>
                ))}
                {images.length > 7 && (
                  <div className="w-16 h-16 checkerboard rounded-xl border-2 flex items-center justify-center text-sm font-bold"
                    style={{ borderColor: '#30363d', color: '#7d8590' }}>
                    +{images.length - 7}
                  </div>
                )}
              </div>
            )}
          </div>

          {/* 구매 패널 */}
          <div className="w-80 shrink-0">
            <div className="rounded-2xl border p-6" style={{ background: '#292f38', borderColor: '#30363d' }}>
              <div className="flex items-center gap-2 mb-2">
                <span className="px-2 py-0.5 rounded-lg text-xs font-bold"
                  style={{ background: 'rgba(63,185,80,0.1)', color: '#3fb950', border: '1px solid rgba(63,185,80,0.2)' }}>
                  {isFreeAsset ? '무료' : '유료'}
                </span>
                {asset.licenseTypeName && (
                  <span className="px-2 py-0.5 rounded-lg text-xs font-bold"
                    style={{ background: 'rgba(47,129,247,0.1)', color: '#2f81f7', border: '1px solid rgba(47,129,247,0.2)' }}>
                    {asset.licenseTypeName}
                  </span>
                )}
              </div>
              <h1 className="text-2xl font-bold mb-1">{asset.title}</h1>
              <Link to={`/profile/${asset.authorNickname}`} className="text-sm hover:underline" style={{ color: '#2f81f7' }}>
                @{asset.authorNickname}
              </Link>
              <div className="grid grid-cols-3 gap-2 my-4 text-center">
                {[
                  ['❤️ ' + asset.likeCount.toLocaleString(), '좋아요'],
                  [asset.downloadCount.toLocaleString(), '다운로드'],
                  [asset.commentCount.toString(), '댓글'],
                ].map(([val, label]) => (
                  <div key={label} className="rounded-xl py-2" style={{ background: '#21262d' }}>
                    <p className="font-bold text-sm">{val}</p>
                    <p className="text-xs mt-0.5" style={{ color: '#7d8590' }}>{label}</p>
                  </div>
                ))}
              </div>

              <div className="py-4 border-y mb-4" style={{ borderColor: '#30363d' }}>
                <p className="text-4xl font-bold" style={{ color: isFreeAsset ? '#3fb950' : '#2f81f7' }}>
                  {isFreeAsset ? '무료' : `₩${asset.price.toLocaleString()}`}
                </p>
              </div>

              {canDownload ? (
                <a href={asset.imageUrls[0] ?? '#'} download
                  className="w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 mb-2 hover:opacity-90 transition-opacity"
                  style={{ background: '#2f81f7', color: '#fff', display: 'flex' }}>
                  <span className="material-symbols-outlined text-base">download</span>
                  다운로드
                </a>
              ) : (
                <button
                  onClick={handlePurchase}
                  disabled={!isLoggedIn || purchasing}
                  className="w-full py-3.5 rounded-xl font-bold flex items-center justify-center gap-2 mb-2 hover:opacity-90 transition-opacity disabled:opacity-50"
                  style={{ background: '#2f81f7', color: '#fff' }}>
                  <span className="material-symbols-outlined text-base">shopping_cart</span>
                  {purchasing ? '처리 중...' : isLoggedIn ? '구매하기' : '로그인 후 구매'}
                </button>
              )}

              <button
                onClick={handleLike}
                className="w-full py-2.5 rounded-xl text-sm transition-colors hover:bg-[#21262d] flex items-center justify-center gap-2"
                style={{ border: `1px solid ${asset.isLiked ? '#e11d48' : '#30363d'}`, color: asset.isLiked ? '#e11d48' : '#7d8590' }}>
                <span className="material-symbols-outlined text-base"
                  style={{ fontVariationSettings: asset.isLiked ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
                {asset.isLiked ? '좋아요 취소' : '좋아요'}
              </button>

              <div className="mt-4 space-y-1.5 text-xs" style={{ color: '#7d8590' }}>
                <p className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">update</span>
                  최종 업데이트: {new Date(asset.updatedAt).toLocaleDateString('ko-KR')}
                </p>
                <p className="flex items-center gap-2">
                  <span className="material-symbols-outlined text-sm">calendar_today</span>
                  등록일: {new Date(asset.createdAt).toLocaleDateString('ko-KR')}
                </p>
              </div>
            </div>
          </div>
        </div>

        {/* 하단: 설명 + 댓글 + 사이드바 */}
        <div className="flex gap-8">
          <div className="flex-1 space-y-10">
            {/* 설명 */}
            {asset.description && (
              <section>
                <h2 className="text-xl font-bold mb-4">에셋 설명</h2>
                <div className="rounded-2xl border p-6 text-sm leading-relaxed"
                  style={{ background: '#161b22', borderColor: '#30363d', color: '#7d8590' }}>
                  <p className="whitespace-pre-line">{asset.description}</p>
                  {asset.tags.length > 0 && (
                    <div className="flex flex-wrap gap-2 mt-4">
                      {asset.tags.map(tag => (
                        <Link key={tag} to={`/assets?tag=${encodeURIComponent(tag)}`}
                          className="px-3 py-1 rounded-full text-xs hover:opacity-80 transition-opacity"
                          style={{ background: '#21262d', border: '1px solid #30363d', color: '#7d8590' }}>
                          #{tag}
                        </Link>
                      ))}
                    </div>
                  )}
                </div>
              </section>
            )}

            {/* 댓글 */}
            <section>
              <h2 className="text-xl font-bold mb-4">댓글 ({asset.commentCount})</h2>

              {/* 평점 분포 (더미 유지 — 추후 리뷰 API 연결 시 교체) */}
              <div className="rounded-2xl border p-5 mb-6" style={{ background: '#161b22', borderColor: '#30363d' }}>
                <div className="flex items-center gap-6">
                  <div className="text-center">
                    <p className="text-5xl font-bold">—</p>
                    <div className="flex mt-1">{[1,2,3,4,5].map(i => (
                      <span key={i} style={{ color: '#30363d' }}>★</span>
                    ))}</div>
                  </div>
                  <div className="flex-1 space-y-2">
                    {RATING_DIST.map((pct, i) => (
                      <div key={i} className="flex items-center gap-3 text-xs" style={{ color: '#7d8590' }}>
                        <span>{5 - i}★</span>
                        <div className="flex-1 h-2 rounded-full overflow-hidden" style={{ background: '#21262d' }}>
                          <div className="h-full rounded-full" style={{ width: `${pct}%`, background: '#f0883e' }} />
                        </div>
                        <span>{pct}%</span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>

              {/* 댓글 입력 */}
              <div className="flex gap-3 mb-6">
                <div className="w-9 h-9 rounded-full shrink-0" style={{ background: 'linear-gradient(135deg, #2f81f7, #1a3a6b)' }} />
                <div className="flex-1">
                  <textarea
                    rows={3}
                    value={commentText}
                    onChange={e => setCommentText(e.target.value)}
                    placeholder={isLoggedIn ? '댓글을 입력하세요...' : '로그인 후 댓글을 남길 수 있습니다.'}
                    disabled={!isLoggedIn}
                    className="w-full px-4 py-3 rounded-xl text-sm resize-none outline-none disabled:opacity-50"
                    style={{ background: '#1c2128', border: '1px solid #30363d', color: '#e6edf3' }}
                  />
                  {isLoggedIn && (
                    <div className="flex justify-end mt-2">
                      <button
                        onClick={handleComment}
                        disabled={submitting || !commentText.trim()}
                        className="px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50"
                        style={{ background: '#2f81f7', color: '#fff' }}>
                        {submitting ? '등록 중...' : '등록'}
                      </button>
                    </div>
                  )}
                </div>
              </div>

              {/* 댓글 목록 */}
              <div className="space-y-4">
                {comments.map(c => (
                  <div key={c.commentId} className="rounded-2xl border p-5"
                    style={{ background: '#161b22', borderColor: '#30363d' }}>
                    <div className="flex items-center justify-between mb-3">
                      <div className="flex items-center gap-3">
                        <div className="w-9 h-9 rounded-full overflow-hidden shrink-0"
                          style={{ background: c.authorProfileImageUrl ? `url(${c.authorProfileImageUrl}) center/cover` : 'linear-gradient(135deg, #2f81f7, #1a3a6b)' }} />
                        <div>
                          <span className="font-bold text-sm">@{c.authorNickname}</span>
                          <p className="text-xs mt-0.5" style={{ color: '#7d8590' }}>
                            {new Date(c.createdAt).toLocaleDateString('ko-KR')}
                          </p>
                        </div>
                      </div>
                    </div>
                    <p className="text-sm" style={{ color: c.isDeleted ? '#484f58' : '#7d8590', fontStyle: c.isDeleted ? 'italic' : 'normal' }}>
                      {c.content}
                    </p>
                  </div>
                ))}
                {comments.length === 0 && (
                  <p className="text-sm text-center py-8" style={{ color: '#484f58' }}>첫 댓글을 남겨보세요!</p>
                )}
              </div>
            </section>
          </div>

          {/* 사이드바 */}
          <div className="w-80 shrink-0 space-y-4">
            {/* 작가 정보 */}
            <div className="rounded-2xl border p-4" style={{ background: '#161b22', borderColor: '#30363d' }}>
              <p className="font-bold mb-3 text-sm">작가</p>
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl overflow-hidden"
                  style={{ background: asset.authorProfileImageUrl ? `url(${asset.authorProfileImageUrl}) center/cover` : 'linear-gradient(135deg, #2c1810, #6b3020)' }} />
                <div>
                  <p className="font-bold text-sm">{asset.authorNickname}</p>
                </div>
              </div>
              <Link to={`/profile/${asset.authorNickname}`}
                className="block w-full text-center py-2 rounded-xl text-sm transition-colors hover:bg-[#21262d]"
                style={{ border: '1px solid #30363d', color: '#7d8590' }}>
                프로필 보기
              </Link>
            </div>

            {/* 에셋 상태 */}
            <div className="rounded-2xl border p-4" style={{ background: '#161b22', borderColor: '#30363d' }}>
              <p className="font-bold mb-3 text-sm">에셋 정보</p>
              {[
                ['상태', asset.status === 'ACTIVE' ? '판매 중' : asset.status],
                ['등록일', new Date(asset.createdAt).toLocaleDateString('ko-KR')],
                ['라이선스', asset.licenseTypeName ?? '—'],
              ].map(([label, val]) => (
                <div key={label} className="flex justify-between py-2 border-b last:border-0 text-sm"
                  style={{ borderColor: '#30363d', color: '#7d8590' }}>
                  <span>{label}</span>
                  <span style={{ color: '#e6edf3' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
