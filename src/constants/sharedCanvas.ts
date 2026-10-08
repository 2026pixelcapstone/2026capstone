/**
 * 공동 픽셀 캔버스(C-3) — 지금은 화면 틀(찍은 칸은 내 화면에만, 저장·실시간 없음).
 * 나중에 서버 저장 + STOMP 실시간 반영 + 쿨다운이 붙어도 크기·팔레트는 여기서 관리.
 */
export const SHARED_CANVAS_SIZE = 64

export const SHARED_CANVAS_BG = '#ffffff'

/** 고정 16색(자체 구성) */
export const SHARED_CANVAS_PALETTE = [
  '#ffffff', '#c8c8c8', '#787878', '#1e1e1e',
  '#ff9fc4', '#e03131', '#f08c00', '#8a5a33',
  '#ffd43b', '#82c91e', '#2f9e44', '#22b8cf',
  '#1c7ed6', '#3b2fc9', '#be4bdb', '#6f2a8f',
] as const

/** 확대 배율(칸 하나의 화면 픽셀 수) */
export const SHARED_CANVAS_ZOOMS = [4, 6, 8, 10, 12, 16] as const
export const SHARED_CANVAS_DEFAULT_ZOOM = 8
/** 이 배율 이상에서만 칸 경계선 표시 */
export const SHARED_CANVAS_GRID_MIN_ZOOM = 8
