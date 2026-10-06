/** 잘라낼 영역(원본 이미지 픽셀 좌표) — react-easy-crop의 croppedAreaPixels와 같은 모양 */
export interface PixelArea {
  x: number
  y: number
  width: number
  height: number
}

/** 프로필 사진으로 허용하는 형식(서버와 동일) */
export const PROFILE_IMAGE_TYPES = ['image/png', 'image/jpeg', 'image/gif', 'image/webp']
export const MAX_PROFILE_IMAGE_BYTES = 2 * 1024 * 1024

/** 움직일 수 있는 형식 — 잘라내면 첫 장면만 남음 */
export const isPossiblyAnimated = (type: string) => type === 'image/gif' || type === 'image/webp'

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error('이미지를 불러오지 못했습니다.'))
    img.src = src
  })
}

/**
 * 이미지의 지정 영역을 잘라 새 이미지(Blob)로 만든다.
 * 확대·축소 없이 원본 픽셀을 1:1로 옮김(해상도 유지). JPEG·WebP는 같은 형식, 그 외(PNG·GIF)는 PNG로.
 * GIF 등 움직이는 이미지는 첫 장면만 남는다(canvas 한계).
 */
export async function cropToBlob(src: string, area: PixelArea, sourceType: string): Promise<{ blob: Blob; filename: string }> {
  const img = await loadImage(src)
  const w = Math.max(1, Math.round(area.width))
  const h = Math.max(1, Math.round(area.height))
  const canvas = document.createElement('canvas')
  canvas.width = w
  canvas.height = h
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('이미지를 처리할 수 없습니다.')
  ctx.imageSmoothingEnabled = false
  ctx.drawImage(img, Math.round(area.x), Math.round(area.y), w, h, 0, 0, w, h)

  const outType = sourceType === 'image/jpeg' || sourceType === 'image/webp' ? sourceType : 'image/png'
  const blob = await new Promise<Blob | null>(resolve => canvas.toBlob(resolve, outType, 0.92))
  if (!blob) throw new Error('이미지를 처리할 수 없습니다.')
  // 브라우저가 WebP 인코딩을 못 하면 PNG로 나오므로, 확장자는 실제 결과 형식 기준
  const ext = blob.type === 'image/jpeg' ? 'jpg' : blob.type === 'image/webp' ? 'webp' : 'png'
  return { blob, filename: `profile.${ext}` }
}
