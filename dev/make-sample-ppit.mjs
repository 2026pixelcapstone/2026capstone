// 테스트용 샘플 .ppit 생성기 (빌드 비포함, 개발 전용)
// 16x16 / 2프레임 / 2레이어(face + features) 스마일 애니메이션. 레이어는 PNG dataURL.
// 실행: node dev/make-sample-ppit.mjs  → dev/sample.ppit
import { deflateSync } from 'node:zlib'
import { writeFileSync } from 'node:fs'

const W = 16, H = 16

// ── 최소 PNG(RGBA) 인코더 ──
const CRC_TABLE = (() => {
  const t = new Uint32Array(256)
  for (let n = 0; n < 256; n++) {
    let c = n
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    t[n] = c >>> 0
  }
  return t
})()
function crc32(buf) {
  let c = 0xffffffff
  for (let i = 0; i < buf.length; i++) c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8)
  return (c ^ 0xffffffff) >>> 0
}
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length, 0)
  const typeBuf = Buffer.from(type, 'ascii')
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0)
  return Buffer.concat([len, typeBuf, data, crc])
}
function pngDataUrl(pixelFn) {
  // 필터바이트 0 + RGBA 스캔라인
  const raw = Buffer.alloc(H * (1 + W * 4))
  let o = 0
  for (let y = 0; y < H; y++) {
    raw[o++] = 0
    for (let x = 0; x < W; x++) {
      const [r, g, b, a] = pixelFn(x, y)
      raw[o++] = r; raw[o++] = g; raw[o++] = b; raw[o++] = a
    }
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(W, 0); ihdr.writeUInt32BE(H, 4)
  ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0 // 8bit, RGBA
  const sig = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10])
  const png = Buffer.concat([sig, chunk('IHDR', ihdr), chunk('IDAT', deflateSync(raw)), chunk('IEND', Buffer.alloc(0))])
  return 'data:image/png;base64,' + png.toString('base64')
}

// ── 색 ──
const T = [0, 0, 0, 0]              // 투명
const BLACK = [0, 0, 0, 255]
const YELLOW = [255, 236, 39, 255]  // #ffec27
const RED = [255, 0, 77, 255]       // #ff004d

const cx = 7.5, cy = 7.5, r = 6.8
const inDisc = (x, y) => (x - cx) ** 2 + (y - cy) ** 2 <= r * r

// face 레이어 (두 프레임 공통): 노란 원
const faceLayer = pngDataUrl((x, y) => (inDisc(x, y) ? YELLOW : T))

// features 레이어 (프레임별 다름): 눈 + 입
function featuresLayer(frame) {
  const eyes = new Set(['5,6', '10,6'])
  const mouth = new Set()
  if (frame === 0) { // 다문 미소
    for (const x of [5, 6, 9, 10]) mouth.add(`${x},11`)
    mouth.add('7,12'); mouth.add('8,12')
  } else {           // 벌린 입
    for (let y = 10; y <= 12; y++) for (let x = 6; x <= 9; x++) mouth.add(`${x},${y}`)
  }
  return pngDataUrl((x, y) => {
    const k = `${x},${y}`
    if (eyes.has(k)) return BLACK
    if (mouth.has(k)) return frame === 0 ? BLACK : RED
    return T
  })
}

const mkLayers = (frame) => ([
  { id: `f${frame}-l0`, name: 'face', layerOrder: 0, blendMode: 'NORMAL', opacity: 1, isVisible: true, isLocked: false, color: '#ffec27', pixelData: faceLayer },
  { id: `f${frame}-l1`, name: 'features', layerOrder: 1, blendMode: 'NORMAL', opacity: 1, isVisible: true, isLocked: false, color: '#000000', pixelData: featuresLayer(frame) },
])

const ppit = {
  format: 'ppit',
  version: 1,
  canvas: { width: W, height: H, backgroundColor: '#00000000', fps: 3 },
  palette: { name: 'PICO-8 sample', colors: ['#000000', '#ffec27', '#ff004d', '#ab5236', '#1d2b53'] },
  frames: [
    { id: 'frame-0', layers: mkLayers(0) },
    { id: 'frame-1', layers: mkLayers(1) },
  ],
}

writeFileSync(new URL('./sample.ppit', import.meta.url), JSON.stringify(ppit, null, 2))
console.log('생성 완료: dev/sample.ppit  (frames=%d, %dx%d)', ppit.frames.length, W, H)
