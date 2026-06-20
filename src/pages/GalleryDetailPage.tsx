import { useState, useEffect, useRef } from 'react'
import { Link, useParams, useNavigate } from 'react-router-dom'
import { galleryApi, type GalleryPostResponse, type GalleryCommentResponse } from '../api/galleryApi'
import { useAuthStore } from '../store/authStore'
import { useLikeStore } from '../store/likeStore'
import { useBlockStore } from '../store/blockStore'
import { toast } from '../store/toastStore'
import { getErrorMessage, getErrorStatus } from '../lib/errorUtils'
import Dropdown from '../components/GalleryDetailDropdown';

export default function GalleryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const postId = Number(id)
  const { isLoggedIn, user } = useAuthStore()
  const { setGalleryLike, getGalleryLike } = useLikeStore()
  const { blockUser, unblockUser, isUserBlocked, blockTag, unblockTag, isTagBlocked } = useBlockStore()
  const navigate = useNavigate()

  const [post, setPost] = useState<GalleryPostResponse | null>(null)
  const [comments, setComments] = useState<GalleryCommentResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [zoom, setZoom] = useState(4)
  const [downloading, setDownloading] = useState(false)
  const [activeImageIdx, setActiveImageIdx] = useState(0)   // 자유 갤러리 다중 이미지 캐러셀

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isInternalDraw, setIsInternalDraw] = useState(false);
  const viewCountedRef = useRef<number | null>(null)

  // 데이터 조회
  useEffect(() => {
    let cancelled = false;

    const fetchAll = async () => {
      setLoading(true)
      try {
        const [postRes, commentsRes] = await Promise.all([
          galleryApi.getPost(postId),
          galleryApi.getComments(postId, { size: 20 }),
        ]);

        if (cancelled) return;

        const postData = postRes.data.data;
        const cachedLike = getGalleryLike(postData.postId)
        setPost(cachedLike !== undefined ? { ...postData, isLiked: cachedLike } : postData);
        setComments(commentsRes.data.data.content);
        setIsInternalDraw(postData.galleryType === 'DEDICATED');
      } catch (err) {
        if (cancelled) return;
        const status = getErrorStatus(err)
        if (status === 403) navigate('/403', { replace: true })
        else if (status && status >= 500) navigate('/500', { replace: true })
        else setPost(null)
      } finally {
        if (!cancelled) setLoading(false);
      }
    };

    if (postId && Number.isFinite(Number(postId)) && Number(postId) > 0) {
      fetchAll();
    } else {
      setPost(null);
      setLoading(false);
    }

    return () => { cancelled = true; };
  }, [postId, navigate])

  // 조회수 증가 — StrictMode 이중 실행 방지: cleanup 시 취소, 실제 마운트에서만 실행
  // viewCountedRef에 postId를 저장해 게시글 이동 시 각각 1회씩 정상 증가
  useEffect(() => {
    if (!(postId && Number.isFinite(Number(postId)) && Number(postId) > 0)) return
    if (viewCountedRef.current === postId) return

    const controller = new AbortController()
    const timer = setTimeout(() => {
      if (!controller.signal.aborted) {
        viewCountedRef.current = postId
        galleryApi.incrementView(postId)
          .then(() => {
            // 증가 성공 시 화면의 viewCount도 즉시 반영 (새로고침 전까지 숫자가 낮게 보이는 문제 방지)
            setPost(prev => prev ? { ...prev, viewCount: prev.viewCount + 1 } : prev)
          })
          .catch(() => {/* 조회수 실패는 무시 */})
      }
    }, 0)

    return () => {
      controller.abort()
      clearTimeout(timer)
    }
  }, [postId])

  // 게시글 이동 시 다중 이미지 인덱스 초기화
  useEffect(() => { setActiveImageIdx(0) }, [postId])

  const handleLike = async () => {
    if (!isLoggedIn || !post) return
    try {
      const res = await galleryApi.toggleLike(postId)
      const isLiked = res.data.data
      // 로컬 캐시에 저장하여 페이지 이동 후에도 유지
      setGalleryLike(postId, isLiked)
      setPost(prev => prev ? {
        ...prev,
        isLiked,
        likeCount: isLiked ? prev.likeCount + 1 : prev.likeCount - 1,
      } : prev)
    } catch (err) {
      toast.error(getErrorMessage(err, '좋아요 처리에 실패했습니다.'))
    }
  }

  const handleComment = async () => {
    if (!commentText.trim() || !isLoggedIn) return
    setSubmitting(true)
    try {
      const res = await galleryApi.createComment(postId, { content: commentText.trim() })
      setComments(prev => [res.data.data, ...prev])
      setCommentText('')
      setPost(prev => prev ? { ...prev, commentCount: prev.commentCount + 1 } : prev)
    } catch (err) {
      toast.error(getErrorMessage(err, '댓글 등록에 실패했습니다.'))
    } finally {
      setSubmitting(false)
    }
  }

  const handleDeleteComment = async (commentId: number) => {
    try {
      await galleryApi.deleteComment(postId, commentId)
      setComments(prev => prev.map(c =>
        c.commentId === commentId ? { ...c, isDeleted: true, content: '삭제된 댓글입니다.' } : c
      ))
    } catch (err) {
      toast.error(getErrorMessage(err, '댓글 삭제에 실패했습니다.'))
    }
  }

  const handleShowInfo = () => {
      if (isInternalDraw) {
          alert("PixelHub 인증 데이터를 포함한 상세 정보를 띄웁니다.");
      } else {
          alert("일반 파일 사양을 띄웁니다.");
      }
  };

  // .ppit 원본 다운로드 — CORS 가능 시 blob 저장, 실패 시 새 탭 폴백
  const handleDownloadPpit = async () => {
    if (!post?.fileUrl || downloading) return   // 진행 중 더블클릭 방지
    setDownloading(true)
    try {
      const res = await fetch(post.fileUrl)
      if (!res.ok) throw new Error('fetch failed')
      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const a = document.createElement('a')
      a.href = url
      a.download = `${post.title || 'artwork'}.ppit`
      document.body.appendChild(a)
      a.click()
      a.remove()
      URL.revokeObjectURL(url)
    } catch {
      window.open(post.fileUrl, '_blank', 'noopener')
    } finally {
      setDownloading(false)
    }
  }

  const copyColor = (hex: string) => {
    navigator.clipboard?.writeText(hex)
      .then(() => toast.success(`${hex} 복사됨`))
      .catch(() => {})
  }

  // 에디터에서 열기 — 내 작품=편집, 타인 작품=리믹스(원본 출처 전달)
  const openInEditor = (remixOf?: number) => {
    if (!post?.fileUrl) return
    const params = new URLSearchParams({ import: post.fileUrl })
    if (remixOf) params.set('remixOf', String(remixOf))
    navigate(`/editor?${params.toString()}`)
  }

  const handleDeletePost = async () => {
    if (!post) return
    if (!confirm('게시글을 삭제하시겠습니까? 이 작업은 되돌릴 수 없습니다.')) return
    try {
      await galleryApi.deletePost(post.postId)
      toast.success('게시글이 삭제되었습니다.')
      navigate(post.galleryType === 'DEDICATED' ? '/gallery/exclusive' : '/gallery/free', { replace: true })
    } catch (err) {
      toast.error(getErrorMessage(err, '게시글 삭제에 실패했습니다.'))
    }
  }
  
  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-screen" style={{ background: '#0d1117' }}>
        <div className="animate-spin rounded-full w-10 h-10 border-2 border-t-transparent" style={{ borderColor: '#2f81f7' }} />
      </div>
    )
  }

  if (!post) {
    return (
      <div className="flex flex-col items-center justify-center min-h-screen gap-4" style={{ background: '#0d1117', color: '#e6edf3' }}>
        <span className="material-symbols-outlined text-5xl" style={{ color: '#30363d' }}>image_not_supported</span>
        <p style={{ color: '#7d8590' }}>작품을 찾을 수 없습니다.</p>
        <Link to="/gallery/free" className="text-sm font-bold" style={{ color: '#2f81f7' }}>갤러리로 돌아가기</Link>
      </div>
    )
  }

  // ── 전용 갤러리(.ppit) 파생값 ──
  const isOwner = isLoggedIn && user?.userId === post.authorId
  const isDedicated = post.galleryType === 'DEDICATED'
  const vis = post.dedicatedVisibility ?? {}
  const showCanvasInfo = !isDedicated || vis.canvas !== false           // 캔버스 정보 노출 여부
  const paletteColors = post.palette?.colors ?? []
  const showPalette = isDedicated && vis.palette !== false && paletteColors.length > 0
  const isAnimated = !!post.thumbnailUrl && /\.gif(\?|$)/i.test(post.thumbnailUrl)

  // 자유 갤러리 다중 이미지 캐러셀 (전용은 .ppit 합성 썸네일 1장 → 픽셀 뷰어)
  const galleryImages = (post.imageUrls && post.imageUrls.length > 0)
    ? post.imageUrls
    : (post.thumbnailUrl ? [post.thumbnailUrl] : [])
  const isPhotoGallery = !isDedicated && galleryImages.length > 0
  const safeImageIdx = Math.max(0, Math.min(activeImageIdx, galleryImages.length - 1))
  const activeImage = galleryImages[safeImageIdx] ?? post.thumbnailUrl
  const multiImage = galleryImages.length > 1

  // 정보 그리드 항목 (캔버스 정보는 토글에 따라)
  const infoItems: [string, string][] = [
    ...(showCanvasInfo
      ? [['해상도', post.canvasWidth && post.canvasHeight ? `${post.canvasWidth} × ${post.canvasHeight}` : '-'] as [string, string]]
      : []),
    ['갤러리 유형', post.galleryType === 'FREE' ? '자유 갤러리' : '전용 갤러리'],
    ['공개 범위', post.visibility === 'PUBLIC' ? '전체 공개' : post.visibility === 'PRIVATE' ? '비공개' : '링크 공유'],
  ]

  return (
    <div style={{ background: '#0d1117', color: '#e6edf3' }}>
      {/* 뷰어 */}
      <div className="flex flex-col items-center py-12 relative"
        style={{ background: 'repeating-conic-gradient(#1c2128 0% 25%, #21262d 0% 50%) 0 0 / 16px 16px', minHeight: 480 }}>
        {isPhotoGallery ? (
          /* ── 자유 갤러리: 사진 캐러셀 (contain + 화살표 + 썸네일 스트립) ── */
          <>
            <div className="relative flex items-center justify-center w-full px-12" style={{ maxWidth: 1100 }}>
              {multiImage && (
                <button
                  onClick={() => setActiveImageIdx(i => (i - 1 + galleryImages.length) % galleryImages.length)}
                  aria-label="이전 이미지"
                  className="absolute left-2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-90"
                  style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
                  <span className="material-symbols-outlined">chevron_left</span>
                </button>
              )}
              <img src={activeImage ?? undefined} alt={post.title}
                className="max-w-full rounded-lg shadow-[0_0_80px_rgba(47,129,247,0.25)]"
                style={{ maxHeight: 600, objectFit: 'contain' }} />
              {multiImage && (
                <button
                  onClick={() => setActiveImageIdx(i => (i + 1) % galleryImages.length)}
                  aria-label="다음 이미지"
                  className="absolute right-2 z-10 w-10 h-10 rounded-full flex items-center justify-center transition-opacity hover:opacity-90"
                  style={{ background: 'rgba(0,0,0,0.6)', color: '#fff' }}>
                  <span className="material-symbols-outlined">chevron_right</span>
                </button>
              )}
              {multiImage && (
                <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-xs text-white"
                  style={{ background: 'rgba(0,0,0,0.6)' }}>{safeImageIdx + 1} / {galleryImages.length}</span>
              )}
            </div>
            {multiImage && (
              <div className="flex gap-2 mt-4 px-8 overflow-x-auto max-w-full">
                {galleryImages.map((url, i) => (
                  <button key={i} onClick={() => setActiveImageIdx(i)}
                    aria-label={`이미지 ${i + 1}`}
                    className="flex-shrink-0 rounded-lg overflow-hidden transition-all"
                    style={{ width: 64, height: 64, outline: i === safeImageIdx ? '2px solid #2f81f7' : '2px solid transparent', outlineOffset: 2 }}>
                    <img src={url} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}
          </>
        ) : (
          /* ── 전용 갤러리(.ppit)/단일: 픽셀아트 뷰어 (zoom + 애니 배지) ── */
          <div className="relative">
            {post.thumbnailUrl
              ? (
                <img
                  src={post.thumbnailUrl}
                  alt={post.title}
                  className="shadow-[0_0_80px_rgba(47,129,247,0.3)]"
                  style={{ width: (post.canvasWidth ?? 64) * zoom, height: (post.canvasHeight ?? 64) * zoom, imageRendering: 'pixelated', objectFit: 'cover' }}
                />
              )
              : (
                <div className="shadow-[0_0_80px_rgba(47,129,247,0.3)]"
                  style={{ width: (post.canvasWidth ?? 64) * zoom, height: (post.canvasHeight ?? 64) * zoom, background: 'linear-gradient(135deg, #0a1628, #1a3a5c, #2f81f7)' }} />
              )
            }
            <span className="absolute top-3 right-3 px-2.5 py-1 rounded-lg text-xs text-white"
              style={{ background: 'rgba(0,0,0,0.6)' }}>{zoom * 100}%</span>
            {isAnimated && (
              <span className="absolute top-3 left-3 flex items-center gap-1 px-2.5 py-1 rounded-lg text-xs font-bold text-white"
                style={{ background: 'rgba(240,136,62,0.85)' }}>
                <span className="material-symbols-outlined" style={{ fontSize: 13 }}>animation</span>
                애니메이션
              </span>
            )}
            <div className="absolute bottom-5 left-1/2 -translate-x-1/2 flex items-center gap-1 px-3 py-1.5 rounded-xl"
              style={{ background: 'rgba(0,0,0,0.6)' }}>
              <button onClick={() => setZoom(z => Math.max(1, z - 1))} className="text-white">
                <span className="material-symbols-outlined text-sm">remove</span>
              </button>
              <span className="text-white text-xs px-2">{zoom * 100}%</span>
              <button onClick={() => setZoom(z => Math.min(8, z + 1))} className="text-white">
                <span className="material-symbols-outlined text-sm">add</span>
              </button>
            </div>
          </div>
        )}
      </div>

      {/* 액션 바 */}
      <div className="border-y h-14 flex items-center px-8"
        style={{ background: '#161b22', borderColor: '#30363d' }}>
        <div className="max-w-[1440px] mx-auto w-full flex items-center justify-between">
          <div className="flex items-center gap-6">
            <button onClick={handleLike}
              className="flex items-center gap-2 px-4 py-2 rounded-xl transition-colors hover:bg-[#1c2128]"
              style={{ color: post.isLiked ? '#e11d48' : '#7d8590' }}>
              <span className="material-symbols-outlined text-base"
                style={{ fontVariationSettings: post.isLiked ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
              <span className="text-sm font-medium">{post.likeCount.toLocaleString()}</span>
            </button>
            <span className="flex items-center gap-2 text-sm" style={{ color: '#7d8590' }}>
              <span className="material-symbols-outlined text-base">visibility</span>
              {post.viewCount.toLocaleString()}
            </span>
            <span className="flex items-center gap-2 text-sm" style={{ color: '#7d8590' }}>
              <span className="material-symbols-outlined text-base">chat_bubble</span>
              {post.commentCount}
            </span>
          </div>
          <div className="flex items-center gap-2">
            <div className="relative">
                <button onClick = {() => setIsMenuOpen(!isMenuOpen)}
                  className="p-2 rounded-xl hover:bg-[#1c2128] transition-colors" 
                  style={{color: '#7d8590'}}>
                  <span className="material-symbols-outlined">more_horiz</span>
                </button>
                {/* 드롭다운 컴포넌트 활용 */}
                <Dropdown isOpen = {isMenuOpen} 
                  isInternal = {isInternalDraw} // 전용 갤러리 여부
                  onClose = {() => setIsMenuOpen(false)}
                  onInfoClick={handleShowInfo}>
                </Dropdown>
            </div>

            <button className="p-2 rounded-xl hover:bg-[#1c2128] transition-colors" style={{ color: '#7d8590' }}>
              <span className="material-symbols-outlined">share</span>
            </button>
            <button className="p-2 rounded-xl hover:bg-[#1c2128] transition-colors" style={{ color: '#7d8590' }}>
              <span className="material-symbols-outlined">flag</span>
            </button>
            {/* 작성자 본인만 삭제 버튼 표시 */}
            {isLoggedIn && user?.userId === post.authorId && (
              <button
                onClick={handleDeletePost}
                className="p-2 rounded-xl hover:bg-[#1c2128] transition-colors"
                title="게시글 삭제"
                style={{ color: '#f85149' }}>
                <span className="material-symbols-outlined">delete</span>
              </button>
            )}
          </div>
        </div>
      </div>

      {/* 본문 */}
      <div className="max-w-[1440px] mx-auto px-8 py-10 flex gap-10">
        {/* 왼쪽 */}
        <div className="flex-1 min-w-0 space-y-10">
          {/* 작품 정보 */}
          <div>
            <h1 className="text-3xl font-bold mb-2">{post.title}</h1>
            <Link to={`/profile/${post.authorNickname}`} className="text-sm font-medium hover:underline" style={{ color: '#2f81f7' }}>
              @{post.authorNickname}
            </Link>
            {post.description && (
              <p className="mt-3 text-base leading-relaxed" style={{ color: '#7d8590' }}>{post.description}</p>
            )}
            {post.tags.length > 0 && (
              <div className="flex flex-wrap gap-2 mt-4">
                {post.tags.map(tag => (
                  <div key={tag} className="flex items-center gap-0.5 rounded-full"
                    style={isTagBlocked(tag)
                      ? { background: 'rgba(248,81,73,0.08)', border: '1px solid rgba(248,81,73,0.3)' }
                      : { background: '#21262d', border: '1px solid #30363d' }}>
                    <Link to={`/gallery/free?tag=${encodeURIComponent(tag)}`}
                      className="pl-3 pr-1 py-1 text-sm hover:underline transition-colors"
                      style={{ color: isTagBlocked(tag) ? '#f85149' : '#7d8590' }}>
                      #{tag}
                    </Link>
                    {isLoggedIn && (
                      <button
                        onClick={async () => {
                          try {
                            if (isTagBlocked(tag)) await unblockTag(tag)
                            else await blockTag(tag)
                          } catch (err) {
                            toast.error(getErrorMessage(err, '처리에 실패했습니다.'))
                          }
                        }}
                        title={isTagBlocked(tag) ? '태그 차단 해제' : '태그 차단'}
                        className="pr-2 py-1 transition-colors hover:text-[#f85149]"
                        style={{ color: isTagBlocked(tag) ? '#f85149' : '#484f58' }}>
                        <span className="material-symbols-outlined" style={{ fontSize: 12 }}>
                          {isTagBlocked(tag) ? 'close' : 'block'}
                        </span>
                      </button>
                    )}
                  </div>
                ))}
              </div>
            )}
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              {infoItems.map(([k, v]) => (
                <div key={k} className="rounded-xl p-3" style={{ background: '#161b22', border: '1px solid #30363d' }}>
                  <p style={{ color: '#7d8590' }}>{k}</p>
                  <p className="font-bold mt-0.5">{v}</p>
                </div>
              ))}
            </div>
          </div>

          {/* 댓글 */}
          <div>
            <h3 className="font-bold mb-6">댓글 {post.commentCount}</h3>
            {/* 댓글 입력 */}
            <div className="flex gap-3 mb-8">
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
            <div className="space-y-8">
              {comments.map(c => (
                <div key={c.commentId} className="flex gap-3">
                  <div className="w-9 h-9 rounded-full shrink-0"
                    style={{ background: c.authorProfileImageUrl ? `url(${c.authorProfileImageUrl})` : 'linear-gradient(135deg, #2f81f7, #1a3a6b)', backgroundSize: 'cover' }} />
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <span className="font-bold text-sm">@{c.authorNickname}</span>
                      <span className="text-xs" style={{ color: '#7d8590' }}>
                        {new Date(c.createdAt).toLocaleDateString('ko-KR')}
                      </span>
                      {!c.isDeleted && isLoggedIn && (
                        <button onClick={() => handleDeleteComment(c.commentId)}
                          className="ml-auto text-xs transition-colors hover:text-[#f85149]"
                          style={{ color: '#484f58' }}>
                          삭제
                        </button>
                      )}
                    </div>
                    <p className="text-sm leading-relaxed" style={{ color: c.isDeleted ? '#484f58' : '#7d8590', fontStyle: c.isDeleted ? 'italic' : 'normal' }}>
                      {c.content}
                    </p>
                  </div>
                </div>
              ))}
              {comments.length === 0 && (
                <p className="text-sm text-center py-8" style={{ color: '#484f58' }}>첫 댓글을 남겨보세요!</p>
              )}
            </div>
          </div>
        </div>

        {/* 오른쪽 사이드바 */}
        <div className="w-72 shrink-0 space-y-5">
          <div className="rounded-2xl border p-5" style={{ background: '#21262d', borderColor: '#30363d' }}>
            <div className="flex items-center gap-3 mb-4">
              <div className="w-12 h-12 rounded-full overflow-hidden"
                style={{
                  background: post.authorProfileImageUrl ? `url(${post.authorProfileImageUrl}) center/cover` : 'linear-gradient(135deg, #8b2de0, #4a1060)',
                }} />
              <div>
                <p className="font-bold">{post.authorNickname}</p>
              </div>
            </div>
            <div className="flex gap-2">
              <Link to={`/profile/${post.authorNickname}`}
                className="flex-1 py-2 rounded-xl font-bold text-sm text-center"
                style={{ background: '#2f81f7', color: '#fff' }}>
                프로필 보기
              </Link>
              {isLoggedIn && user?.userId !== post.authorId && (
                <button
                  onClick={async () => {
                    try {
                      if (isUserBlocked(post.authorId)) {
                        await unblockUser(post.authorId)
                        toast.success('차단이 해제되었습니다.')
                      } else {
                        await blockUser(post.authorId)
                        toast.success('사용자를 차단했습니다. 마이페이지 > 차단 관리에서 확인하세요.')
                      }
                    } catch (err) {
                      toast.error(getErrorMessage(err, '처리에 실패했습니다.'))
                    }
                  }}
                  className="px-3 py-2 rounded-xl text-xs font-bold transition-colors"
                  style={isUserBlocked(post.authorId)
                    ? { background: 'rgba(248,81,73,0.1)', border: '1px solid rgba(248,81,73,0.3)', color: '#f85149' }
                    : { background: '#1c2128', border: '1px solid #30363d', color: '#7d8590' }}>
                  {isUserBlocked(post.authorId) ? '차단됨' : '차단'}
                </button>
              )}
            </div>
          </div>

          {/* ── 전용 갤러리: 팔레트 ── */}
          {showPalette && (
            <div className="rounded-2xl border p-5" style={{ background: '#21262d', borderColor: '#30363d' }}>
              <div className="flex items-center justify-between mb-3">
                <p className="font-bold">
                  팔레트{post.palette?.name ? ` · ${post.palette.name}` : ''}
                </p>
                <span className="text-xs" style={{ color: '#7d8590' }}>{paletteColors.length}색</span>
              </div>
              <div className="flex flex-wrap gap-1.5">
                {paletteColors.map((c, i) => (
                  <button
                    key={`${c}-${i}`}
                    type="button"
                    onClick={() => copyColor(c)}
                    title={`${c} (클릭하여 복사)`}
                    aria-label={`색상 ${c} 복사`}
                    className="w-7 h-7 rounded-md transition-transform hover:scale-110"
                    style={{ background: c, border: '1px solid #30363d' }}
                  />
                ))}
              </div>
              {/* "이 팔레트 가져오기"는 에디터 연동(Phase ④) 필요 → 준비 중 */}
              <button
                type="button"
                disabled
                title="에디터 연동 준비 중"
                className="w-full mt-4 py-2 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 opacity-40 cursor-not-allowed"
                style={{ background: '#1c2128', border: '1px solid #30363d', color: '#7d8590' }}>
                <span className="material-symbols-outlined text-base">download_for_offline</span>
                이 팔레트 가져오기 (준비 중)
              </button>
            </div>
          )}

          {/* ── 전용 갤러리: .ppit 다운로드 ── */}
          {isDedicated && (
            <div className="rounded-2xl border p-5" style={{ background: '#21262d', borderColor: '#30363d' }}>
              <p className="font-bold mb-3">원본 파일</p>
              {post.fileUrl ? (
                <div className="space-y-2">
                  <button
                    type="button"
                    onClick={handleDownloadPpit}
                    disabled={downloading}
                    className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-opacity hover:opacity-90 disabled:opacity-60"
                    style={{ background: '#f0883e', color: '#fff' }}>
                    <span className={`material-symbols-outlined text-base${downloading ? ' animate-spin' : ''}`}>
                      {downloading ? 'progress_activity' : 'download'}
                    </span>
                    {downloading ? '내려받는 중...' : '.ppit 다운로드'}
                  </button>
                  {/* 에디터에서 열기 — 내 작품=편집 / 타인 작품=리믹스 */}
                  {isLoggedIn && (
                    <button
                      type="button"
                      onClick={() => openInEditor(isOwner ? undefined : post.postId)}
                      className="w-full py-2.5 rounded-xl text-sm font-bold flex items-center justify-center gap-1.5 transition-colors"
                      style={{ background: '#1c2128', border: '1px solid #30363d', color: '#e6edf3' }}>
                      <span className="material-symbols-outlined text-base" style={{ color: '#2f81f7' }}>
                        {isOwner ? 'edit' : 'fork_right'}
                      </span>
                      {isOwner ? '에디터에서 편집' : '리믹스'}
                    </button>
                  )}
                </div>
              ) : (
                <div className="flex items-center gap-2 text-sm" style={{ color: '#7d8590' }}>
                  <span className="material-symbols-outlined text-base" style={{ color: '#484f58' }}>lock</span>
                  작성자가 원본 다운로드를 비공개로 설정했습니다.
                </div>
              )}
            </div>
          )}

          {/* 다중 이미지는 상단 뷰어의 캐러셀(화살표+썸네일 스트립)에서 확인 */}
        </div>
      </div>
    </div>
  )
}