import api from '../lib/axios'

export const fileApi = {
  /**
   * 이미지 다건 업로드 → URL 목록 반환
   * @param files 업로드할 파일 목록
   * @param folder R2 저장 경로 (예: "gallery/images", "assets/files")
   */
  uploadImages: async (files: File[], folder: string): Promise<string[]> => {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    formData.append('folder', folder)

    const res = await api.post<{ data: string[] }>('/api/files/upload/bulk', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },

  /**
   * 이미지 단건 업로드 → URL 반환
   */
  uploadImage: async (file: File, folder: string): Promise<string> => {
    const formData = new FormData()
    formData.append('file', file)
    formData.append('folder', folder)

    const res = await api.post<{ data: string }>('/api/files/upload', formData, {
      headers: { 'Content-Type': 'multipart/form-data' },
    })
    return res.data.data
  },
}
