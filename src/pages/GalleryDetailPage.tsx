import { useState, useEffect } from 'react'
import { Link, useParams, useNavigate, data } from 'react-router-dom'
import { galleryApi, type GalleryPostResponse, type GalleryCommentResponse } from '../api/galleryApi'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'
import { getErrorMessage, getErrorStatus } from '../lib/errorUtils'
import Dropdown from '../components/Dropdown';

export default function GalleryDetailPage() {
  const { id } = useParams<{ id: string }>()
  const postId = Number(id)
  const { isLoggedIn } = useAuthStore()
  const navigate = useNavigate()

  const [post, setPost] = useState<GalleryPostResponse | null>(null)
  const [comments, setComments] = useState<GalleryCommentResponse[]>([])
  const [loading, setLoading] = useState(true)
  const [commentText, setCommentText] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [zoom, setZoom] = useState(4)
  const [bookmarked, setBookmarked] = useState(false)

  const [isMenuOpen, setIsMenuOpen] = useState(false);
  const [isInternalDraw, setIsInternalDraw] = useState(false);

  useEffect(() => {
    const fetchAll = async () => {
      setLoading(true)
      try {
        const [postRes, commentsRes] = await Promise.all([
          galleryApi.getPost(postId),
          galleryApi.getComments(postId, { size: 20 }),
        ])
        const postData = postRes.data.data;

        setPost(postData);
        setComments(commentsRes.data.data.content);
        setIsInternalDraw(postData.galleryType === 'DEDICATED');
      } catch (err) {
        const status = getErrorStatus(err)
        if (status === 403) navigate('/403', { replace: true })
        else if (status && status >= 500) navigate('/500', { replace: true })
        else setPost(null)
      } finally {
        setLoading(false)
      }
    }
    if (postId) fetchAll()
  }, [postId])

  const handleLike = async () => {
    if (!isLoggedIn || !post) return
    try {
      const res = await galleryApi.toggleLike(postId)
      const isLiked = res.data.data
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
          // 전용 갤러리 전용 모달 띄우기 (인증 마크 포함)
          alert("PixelHub 인증 데이터를 포함한 상세 정보를 띄웁니다.");
      } else {
          alert("일반 파일 사양을 띄웁니다.");
      }
  };
  
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

  return (
    <div style={{ background: '#0d1117', color: '#e6edf3' }}>
      {/* 뷰어 */}
      <div className="flex items-center justify-center py-12 relative"
        style={{ background: 'repeating-conic-gradient(#1c2128 0% 25%, #21262d 0% 50%) 0 0 / 16px 16px', minHeight: 480 }}>
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

            <button onClick={() => setBookmarked(v => !v)}
              className="p-2 rounded-xl transition-colors hover:bg-[#1c2128]"
              style={{ color: bookmarked ? '#2f81f7' : '#7d8590' }}>
              <span className="material-symbols-outlined"
                style={{ fontVariationSettings: bookmarked ? "'FILL' 1" : "'FILL' 0" }}>bookmark</span>
            </button>
            <button className="p-2 rounded-xl hover:bg-[#1c2128] transition-colors" style={{ color: '#7d8590' }}>
              <span className="material-symbols-outlined">share</span>
            </button>
            <button className="p-2 rounded-xl hover:bg-[#1c2128] transition-colors" style={{ color: '#7d8590' }}>
              <span className="material-symbols-outlined">flag</span>
            </button>
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
                  <Link key={tag} to={`/gallery/tags/${tag}`}
                    className="px-3 py-1 rounded-full text-sm hover:border-[#2f81f7] transition-colors"
                    style={{ background: '#21262d', color: '#7d8590', border: '1px solid #30363d' }}>
                    #{tag}
                  </Link>
                ))}
              </div>
            )}
            <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
              {[
                ['해상도', post.canvasWidth && post.canvasHeight ? `${post.canvasWidth} × ${post.canvasHeight}` : '-'],
                ['갤러리 유형', post.galleryType === 'FREE' ? '자유 갤러리' : '전용 갤러리'],
                ['공개 범위', post.visibility === 'PUBLIC' ? '전체 공개' : post.visibility === 'PRIVATE' ? '비공개' : '링크 공유'],
              ].map(([k, v]) => (
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
            </div>
          </div>

          {post.imageUrls.length > 1 && (
            <div className="rounded-2xl border p-5" style={{ background: '#21262d', borderColor: '#30363d' }}>
              <p className="font-bold mb-3">이미지 ({post.imageUrls.length})</p>
              <div className="grid grid-cols-3 gap-1.5">
                {post.imageUrls.slice(0, 6).map((url, i) => (
                  <img key={i} src={url} alt={`이미지 ${i + 1}`}
                    className="aspect-square rounded-lg object-cover cursor-pointer hover:opacity-80 transition-opacity"
                    style={{ imageRendering: 'pixelated' }}
                  />
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}