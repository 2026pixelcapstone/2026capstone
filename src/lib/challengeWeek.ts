/**
 * 주간 챌린지 기간 계산 — 항상 KST(UTC+9) 기준. 브라우저 시간대와 무관하게 같은 결과.
 * 한 주 = 월요일 00:00 KST ~ 일요일 23:59:59 KST. (나중엔 서버가 기간을 내려주고, 이건 표시용 보조)
 */

const KST_OFFSET_MS = 9 * 60 * 60 * 1000
const DAY_MS = 24 * 60 * 60 * 1000

export interface ChallengeWeek {
  /** 시작 시각(월 00:00 KST)의 실제 순간 */
  start: Date
  /** 마감 시각(다음 월 00:00 KST 직전, 즉 일 23:59:59.999 KST)의 실제 순간 */
  end: Date
}

/** now가 속한 주의 시작·마감 */
export function getChallengeWeek(now: Date = new Date()): ChallengeWeek {
  // KST 벽시계 기준으로 옮겨서 날짜 계산(UTC 메서드로 읽으면 시간대 영향 없음)
  const kst = new Date(now.getTime() + KST_OFFSET_MS)
  const dayFromMonday = (kst.getUTCDay() + 6) % 7   // 월=0 … 일=6
  const kstMidnight = Date.UTC(kst.getUTCFullYear(), kst.getUTCMonth(), kst.getUTCDate())
  const startKstWall = kstMidnight - dayFromMonday * DAY_MS
  const start = new Date(startKstWall - KST_OFFSET_MS)
  const end = new Date(start.getTime() + 7 * DAY_MS - 1)
  return { start, end }
}

/** 남은 시간 → {days, hours, minutes} (지났으면 모두 0) */
export function getRemaining(end: Date, now: Date = new Date()) {
  const ms = Math.max(0, end.getTime() - now.getTime())
  return {
    days: Math.floor(ms / DAY_MS),
    hours: Math.floor((ms % DAY_MS) / (60 * 60 * 1000)),
    minutes: Math.floor((ms % (60 * 60 * 1000)) / (60 * 1000)),
  }
}

/** KST 기준 'M월 D일 (요일)' */
export function formatKstDate(d: Date): string {
  return d.toLocaleDateString('ko-KR', { timeZone: 'Asia/Seoul', month: 'long', day: 'numeric', weekday: 'short' })
}
