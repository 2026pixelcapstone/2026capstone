import { useSearchParams } from 'react-router-dom'
import type { SortKey } from './useProfileTabs'

/**
 * 마이페이지·프로필의 탭 상태를 주소(?tab=&sort=&sub=)에 둔다(정본 = URL).
 * - 상세에 갔다가 뒤로가기 하면 같은 탭으로 돌아오고, 다른 화면에서 특정 탭으로 바로 링크할 수 있다.
 * - 탭 전환은 방문 기록에 추가(뒤로가기로 이전 탭 복귀), 정렬·하위 탭 변경은 기록 교체.
 * - 주소 값은 사용자가 고칠 수 있으므로 validTabs에 없는 탭은 '작품'으로(남의 프로필에서 비공개 탭 차단).
 */
export function useProfileTabParams(validTabs: readonly string[]) {
  const [searchParams, setSearchParams] = useSearchParams()

  const tabParam = searchParams.get('tab')
  const tab = tabParam && validTabs.includes(tabParam) ? tabParam : 'works'
  const sort: SortKey = searchParams.get('sort') === 'popular' ? 'popular' : 'recent'
  const sub = searchParams.get('sub')   // 하위 탭 값 해석은 페이지가 허용 목록으로

  const setTab = (next: string) => {
    if (next === tab) return
    setSearchParams(next === 'works' ? {} : { tab: next })
  }

  const update = (patch: Record<string, string | null>) => {
    setSearchParams((prev) => {
      const params = new URLSearchParams(prev)
      for (const [key, value] of Object.entries(patch)) {
        if (value === null) params.delete(key)
        else params.set(key, value)
      }
      return params
    }, { replace: true })
  }

  const setSort = (s: SortKey) => update({ sort: s === 'recent' ? null : s })
  const setSub = (s: string | null) => update({ sub: s })

  return { tab, sort, sub, setTab, setSort, setSub }
}
