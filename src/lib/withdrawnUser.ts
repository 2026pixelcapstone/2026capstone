/** 탈퇴 계정 닉네임 접두사 — 서버 Profile.WITHDRAWN_NICKNAME_PREFIX와 같은 값 */
export const WITHDRAWN_NICKNAME_PREFIX = '탈퇴한사용자_'

/** 탈퇴한 사용자의 닉네임인지(댓글·리뷰·거래 기록에 남은 이름) */
export function isWithdrawnNickname(nickname: string | null | undefined): boolean {
  return !!nickname && nickname.startsWith(WITHDRAWN_NICKNAME_PREFIX)
}
