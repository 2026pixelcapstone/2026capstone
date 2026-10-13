/**
 * 주간 챌린지 표시용 시간 도우미. 기간 자체(월 00:00 ~ 다음 월 00:00 KST)는 서버가 정해서 내려준다.
 */

const DAY_MS = 24 * 60 * 60 * 1000

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
