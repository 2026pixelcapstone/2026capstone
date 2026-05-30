import api from '../lib/axios'

export interface TagResponse {
  tagId: number
  tagName: string
  postCount: number
}

export const tagApi = {
  // 인기 태그 TOP20
  getTopTags: () =>
    api.get<{ success: boolean; data: TagResponse[] }>('/api/tags'),

  // 자동완성 검색
  search: (keyword: string) =>
    api.get<{ success: boolean; data: TagResponse[] }>('/api/tags/search', {
      params: { keyword },
    }),
}
