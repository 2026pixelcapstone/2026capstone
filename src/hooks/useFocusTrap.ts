import { useEffect, useRef, type RefObject } from 'react'

/**
 * 모달/라이트박스 접근성 공용 훅 — 포커스 트랩.
 *
 * active가 true인 동안:
 *  - Tab / Shift+Tab 포커스를 containerRef 내부로 가둠
 *  - Escape 키로 onEscape 호출(닫기)
 *  - body 스크롤 잠금
 *  - 열리면 컨테이너의 첫 focusable 요소로 포커스 이동
 * 닫히면(cleanup):
 *  - 열기 직전 포커스돼 있던 트리거 요소로 포커스 복원
 *
 * 사용: 모달 컨테이너(div)에 ref를 달고 `useFocusTrap(open, ref, () => setOpen(false))`.
 * (CommissionDetailPage 라이트박스의 인라인 패턴을 공용 추출 — 수정 모달 a11y용)
 */
export function useFocusTrap(
  active: boolean,
  containerRef: RefObject<HTMLElement | null>,
  onEscape?: () => void,
) {
  // onEscape가 렌더마다 새 함수여도 effect가 재실행되지 않도록 ref로 고정
  const onEscapeRef = useRef(onEscape)
  onEscapeRef.current = onEscape

  useEffect(() => {
    if (!active) return

    // 트리거 요소 기억(닫을 때 복원)
    const lastFocused = document.activeElement instanceof HTMLElement ? document.activeElement : null

    const getFocusable = () =>
      containerRef.current?.querySelectorAll<HTMLElement>(
        'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])') ?? null

    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') { onEscapeRef.current?.(); return }
      if (e.key !== 'Tab') return
      const focusable = getFocusable()
      if (!focusable || focusable.length === 0) return
      const first = focusable[0]
      const last = focusable[focusable.length - 1]
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus() }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus() }
    }

    window.addEventListener('keydown', onKey)
    const prevOverflow = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    // 열리면 모달 내부로 포커스 이동(첫 focusable — 보통 닫기 버튼)
    queueMicrotask(() => getFocusable()?.[0]?.focus())

    return () => {
      window.removeEventListener('keydown', onKey)
      document.body.style.overflow = prevOverflow
      lastFocused?.focus()   // 닫히면 트리거로 복원
    }
  }, [active, containerRef])
}
