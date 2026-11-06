import { useEffect, useRef, useState } from 'react'
import { editorApi, type ProjectSummary } from '../../api/editorApi'
import { toast } from '../../store/toastStore'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSelect: (projectId: number) => void
  /** 서버에서 지운 뒤 — 열린 탭 정리용 */
  onDeleted?: (projectId: number) => void
}

export default function EditorOpenProjectModal({ isOpen, onClose, onSelect, onDeleted }: Props) {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(false)
  const modalRef = useRef<HTMLDivElement>(null)
  const closeRef = useRef<HTMLButtonElement>(null)
  const lastFocusedRef = useRef<HTMLElement | null>(null)
  const [deletingId, setDeletingId] = useState<number | null>(null)

  const handleDelete = async (p: ProjectSummary) => {
    if (deletingId !== null) return
    if (!window.confirm(`'${p.title}' 프로젝트를 삭제할까요? 되돌릴 수 없습니다.
(지금 열려 있는 탭의 그림은 남고, 저장 안 한 새 작업이 됩니다)`)) return
    setDeletingId(p.projectId)
    try {
      await editorApi.deleteProject(p.projectId)
      setProjects(prev => prev.filter(x => x.projectId !== p.projectId))
      onDeleted?.(p.projectId)
      toast.success('프로젝트를 삭제했습니다.')
    } catch {
      toast.error('프로젝트를 삭제하지 못했습니다.')
    } finally {
      setDeletingId(null)
    }
  }

  // 목록 로드 — 닫힌(또는 재오픈) 요청의 후속 상태 반영 방지(cancelled 플래그)
  useEffect(() => {
    if (!isOpen) return
    let cancelled = false
    setLoading(true)
    editorApi.getProjects({ size: 60 })
      .then(res => { if (!cancelled) setProjects(res.data.data.content) })
      .catch(() => { if (!cancelled) toast.error('프로젝트 목록을 불러오지 못했습니다.') })
      .finally(() => { if (!cancelled) setLoading(false) })
    return () => { cancelled = true }
  }, [isOpen])

  // ESC 닫기 + 배경 스크롤 잠금 + 포커스 트랩/복원(접근성)
  useEffect(() => {
    if (!isOpen) return
    lastFocusedRef.current = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onClose(); return }
      if (e.key !== 'Tab' || !modalRef.current) return
      const focusable = modalRef.current.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])')
      if (focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }

    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    queueMicrotask(() => closeRef.current?.focus())
    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prev
      lastFocusedRef.current?.focus()
    }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose} role="dialog" aria-modal="true" aria-label="프로젝트 열기">
      <div ref={modalRef} className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: 'var(--color-outline)' }}>
          <h2 className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>프로젝트 열기</h2>
          <button ref={closeRef} type="button" onClick={onClose} aria-label="닫기"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container" style={{ color: 'var(--color-on-surface-variant)' }}>
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-center py-10" style={{ color: 'var(--color-on-surface-variant)' }}>불러오는 중...</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: 'var(--color-on-surface-variant)' }}>저장된 프로젝트가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {projects.map(p => (
                <div key={p.projectId} className="relative group">
                <button type="button" onClick={() => onSelect(p.projectId)}
                  className="w-full text-left rounded-xl overflow-hidden transition-colors hover:bg-surface-container-low"
                  style={{ border: '1px solid var(--color-outline)' }}>
                  <div className="aspect-square flex items-center justify-center overflow-hidden" style={{ background: 'var(--color-background)' }}>
                    {p.thumbnailUrl ? (
                      <img src={p.thumbnailUrl} alt={p.title}
                        className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
                    ) : (
                      <span className="material-symbols-outlined" style={{ color: 'var(--color-outline-strong)', fontSize: 32 }}>image</span>
                    )}
                  </div>
                  <div className="px-2.5 py-2">
                    <p className="text-sm font-bold truncate" style={{ color: 'var(--color-on-surface)' }}>{p.title}</p>
                    <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{p.width}×{p.height}</p>
                  </div>
                </button>
                <button type="button" onClick={() => { void handleDelete(p) }} disabled={deletingId !== null}
                  aria-label={`${p.title} 삭제`} title="프로젝트 삭제"
                  className="absolute top-1.5 right-1.5 w-7 h-7 flex items-center justify-center rounded-lg opacity-0 group-hover:opacity-100 focus:opacity-100 transition-opacity disabled:opacity-40"
                  style={{ background: 'color-mix(in srgb, var(--color-background) 85%, transparent)', color: 'var(--color-error)' }}>
                  <span className="material-symbols-outlined text-base">{deletingId === p.projectId ? 'hourglass_empty' : 'delete'}</span>
                </button>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
