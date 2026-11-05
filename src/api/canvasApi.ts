import api from '../lib/axios'

/** GET /api/canvas — board = 칸 4096개(행 우선) 색 번호 바이트의 base64 */
export interface CanvasSnapshot {
  seasonId: number
  size: number
  palette: string[]
  board: string
  version: number
  seasonEndsAt: string
  cooldownSeconds: number
  cooldownRemainingMs: number
}

export interface CanvasPixelResult {
  seasonId: number
  x: number
  y: number
  color: number
  version: number
  cooldownRemainingMs: number
}

/** /topic/canvas 이벤트 — PIXEL = 칸 하나, REFRESH = 스냅샷을 다시 받아야 함(관리자 되돌리기·시즌 교체) */
export interface CanvasEvent {
  type: 'PIXEL' | 'REFRESH'
  seasonId: number
  x: number | null
  y: number | null
  color: number | null
  version: number
}

export const canvasApi = {
  getSnapshot: () => api.get<{ success: boolean; data: CanvasSnapshot }>('/api/canvas'),
  place: (body: { x: number; y: number; color: number }) =>
    api.post<{ success: boolean; data: CanvasPixelResult }>('/api/canvas/pixels', body),
}
