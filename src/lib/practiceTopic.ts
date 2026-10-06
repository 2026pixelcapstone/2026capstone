import { PRACTICE_CONSTRAINTS, PRACTICE_SUBJECTS } from '../constants/challenge'

/** 목록에서 하나 — 직전 값과는 다르게(같은 결과 연속 방지) */
export function pickDifferent(list: readonly string[], prev: string | null): string {
  if (list.length < 2) return list[0]
  let next = prev
  while (next === prev) next = list[Math.floor(Math.random() * list.length)]
  return next as string
}

/** 연습 주제 한 번 뽑기 — 챌린지 페이지와 메인 오른쪽 위젯 공용 */
export function drawPracticeTopic(prev: { subject: string; constraint: string } | null) {
  return {
    subject: pickDifferent(PRACTICE_SUBJECTS, prev?.subject ?? null),
    constraint: pickDifferent(PRACTICE_CONSTRAINTS, prev?.constraint ?? null),
  }
}
