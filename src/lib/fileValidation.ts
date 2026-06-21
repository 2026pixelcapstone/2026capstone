import { toast } from '../store/toastStore'

// 백엔드 multipart 한도(파일당 10MB)와 일치. 초과 시 업로드 전에 막아 헛수고/500 방지.
export const MAX_UPLOAD_MB = 10
export const MAX_UPLOAD_BYTES = MAX_UPLOAD_MB * 1024 * 1024

/**
 * 파일 크기 사전 검증. 하나라도 한도를 초과하면 토스트 후 false.
 * @returns 전부 통과 시 true
 */
export function validateFilesSize(files: File[]): boolean {
  const tooBig = files.find(f => f.size > MAX_UPLOAD_BYTES)
  if (tooBig) {
    toast.error(`${tooBig.name}은(는) ${MAX_UPLOAD_MB}MB를 초과합니다.`)
    return false
  }
  return true
}
