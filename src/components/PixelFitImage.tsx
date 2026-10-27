import { useState, type ImgHTMLAttributes } from 'react'

/** 이 크기(긴 변, px)보다 작은 그림만 키운다 — 픽셀아트·작은 GIF용. 큰 사진·일러스트는 그대로 */
export const SMALL_IMAGE_MAX = 240

/** 긴 변이 target에 가깝게 되는 정수 배율(작은 그림만, 아니면 1) */
export function fitScale(w: number, h: number, target: number): number {
  const side = Math.max(w, h)
  if (!side || side >= SMALL_IMAGE_MAX) return 1
  return Math.max(1, Math.floor(target / side))
}

interface PixelFitImageProps extends ImgHTMLAttributes<HTMLImageElement> {
  src: string
  /** 키울 때 긴 변 목표(px) */
  target: number
}

/**
 * 작은 그림(긴 변 240px 미만)을 정수배로 키워 보여 주는 img — 픽셀이 흐려지지 않게 pixelated.
 * 원래 크기는 불러온 뒤에야 알 수 있어 onLoad에서 읽고, src가 바뀌면 다시 잰다.
 */
export default function PixelFitImage({ src, target, style, onLoad, ...rest }: PixelFitImageProps) {
  const [natural, setNatural] = useState<{ src: string; w: number; h: number } | null>(null)
  const k = natural && natural.src === src ? fitScale(natural.w, natural.h, target) : 1

  return (
    <img
      {...rest}
      src={src}
      onLoad={(e) => {
        setNatural({ src, w: e.currentTarget.naturalWidth, h: e.currentTarget.naturalHeight })
        onLoad?.(e)
      }}
      style={k > 1 && natural
        ? { ...style, width: natural.w * k, height: natural.h * k, imageRendering: 'pixelated' }
        : style}
    />
  )
}
