import { useToastStore } from '../store/toastStore'

const ICONS = {
  success: 'check_circle',
  error:   'error',
  info:    'info',
}

const COLORS = {
  success: { bg: '#1a2e1a', border: 'rgba(63,185,80,0.4)',  icon: '#3fb950' },
  error:   { bg: '#2e1a1a', border: 'rgba(248,81,73,0.4)',  icon: '#f85149' },
  info:    { bg: '#1a2233', border: 'rgba(47,129,247,0.4)', icon: '#2f81f7' },
}

export default function Toast() {
  const { toasts, dismiss } = useToastStore()

  if (toasts.length === 0) return null

  return (
    <div className="fixed bottom-6 right-6 z-[9999] flex flex-col gap-2 pointer-events-none">
      {toasts.map(t => {
        const c = COLORS[t.type]
        return (
          <div
            key={t.id}
            className="flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl pointer-events-auto animate-fade-in"
            style={{
              background: c.bg,
              border: `1px solid ${c.border}`,
              color: '#e6edf3',
              minWidth: 260,
              maxWidth: 360,
            }}
          >
            <span
              className="material-symbols-outlined text-lg flex-shrink-0"
              style={{ fontVariationSettings: "'FILL' 1", color: c.icon }}
            >
              {ICONS[t.type]}
            </span>
            <span className="text-sm flex-1">{t.message}</span>
            <button
              onClick={() => dismiss(t.id)}
              className="flex-shrink-0 transition-opacity hover:opacity-70"
              style={{ color: '#7d8590' }}
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
