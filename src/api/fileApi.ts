import api from '../lib/axios'

export const fileApi = {
  /**
   * 이미지 다건 업로드 → URL 목록 반환
   * @param files 업로드할 파일 목록
   * @param folder R2 저장 경로 (예: "gallery/images", "assets/files")
   */
  uploadImages: async (
    files: File[],
    folder: string,
    onProgress?: (percent: number) => void,
  ): Promise<string[]> => {
    const formData = new FormData()
    files.forEach(file => formData.append('files', file))
    formData.append('folder', folder)

    const res = await api.post<{ data: string[] }>('/api/files/upload/bulk', formData, {
      onUploadProgress: onProgress
        ? (e) => { if (e.total) onProgress(Math.round((e.loaded / e.total) * 100)) }
        : undefined,
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

    const res = await api.post<{ data: string }>('/api/files/upload', formData)
    return res.data.data
  },

  /**
   * 파일 삭제 (업로드 후 후속 작업 실패 시 고아 파일 정리용)
   * @param urls 삭제할 파일 URL 목록
   */
  deleteFiles: async (urls: string[]): Promise<void> => {
    const valid = urls.filter(Boolean)
    if (valid.length === 0) return
    await api.post('/api/files/delete', valid)
  },
}
