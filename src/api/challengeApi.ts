import api from '../lib/axios'
import type { GalleryPostSummary, PageResponse } from './galleryApi'

/** 이번 주 챌린지. startsAt/endsAt은 KST 오프셋 포함 ISO, endsAt은 미포함 경계(다음 주 월 00:00) */
export interface Challenge {
  challengeId: number
  topic: string
  description: string | null
  startsAt: string
  endsAt: string
  entryCount: number
  myEntryPostId: number | null   // 로그인 사용자의 현재 참가작
}

/** 지난 챌린지 결과 — post가 null이면 삭제·비공개로 '볼 수 없는 작품' */
export interface ChallengeWinner {
  rank: number
  likeCount: number
  post: GalleryPostSummary | null
}

export interface PastChallenge {
  challengeId: number
  topic: string
  description: string | null
  startsAt: string
  endsAt: string
  winners: ChallengeWinner[]
}

export type ChallengeEntrySort = 'likes' | 'recent'

/** 참가 결과(백엔드 ChallengeEntryResult) — 업로드 체크 시 응답 challengeEntryResult로도 옴 */
export type ChallengeEntryResult =
  | 'ENTERED' | 'REPLACED'
  | 'NO_CHALLENGE' | 'NOT_OWNER' | 'OUT_OF_PERIOD' | 'NOT_PUBLIC' | 'REMIX'

export const challengeApi = {
  /** 준비 중이면 data = null */
  getCurrent: () =>
    api.get<{ success: boolean; data: Challenge | null }>('/api/challenges/current'),

  getPast: (page = 0, size = 10) =>
    api.get<{ success: boolean; data: PageResponse<PastChallenge> }>('/api/challenges/past', { params: { page, size } }),

  getEntries: (challengeId: number, sort: ChallengeEntrySort, page = 0, size = 24) =>
    api.get<{ success: boolean; data: PageResponse<GalleryPostSummary> }>(
      `/api/challenges/${challengeId}/entries`, { params: { sort, page, size } }),

  enter: (postId: number) =>
    api.post<{ success: boolean; data: { result: ChallengeEntryResult; postId: number } }>(
      '/api/challenges/current/entry', { postId }),

  cancel: () =>
    api.delete<{ success: boolean }>('/api/challenges/current/entry'),
}

/** 업로드 체크박스 결과 안내 문구 — 실패여도 작품은 이미 등록된 상태 */
export function challengeEntryMessage(result: ChallengeEntryResult): { ok: boolean; text: string } {
  switch (result) {
    case 'ENTERED': return { ok: true, text: '이번 주 챌린지에 참가했어요.' }
    case 'REPLACED': return { ok: true, text: '챌린지 참가작을 이 작품으로 바꿨어요.' }
    case 'NO_CHALLENGE': return { ok: false, text: '이번 주 챌린지가 준비 중이라 참가하지 못했어요. 작품은 등록됐어요.' }
    case 'NOT_PUBLIC': return { ok: false, text: '공개 작품만 챌린지에 참가할 수 있어요. 작품은 등록됐어요.' }
    case 'REMIX': return { ok: false, text: '리믹스 작품은 챌린지에 참가할 수 없어요. 작품은 등록됐어요.' }
    case 'OUT_OF_PERIOD': return { ok: false, text: '이번 주 챌린지 기간이 아니라 참가하지 못했어요. 작품은 등록됐어요.' }
    default: return { ok: false, text: '챌린지에 참가하지 못했어요. 작품은 등록됐어요.' }
  }
}

/** 이 작품이 이번 주 챌린지에 참가할 수 있는 조건인지(표시용 — 실제 판정은 서버) */
export function isEligibleForChallenge(
  post: { createdAt: string; visibility: string; originPostId?: number | null },
  challenge: Pick<Challenge, 'startsAt' | 'endsAt'>,
): boolean {
  const created = new Date(post.createdAt).getTime()
  return post.visibility === 'PUBLIC'
    && post.originPostId == null
    && created >= new Date(challenge.startsAt).getTime()
    && created < new Date(challenge.endsAt).getTime()
}
