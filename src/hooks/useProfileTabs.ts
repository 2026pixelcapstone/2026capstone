import { useState, useEffect, useLayoutEffect, useRef, useCallback } from 'react'
import { userApi } from '../api/userApi'
import { editorApi, type ProjectSummary } from '../api/editorApi'
import { galleryApi, type GalleryPostSummary } from '../api/galleryApi'
import { assetApi, type AssetSummary, type LibraryAsset } from '../api/assetApi'
import { commissionApi, type CommissionSummary } from '../api/commissionApi'
import type { ProfileUserSummary } from '../components/profile/ProfileCards'

export type SortKey = 'recent' | 'popular'

// 한 번에 받는 개수 — 카드 그리드가 3열이라 24(8줄)
const PAGE_SIZE = 24

/** 탭 하나의 응답을 화면에 반영할 형태로 묶은 것 — total은 서버 전체 개수(totalElements) */
type TabData =
  | { key: 'works' | 'liked'; items: GalleryPostSummary[]; total: number }
  | { key: 'assets'; items: AssetSummary[]; total: number }
  | { key: 'following' | 'followers'; items: ProfileUserSummary[]; total: number }
  | { key: 'saved'; items: ProjectSummary[]; total: number }
  | { key: 'commission'; client: CommissionSummary[]; artist: CommissionSummary[]; clientTotal: number; artistTotal: number }
  | { key: 'library'; purchased: LibraryAsset[]; free: LibraryAsset[]; purchasedTotal: number; freeTotal: number }

/** 탭 데이터 요청 — state를 건드리지 않는 순수 함수(반영 여부는 호출부가 세대 가드로 결정). 차단 등 해당 없는 탭은 null.
 *  saved·commission·library는 "내 것"만 조회하는 API라 MyPage에서만 요청됨. */
async function loadTab(key: string, userId: number, sort: SortKey): Promise<TabData | null> {
  switch (key) {
    case 'works': {
      const sortParam = sort === 'popular' ? 'likeCount,desc' : 'createdAt,desc'
      const page = (await galleryApi.getList({ authorId: userId, size: PAGE_SIZE, sort: sortParam })).data.data
      return { key, items: page.content, total: page.totalElements }
    }
    case 'liked': {
      const page = (await galleryApi.getList({ likedBy: userId, size: PAGE_SIZE, sort: 'createdAt,desc' })).data.data
      return { key, items: page.content, total: page.totalElements }
    }
    case 'assets': {
      const page = (await assetApi.getList({ authorId: userId, size: PAGE_SIZE, sort: 'createdAt,desc' })).data.data
      return { key, items: page.content, total: page.totalElements }
    }
    case 'following':
    case 'followers': {
      const res = key === 'following' ? await userApi.getFollowing(userId) : await userApi.getFollowers(userId)
      const items = res.data.data
      return { key, items, total: items.length }   // 목록 전체가 오므로 길이가 곧 최신 개수
    }
    case 'saved': {
      const page = (await editorApi.getProjects({ size: PAGE_SIZE })).data.data
      return { key, items: page.content, total: page.totalElements }
    }
    case 'commission': {
      const [client, artist] = await Promise.all([
        commissionApi.getMyListAsClient({ size: 50 }),
        commissionApi.getMyListAsArtist({ size: 50 }),
      ])
      return {
        key,
        client: client.data.data.content, artist: artist.data.data.content,
        clientTotal: client.data.data.totalElements, artistTotal: artist.data.data.totalElements,
      }
    }
    case 'library': {
      // 구매·무료 두 목록을 함께 받음 — 탭 숫자가 합계라 하위 토글과 무관하게 둘 다 필요
      const [purchased, free] = await Promise.all([
        assetApi.getLibrary({ type: 'PURCHASED', size: PAGE_SIZE }),
        assetApi.getLibrary({ type: 'FREE', size: PAGE_SIZE }),
      ])
      return {
        key,
        purchased: purchased.data.data.content, free: free.data.data.content,
        purchasedTotal: purchased.data.data.totalElements, freeTotal: free.data.data.totalElements,
      }
    }
    default:
      return null
  }
}

interface TabLists {
  works: GalleryPostSummary[]
  liked: GalleryPostSummary[]
  assets: AssetSummary[]
  following: ProfileUserSummary[]
  followers: ProfileUserSummary[]
  saved: ProjectSummary[]
  commissions: { client: CommissionSummary[]; artist: CommissionSummary[] }
  library: { purchased: LibraryAsset[]; free: LibraryAsset[] }
}

const EMPTY_LISTS: TabLists = {
  works: [], liked: [], assets: [], following: [], followers: [], saved: [],
  commissions: { client: [], artist: [] },
  library: { purchased: [], free: [] },
}

interface UseProfileTabsOptions {
  /** 누구의 탭인지. 로드 전이면 undefined(요청 안 함). 바뀌면 모든 탭 상태를 비움 */
  userId: number | undefined
  /** 활성 탭 — 들어올 때마다 다시 받음 */
  tab: string
  /** 작품 탭 정렬 */
  sort: SortKey
  /** userId가 정해지면 한 번, 숫자용으로 미리 받을 탭(활성 탭 제외). 모듈 상수로 넘길 것 */
  prefetch?: readonly string[]
}

/**
 * 마이페이지·프로필 공용 탭 데이터 훅.
 * - 탭별 세대 가드(reqGen): 같은 탭의 마지막 요청 응답만 반영(TROUBLESHOOTING #26)
 * - 사용자 세대(epoch): userId가 바뀐 뒤 도착한 이전 사용자 응답은 버림
 * - 스피너는 처음 받는 탭에만 — 이미 본 탭은 기존 내용을 보여주며 뒤에서 갱신
 */
export function useProfileTabs({ userId, tab, sort, prefetch = [] }: UseProfileTabsOptions) {
  const [lists, setLists] = useState<TabLists>(EMPTY_LISTS)
  const [totals, setTotals] = useState<Record<string, number>>({})          // 서버 기준 전체 개수
  const [commissionTotals, setCommissionTotals] = useState<{ client: number; artist: number } | null>(null)
  const [libraryTotals, setLibraryTotals] = useState<{ purchased: number; free: number } | null>(null)
  const [loadingTabs, setLoadingTabs] = useState<Record<string, boolean>>({}) // 요청 중
  const [loadedTabs, setLoadedTabs] = useState<Record<string, boolean>>({})   // 한 번이라도 받음
  const reqGen = useRef<Record<string, number>>({})
  const epoch = useRef(0)

  // 사용자가 바뀌면 렌더 중에 바로 비움 — effect로 비우면 새 사용자 화면에 이전 사용자 목록이 한 프레임 그려짐
  const [owner, setOwner] = useState(userId)
  if (owner !== userId) {
    setOwner(userId)
    setLists(EMPTY_LISTS)
    setTotals({})
    setCommissionTotals(null)
    setLibraryTotals(null)
    setLoadingTabs({})
    setLoadedTabs({})
  }

  // 사용자 세대 증가 — layout effect라 커밋 직후 동기 실행: ①페인트 전이라 그 사이 도착한 이전 사용자 응답도 무효화,
  // ②모든 useEffect(아래 요청 effect)보다 항상 먼저 실행되므로 선언 순서에 의존하지 않음
  useLayoutEffect(() => { epoch.current += 1 }, [userId])

  /** 탭 하나를 (다시) 받아 반영. 그사이 사용자가 바뀌었거나 같은 탭에 더 새 요청이 있으면 버림. 실패 시 기존 유지. */
  const refreshTab = useCallback(async (key: string, uid: number, sortKey: SortKey) => {
    const myEpoch = epoch.current
    const gen = (reqGen.current[key] ?? 0) + 1
    reqGen.current[key] = gen
    const isLatest = () => epoch.current === myEpoch && reqGen.current[key] === gen
    setLoadingTabs(s => ({ ...s, [key]: true }))
    try {
      const data = await loadTab(key, uid, sortKey)
      if (!data || !isLatest()) return
      let total: number
      if (data.key === 'commission') {
        setLists(s => ({ ...s, commissions: { client: data.client, artist: data.artist } }))
        setCommissionTotals({ client: data.clientTotal, artist: data.artistTotal })
        total = data.clientTotal + data.artistTotal
      } else if (data.key === 'library') {
        setLists(s => ({ ...s, library: { purchased: data.purchased, free: data.free } }))
        setLibraryTotals({ purchased: data.purchasedTotal, free: data.freeTotal })
        total = data.purchasedTotal + data.freeTotal
      } else {
        setLists(s => ({ ...s, [data.key]: data.items }))
        total = data.total
      }
      setTotals(s => ({ ...s, [key]: total }))
      setLoadedTabs(s => ({ ...s, [key]: true }))
    } catch {
      // 실패 시 기존 데이터·숫자 유지
    } finally {
      if (isLatest()) setLoadingTabs(s => ({ ...s, [key]: false }))
    }
  }, [])

  // 활성 탭 — 들어올 때마다(작품 탭은 정렬 변경 시에도) 다시 받음
  useEffect(() => {
    if (userId) void refreshTab(tab, userId, sort)
  }, [userId, tab, sort, refreshTab])

  // 숫자용 미리 받기 — userId가 정해지면 한 번(활성 탭은 위 effect 담당이라 제외)
  useEffect(() => {
    if (!userId) return
    prefetch.filter(k => k !== tab).forEach(k => void refreshTab(k, userId, sort))
    // eslint-disable-next-line react-hooks/exhaustive-deps -- userId 확정 시 1회만(tab/sort 변경은 위 effect 담당)
  }, [userId, refreshTab])

  /** 아직 한 번도 못 받은 탭을 받는 중일 때만 true */
  const showSpinner = useCallback((key: string) => !!loadingTabs[key] && !loadedTabs[key], [loadingTabs, loadedTabs])

  /** 한 번이라도 받았는지 — 빈 상태 문구를 로드 완료 후에만 보여줄 때 */
  const isLoaded = useCallback((key: string) => !!loadedTabs[key], [loadedTabs])

  return { ...lists, totals, commissionTotals, libraryTotals, showSpinner, isLoaded }
}
