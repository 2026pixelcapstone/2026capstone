import { useEffect, useState } from 'react'
import { Link, useNavigate, useParams } from 'react-router-dom'
import { paletteApi, type PaletteDetail } from '../api/paletteApi'
import { PaletteAuthor, PaletteStrip } from '../components/palette/PaletteCard'
import PaletteFormModal from '../components/palette/PaletteFormModal'
import { safeFileName, saveFile, toGplFile, toHexFile, toJascPalFile, toPngBlob } from '../lib/paletteExport'
import { useAuthStore } from '../store/authStore'
import { useEmailGate } from '../hooks/useEmailGate'
import { toast } from '../store/toastStore'
import { getErrorMessage, getErrorStatus } from '../lib/errorUtils'

export default function PaletteDetailPage() {
  const { id } = useParams<{ id: string }>()
  const paletteId = Number(id)
  const navigate = useNavigate()
  const { isLoggedIn } = useAuthStore()
  const { guard, gateProps } = useEmailGate()

  const [palette, setPalette] = useState<PaletteDetail | null>(null)
  const [status, setStatus] = useState<'loading' | 'ok' | 'notfound' | 'error'>('loading')
  const [liking, setLiking] = useState(false)
  const [editing, setEditing] = useState(false)
  const [deleting, setDeleting] = useState(false)

  useEffect(() => {
    let alive = true   // 다른 팔레트로 빠르게 이동할 때 이전 응답 버리기
    setStatus('loading')
    paletteApi.get(paletteId)
      .then(res => { if (alive) { setPalette(res.data.data); setStatus('ok') } })
      .catch(err => { if (alive) setStatus(getErrorStatus(err) === 404 ? 'notfound' : 'error') })
    return () => { alive = false }
  }, [paletteId])

  const copyHex = async (hex: string) => {
    try {
      await navigator.clipboard.writeText(hex)
      toast.success(`${hex} 복사했습니다.`)
    } catch {
      toast.error('복사하지 못했습니다.')
    }
  }

  const handleLike = async () => {
    if (!palette || liking) return
    if (!isLoggedIn) { navigate('/login', { state: { from: `/community/palettes/${paletteId}` } }); return }
    setLiking(true)
    try {
      const liked = (await paletteApi.toggleLike(paletteId)).data.data
      setPalette(p => p ? { ...p, isLiked: liked, likeCount: Math.max(0, p.likeCount + (liked ? 1 : -1)) } : p)
    } catch (err) {
      toast.error(getErrorMessage(err, '좋아요를 처리하지 못했습니다.'))
    } finally {
      setLiking(false)
    }
  }

  const handleDelete = async () => {
    if (!palette || deleting) return
    if (!window.confirm('이 팔레트를 삭제할까요?')) return
    setDeleting(true)
    try {
      await paletteApi.remove(paletteId)
      toast.success('팔레트를 삭제했습니다.')
      navigate('/community/palettes')
    } catch (err) {
      toast.error(getErrorMessage(err, '삭제하지 못했습니다.'))
      setDeleting(false)
    }
  }

  const download = async (kind: 'hex' | 'gpl' | 'pal' | 'png1' | 'png8') => {
    if (!palette) return
    const base = safeFileName(palette.name)
    try {
      if (kind === 'hex') saveFile(toHexFile(palette.colors), `${base}.hex`)
      else if (kind === 'gpl') saveFile(toGplFile(palette.name, palette.colors), `${base}.gpl`)
      else if (kind === 'pal') saveFile(toJascPalFile(palette.colors), `${base}.pal`)
      else {
        const scale = kind === 'png1' ? 1 : 8
        saveFile(await toPngBlob(palette.colors, scale), `${base}-${scale}x.png`)
      }
    } catch {
      toast.error('파일을 만들지 못했습니다.')
    }
  }

  const page = (children: React.ReactNode) => (
    <div className="min-h-screen" style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)' }}>
      <div className="max-w-screen-lg mx-auto px-4 sm:px-6 py-8">{children}</div>
    </div>
  )

  if (status === 'loading') return page(<div className="h-64 rounded-2xl animate-pulse" style={{ background: 'var(--color-surface-container)' }} />)
  if (status !== 'ok' || !palette) {
    return page(
      <div className="flex flex-col items-center py-24 gap-3">
        <span className="material-symbols-outlined text-5xl" style={{ color: 'var(--color-outline)' }}>palette</span>
        <p style={{ color: 'var(--color-on-surface-variant)' }}>
          {status === 'notfound' ? '팔레트를 찾을 수 없습니다.' : '팔레트를 불러오지 못했습니다.'}
        </p>
        <Link to="/community/palettes" className="text-sm font-bold" style={{ color: 'var(--color-primary)' }}>팔레트 목록으로</Link>
      </div>,
    )
  }

  const btn = { background: 'var(--color-surface-container)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }

  return page(
    <>
      <div className="flex items-center gap-2 text-sm mb-4" style={{ color: 'var(--color-on-surface-variant)' }}>
        <Link to="/community" className="hover:underline">커뮤니티</Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <Link to="/community/palettes" className="hover:underline">팔레트</Link>
        <span className="material-symbols-outlined text-sm">chevron_right</span>
        <span className="truncate" style={{ color: 'var(--color-on-surface)' }}>{palette.name}</span>
      </div>

      <PaletteStrip colors={palette.colors} height={120} />

      <div className="flex flex-wrap items-start justify-between gap-4 mt-6">
        <div className="min-w-0">
          <h1 className="text-2xl font-bold break-words">{palette.name}</h1>
          <p className="text-sm mt-1" style={{ color: 'var(--color-on-surface-variant)' }}>
            {palette.isOfficial
              ? <PaletteAuthor palette={palette} />
              : <Link to={`/profile/${palette.authorNickname}`} className="hover:underline">{palette.authorNickname}</Link>}
            {' · '}{palette.colorCount}색 · {new Date(palette.createdAt).toLocaleDateString('ko-KR')}
          </p>
          {palette.description && (
            <p className="text-sm mt-3 whitespace-pre-line" style={{ color: 'var(--color-on-surface-variant)' }}>{palette.description}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-2">
          <button type="button" onClick={handleLike} disabled={liking} aria-pressed={palette.isLiked}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-60"
            style={{ ...btn, color: palette.isLiked ? '#e11d48' : 'var(--color-on-surface)', borderColor: palette.isLiked ? '#e11d48' : 'var(--color-outline)' }}>
            <span className="material-symbols-outlined text-base" style={{ fontVariationSettings: palette.isLiked ? "'FILL' 1" : "'FILL' 0" }}>favorite</span>
            {palette.likeCount}
          </button>
          <button type="button" onClick={guard(() => navigate(`/editor?palette=${palette.paletteId}`))} {...gateProps}
            className="flex items-center gap-1.5 px-4 py-2 rounded-xl text-sm font-bold hover:opacity-90"
            style={{ background: 'var(--color-primary)', color: 'var(--color-on-primary)' }}>
            <span className="material-symbols-outlined text-base">brush</span>
            에디터에서 사용
          </button>
          {palette.isMine && (
            <>
              <button type="button" onClick={() => setEditing(true)} className="px-4 py-2 rounded-xl text-sm" style={btn}>수정</button>
              <button type="button" onClick={handleDelete} disabled={deleting}
                className="px-4 py-2 rounded-xl text-sm disabled:opacity-50" style={{ ...btn, color: '#e11d48', borderColor: '#e11d48' }}>
                {deleting ? '삭제 중...' : '삭제'}
              </button>
            </>
          )}
        </div>
      </div>

      <section className="mt-8">
        <h2 className="font-bold mb-3">색 <span className="text-xs font-normal" style={{ color: 'var(--color-on-surface-variant)' }}>누르면 HEX 복사</span></h2>
        <div className="grid grid-cols-4 sm:grid-cols-8 gap-2">
          {palette.colors.map((c, i) => (
            <button key={`${c}-${i}`} type="button" onClick={() => copyHex(c)} title={`${c} 복사`}
              className="rounded-lg overflow-hidden border text-left hover:-translate-y-0.5 transition-transform"
              style={{ borderColor: 'var(--color-outline)' }}>
              <div className="h-14" style={{ background: c }} />
              <div className="px-2 py-1 text-xs font-mono" style={{ background: 'var(--color-surface-container)' }}>{c}</div>
            </button>
          ))}
        </div>
      </section>

      <section className="mt-8">
        <h2 className="font-bold mb-3">다운로드</h2>
        <div className="flex flex-wrap gap-2">
          {([
            ['hex', '.hex', 'Lospec 등'],
            ['gpl', '.gpl', 'GIMP·Aseprite'],
            ['pal', '.pal', 'JASC·Aseprite'],
            ['png1', 'PNG 1×', '색당 1픽셀'],
            ['png8', 'PNG 8×', '색당 8픽셀'],
          ] as const).map(([kind, label, hint]) => (
            <button key={kind} type="button" onClick={() => void download(kind)}
              className="flex flex-col items-start px-4 py-2 rounded-xl text-sm hover:bg-surface-container-high" style={btn}>
              <span className="font-bold">{label}</span>
              <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>{hint}</span>
            </button>
          ))}
        </div>
      </section>

      {editing && (
        <PaletteFormModal
          paletteId={palette.paletteId}
          initialName={palette.name}
          initialDescription={palette.description ?? ''}
          initialColors={palette.colors}
          onClose={() => setEditing(false)}
          onSaved={p => { setPalette(p); setEditing(false); toast.success('팔레트를 수정했습니다.') }}
        />
      )}
    </>,
  )
}
