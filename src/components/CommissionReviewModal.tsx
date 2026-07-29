import { useEffect, useRef, useState } from 'react'
import { commissionApi } from '../api/commissionApi'
import { toast } from '../store/toastStore'
import { getErrorMessage } from '../lib/errorUtils'
import { useFocusTrap } from '../hooks/useFocusTrap'
import StarRating from './StarRating'

/**
 * 커미션 리뷰 작성/수정 모달 — 완료 거래에 대해 의뢰자가 작가를 평가.
 * 기존 리뷰가 있으면 프리필(수정 모드). 별점 필수, 내용 선택.
 */
export default function CommissionReviewModal({
  commissionId,
  onClose,
  onSaved,
}: {
  commissionId: number
  onClose: () => void
  onSaved?: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  useFocusTrap(true, ref, onClose)

  const [rating, setRating] = useState(0)
  const [content, setContent] = useState('')
  const [isEdit, setIsEdit] = useState(false)
  const [loading, setLoading] = useState(true)
  const [submitting, setSubmitting] = useState(false)

  // 기존 내 리뷰 프리필
  useEffect(() => {
    let ignore = false
    commissionApi.getMyReview(commissionId)
      .then(res => {
        if (ignore) return
        const r = res.data.data
        if (r) { setRating(r.rating); setContent(r.content ?? ''); setIsEdit(true) }
      })
      .catch(() => { /* 없으면 신규 작성 */ })
      .finally(() => { if (!ignore) setLoading(false) })
    return () => { ignore = true }
  }, [commissionId])

  const submit = async () => {
    if (rating < 1) { toast.error('별점을 선택해주세요.'); return }
    setSubmitting(true)
    try {
      await commissionApi.writeReview(commissionId, { rating, content: content.trim() || undefined })
      toast.success(isEdit ? '리뷰를 수정했습니다.' : '리뷰를 등록했습니다.')
      onSaved?.()
      onClose()
    } catch (err) {
      toast.error(getErrorMessage(err, '리뷰 저장에 실패했습니다.'))
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4"
      style={{ background: 'color-mix(in srgb, #000 60%, transparent)' }}
      onClick={onClose}>
      <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="review-modal-title"
        className="w-full max-w-md rounded-2xl border p-6"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}
        onClick={e => e.stopPropagation()}>
        <h2 id="review-modal-title" className="text-lg font-bold mb-1">{isEdit ? '리뷰 수정' : '리뷰 작성'}</h2>
        <p className="text-xs mb-5" style={{ color: 'var(--color-on-surface-variant)' }}>
          완료된 거래의 작업에 대해 평가를 남겨주세요.
        </p>

        {loading ? (
          <div className="flex items-center justify-center py-10">
            <div className="animate-spin rounded-full w-8 h-8 border-2"
              style={{ borderColor: 'var(--color-primary)', borderTopColor: 'transparent' }} />
          </div>
        ) : (
          <>
            <div className="flex items-center gap-2 mb-4">
              <StarRating value={rating} size={32} interactive onChange={setRating} />
              {rating > 0 && <span className="text-sm font-bold" style={{ color: 'var(--color-on-surface)' }}>{rating}점</span>}
            </div>
            <textarea
              value={content}
              onChange={e => setContent(e.target.value)}
              maxLength={2000}
              placeholder="작업 퀄리티, 소통, 일정 등 후기를 남겨주세요. (선택)"
              className="w-full h-28 px-3 py-2 rounded-lg text-sm outline-none resize-none mb-1"
              style={{ background: 'var(--color-background)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}
            />
            <p className="text-xs text-right mb-5" style={{ color: 'var(--color-outline-strong)' }}>{content.length}/2000</p>

            <div className="flex gap-2 justify-end">
              <button type="button" onClick={onClose}
                className="px-4 py-2 rounded-xl text-sm font-bold transition-colors hover:bg-surface-container"
                style={{ border: '1px solid var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
                취소
              </button>
              <button type="button" onClick={submit} disabled={submitting || rating < 1}
                className="px-4 py-2 rounded-xl text-sm font-bold transition-opacity hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed"
                style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
                {submitting ? '저장 중…' : isEdit ? '수정' : '등록'}
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}
