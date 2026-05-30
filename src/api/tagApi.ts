import api from '../lib/axios'

export interface TagResponse {
  tagId: number
  tagName: string
  postCount: number
}

export const tagApi = {
  // 자동완성 검색
  search: (keyword: string) =>
    api.get<{ success: boolean; data: TagResponse[] }>('/api/tags/search', {
      params: { keyword },
    }),
}
