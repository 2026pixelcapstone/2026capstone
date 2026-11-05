/**
 * 공동 픽셀 캔버스(C-3) 화면 설정. 판 크기·팔레트 16색·쿨다운·시즌은 서버가 정해 스냅샷(GET /api/canvas)으로 내려 줌
 * — 여기 SIZE는 스냅샷이 오기 전 자리 잡기용.
 */
export const SHARED_CANVAS_SIZE = 64

/** 확대 배율(칸 하나의 화면 픽셀 수) */
export const SHARED_CANVAS_ZOOMS = [4, 6, 8, 10, 12, 16] as const
export const SHARED_CANVAS_DEFAULT_ZOOM = 8
/** 이 배율 이상에서만 칸 경계선 표시 */
export const SHARED_CANVAS_GRID_MIN_ZOOM = 8
