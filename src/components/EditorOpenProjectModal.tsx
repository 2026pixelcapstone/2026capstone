import { useEffect, useState } from 'react'
import { editorApi, type ProjectSummary } from '../api/editorApi'
import { toast } from '../store/toastStore'

interface Props {
  isOpen: boolean
  onClose: () => void
  onSelect: (projectId: number) => void
}

export default function EditorOpenProjectModal({ isOpen, onClose, onSelect }: Props) {
  const [projects, setProjects] = useState<ProjectSummary[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    if (!isOpen) return
    setLoading(true)
    editorApi.getProjects({ size: 60 })
      .then(res => setProjects(res.data.data.content))
      .catch(() => toast.error('프로젝트 목록을 불러오지 못했습니다.'))
      .finally(() => setLoading(false))
  }, [isOpen])

  // 열렸을 때 ESC 닫기 + 배경 스크롤 잠금
  useEffect(() => {
    if (!isOpen) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [isOpen, onClose])

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/70 p-4"
      onClick={onClose} role="dialog" aria-modal="true" aria-label="프로젝트 열기">
      <div className="w-full max-w-2xl max-h-[80vh] flex flex-col rounded-2xl overflow-hidden"
        style={{ background: '#161b22', border: '1px solid #30363d' }}
        onClick={e => e.stopPropagation()}>
        <div className="flex items-center justify-between px-5 py-4 border-b" style={{ borderColor: '#30363d' }}>
          <h2 className="text-base font-bold" style={{ color: '#e6edf3' }}>프로젝트 열기</h2>
          <button type="button" onClick={onClose} aria-label="닫기"
            className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-[#21262d]" style={{ color: '#7d8590' }}>
            <span className="material-symbols-outlined text-base">close</span>
          </button>
        </div>

        <div className="p-5 overflow-y-auto">
          {loading ? (
            <p className="text-sm text-center py-10" style={{ color: '#7d8590' }}>불러오는 중...</p>
          ) : projects.length === 0 ? (
            <p className="text-sm text-center py-10" style={{ color: '#7d8590' }}>저장된 프로젝트가 없습니다.</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {projects.map(p => (
                <button key={p.projectId} type="button" onClick={() => onSelect(p.projectId)}
                  className="text-left rounded-xl overflow-hidden transition-colors hover:bg-[#1c2128]"
                  style={{ border: '1px solid #30363d' }}>
                  <div className="aspect-square flex items-center justify-center overflow-hidden" style={{ background: '#0d1117' }}>
                    {p.thumbnailUrl ? (
                      <img src={p.thumbnailUrl} alt={p.title}
                        className="w-full h-full object-contain" style={{ imageRendering: 'pixelated' }} />
                    ) : (
                      <span className="material-symbols-outlined" style={{ color: '#484f58', fontSize: 32 }}>image</span>
                    )}
                  </div>
                  <div className="px-2.5 py-2">
                    <p className="text-sm font-bold truncate" style={{ color: '#e6edf3' }}>{p.title}</p>
                    <p className="text-xs" style={{ color: '#7d8590' }}>{p.width}×{p.height}</p>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
