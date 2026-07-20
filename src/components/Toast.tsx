import { useToastStore } from '../store/toastStore'

const ICONS = {
  success: 'check_circle',
  error:   'error',
  info:    'info',
}

const COLORS = {
  success: { bg: 'color-mix(in srgb, var(--color-success) 12%, var(--color-surface))',  border: 'color-mix(in srgb, var(--color-success) 40%, transparent)',  icon: 'var(--color-success)' },
  error:   { bg: 'color-mix(in srgb, var(--color-error) 12%, var(--color-surface))',    border: 'color-mix(in srgb, var(--color-error) 40%, transparent)',  icon: 'var(--color-error)' },
  info:    { bg: 'color-mix(in srgb, var(--color-primary) 12%, var(--color-surface))',  border: 'color-mix(in srgb, var(--color-primary) 40%, transparent)', icon: 'var(--color-primary)' },
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
              color: 'var(--color-on-surface)',
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
              style={{ color: 'var(--color-on-surface-variant)' }}
            >
              <span className="material-symbols-outlined text-base">close</span>
            </button>
          </div>
        )
      })}
    </div>
  )
}
