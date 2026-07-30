import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useSearchParams } from 'react-router-dom'
import { LayerData } from '../constants/editorType'
import {createInitialCanvasData, DRAW_TOOLS, SELECT_TOOLS, SHAPE_TOOLS, VIEW_TOOLS, PALETTE_COLORS, ZOOM_LEVELS, CANVAS_PRESETS} from '../constants/editor'
import {useCanvasView} from '../hooks/editor/useCanvasView'
import EditorSaveProjectModal from '../components/EditorSaveProjectModal'
import EditorOpenProjectModal from '../components/EditorOpenProjectModal'
import { editorApi } from '../api/editorApi'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'
import {useAnimation} from '../hooks/editor/useAnimation'
import { useHistory } from '../hooks/editor/useHistory'
import { applyPalette, GIFEncoder, quantize } from 'gifenc'
import { useLayers as useLayer } from '../hooks/editor/useLayer'
import { Stage, Layer as KonvaLayer } from 'react-konva'
import Konva from 'konva'
import { useEditor } from '../hooks/editor/useEditor'
import { LayerImageRenderer } from '../components/LayerImageRender'
import { getCacheKey, getLayerImageData } from '../utils/editorUtils'
import { ColorPickerModal } from '../components/ColorPickerModal'
import { parsePpit, serializePpit } from '../lib/ppit'
import { canvasDataToPpit, ppitToCanvasData } from '../utils/ppitConvert'

type MenuItem =
  | { separator: true }
  | { label: string; shortcut?: string; icon?: string; action?: () => void; disabled?: boolean }

const initialCanvasData = createInitialCanvasData(); // 캔버스 데이터 초기화 

// ── 컴포넌트 ──────────────────────────────────────────
export default function EditorPage() {
  
  const stageRef = useRef<Konva.Stage>(null)
  const menuRef   = useRef<HTMLDivElement>(null) 
  const layerCanvasRefs = useRef<Record<string, HTMLCanvasElement>>({})
  
  const [searchParams, setSearchParams] = useSearchParams()
  const { isLoggedIn } = useAuthStore()
 
  // ── 도구 관련 상태 ──────────────────────────
  const [activeTool, setActiveTool]   = useState('pencil')
  const [fgColor, setFgColor]         = useState('#2f81f7')
  const [hexInput, setHexInput]       = useState('#2f81f7')
  const [brushSize, setBrushSize]     = useState(1)
  const [opacity, setOpacity]         = useState(100)
  const [pixelPerfect, setPixelPerfect] = useState(true)
  const [isHexModal, setIsHexModal] = useState(false)

  // ── 히스토리 훅 ──────────────────────────

  const {state, setWithHistory, undo, redo, reset} = useHistory(initialCanvasData);

  // ── View 상태 ──────────────────────────
  const {zoom, setZoomIdx} = useCanvasView();
  const [cursorPos, setCursorPos]     = useState({ x: -1, y: -1 });
  const [isScaleImage, setIsScaleImage] = useState(false);

  // ── 애니메이션 상태 및 훅 ──────────────────────────
  const[currentFrameIdx, setCurrentFrameIdx] = useState(0);

  const safeFrameIdx = Math.min(
    currentFrameIdx,
    Math.max(0, state.frames.length - 1)
  );

  const{addFrame, deleteFrame} = useAnimation({
    frames: state.frames,
    currentFrameIdx: safeFrameIdx,
    onChange: (newFrames, nextIdx) => {
      // 1. 이동할 인덱스 결정 (nextIdx가 없으면 현재 인덱스 사용)
      const targetIdx = nextIdx ?? safeFrameIdx;

      // 2. UI 상태인 currentFrameIdx를 새 인덱스로 업데이트
      setCurrentFrameIdx(targetIdx)
      
      // 3. 변경될 프레임의 첫 번째 레이어 선택
      const targetFrame = newFrames[targetIdx];
      const targetActiveLayerId = targetFrame?.layers[0]?.id || null;
      
      // 4. 히스토리 스냅샷 저장 (frames만 저장, currentFrameIdx는 제외됨)
      setWithHistory((prev) => ({
        ...prev,
        frames: newFrames,
      }));

      if(targetActiveLayerId){
        setActiveLayer(targetActiveLayerId)
      }
      
      setUnsaved(true); 
    }
  });
  const [isPlaying, setIsPlaying] = useState(false);

  // ── AI 가이드 상태 ──────────────────────────
  const[showAIGuide, setShowAIGuide] = useState(false);

  // ── 레이어 상태 및 훅 ──────────────────────────
  const [activeLayer, setActiveLayer] = useState<string | null>(
    initialCanvasData.frames[0]?.layers[0].id || null
  );
  const { addLayer, deleteLayer, toggleVisibility, layerCountersRef, reorderLayers} = useLayer(
    state, 
    setWithHistory, 
    activeLayer, 
    setActiveLayer,
  );
  // ────────────────────────────

  const [customW, setCustomW]         = useState(32)
  const [customH, setCustomH]         = useState(32)

  const [showAnim, setShowAnim]       = useState(false)
  const [unsaved, setUnsaved]         = useState(false)
  const [openMenu, setOpenMenu]       = useState<string | null>(null)
  const [showGridLines, setShowGridLines] = useState(true)

  // ── 프로젝트 저장 관련 상태 ──────────────────────────
  const [saveIsModalOpen, setSaveIsModalOpen] = useState(false)
  const [openProjectModalOpen, setOpenProjectModalOpen] = useState(false)

  const [projectTitle, setProjectTitle] = useState('Untitled Project')
  const [editingTitle, setEditingTitle] = useState(false)
  const isDrawing = useRef(false)
  const isDirty =  useRef(false); 

  const ppitInputRef = useRef<HTMLInputElement>(null)   // .ppit 불러오기 파일 입력

  const {handleSave, projectId, setProjectId, saving} = useEditor({
    stageRef,
    layerCanvasRefs,
    state,
    isLoggedIn,
    setUnsaved,
    setSearchParams
  });

  // 메뉴 외부 클릭 시 닫기
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setOpenMenu(null)
      }
    }
    if (openMenu) document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [openMenu])

  // ── 현재 프레임 및 레이어 인덱스 동기화 ────────────────
  useEffect(() => {
    if (currentFrameIdx !== safeFrameIdx) {
      setCurrentFrameIdx(safeFrameIdx);
    }
    // 현재 바라보는 프레임의 레이어 목록에 activeLayer가 없는 경우 첫 번째 레이어로 보정
    const currentFrame = state.frames[safeFrameIdx];
    if (currentFrame && currentFrame.layers.length > 0) {
      const hasActiveLayer = currentFrame.layers.some((l) => l.id === activeLayer);
      if (!hasActiveLayer) {
        setActiveLayer(currentFrame.layers[0].id);
      }
    }
  }, [state.frames.length, safeFrameIdx]);

  // ── 캔버스 그리기 로직 ──────────────
  // -------- Stage 컨텍스트 튜닝 훅 추가 -----------
  useEffect(() => {
    if (!stageRef.current) return;

    const disableSmoothing = () => {
      const stage = stageRef.current;
      if(!stage) return;

      // Konva Stage 내부에 생성된 모든 실제 Canvas 엘리먼트들을 싹 긁어옵니다.
      const layers = stage.getLayers();
      layers.forEach((konvaLayer) => {
        const canvasInstance = konvaLayer.getCanvas();
        if (canvasInstance) {
          const ctx = canvasInstance.getContext();
          if (ctx) {
            // Konva 내부 캔버스 엔진의 스무딩을 차단합니다
            ctx.imageSmoothingEnabled = false;
          }
        }
      });
      stage.batchDraw();
    }
    disableSmoothing();

    // 브라우저 렌더링 프레임 단위로 한 번 더 쐐기 박기
    const rafId = requestAnimationFrame(disableSmoothing);
    return () => cancelAnimationFrame(rafId);
  }, [activeLayer, safeFrameIdx, zoom, state.width, state.height]); // 프레임이 바뀌거나 줌이 바뀔 때 동기화
  
  //-------- 현재 픽셀의 정확한 위치를 넘겨주는 역할 -----------
  const getPixel = useCallback(() => {
    const stage = stageRef.current;
    if (!stage) return null

    // 마우스 커서의 좌표 가져옴
    const relativePos = stage.getRelativePointerPosition(); // 도화지 기준 상대 좌표 추출
    if(!relativePos) return null;
    
    // 정확한 픽셀 인덱스 좌표를 계산
    const x = Math.floor(relativePos.x);
    const y = Math.floor(relativePos.y);

    return {x, y};
  }, [])

  //-------- 프레임 + 레이어에 따른 레이어 캔버스를 넘겨주는 역할(키,값 쌍으로 저장) -----------
  const getLayerCanvas = useCallback((id: string) =>{
    const existingCanvas = layerCanvasRefs.current[id];

    // 1. 이미 메모리에 존재하고 규격(크기)이 맞다면 기존 도화지 즉시 재사용
    if (
      existingCanvas &&
      existingCanvas.width === state.width &&
      existingCanvas.height === state.height
    ) {
      return existingCanvas;
    }

    // 2. 크기가 바뀌었거나 아예 처음 만든 방이라면 메모리에 가상 도화지 새로 생성
    const nextCanvas = document.createElement('canvas')
    nextCanvas.width = state.width
    nextCanvas.height = state.height

    const ctx = nextCanvas.getContext('2d')
    if (ctx) {
      ctx.imageSmoothingEnabled = false; // 픽셀아트 흐림 방지
      
      // 크기 조절 등으로 인해 기존 도화지를 복사해야 하는 상황
      if (existingCanvas) {
        ctx.drawImage(existingCanvas, 0, 0, existingCanvas.width, existingCanvas.height);
      }
    }
    layerCanvasRefs.current[id] = nextCanvas
    return nextCanvas;
  }, [state.width, state.height])

  //-------- 캐시 캔버스 유실을 막는 역할을 함(청소부) -----------
  useEffect(() => {
    const liveCacheKeys = new Set<string>();

    state.frames.forEach((frame, fIdx) => {
      frame.layers.forEach((layer: any) => {
        liveCacheKeys.add(getCacheKey(fIdx, layer.id));
      });
    });

    Object.keys(layerCanvasRefs.current).forEach((cacheKey) => {
      if (!liveCacheKeys.has(cacheKey)) {
        delete layerCanvasRefs.current[cacheKey]
      }
    })
  }, [state.frames]);
  
  // -------- 활성 프레임의 활성 레이어에 대한 캔버스에다가 픽셀 도구 효과를 적용하는 로직 -----------
  const drawPixel = useCallback(() => {
    const stage = stageRef.current;
    const frameIdx = safeFrameIdx
    if(!stage || !activeLayer) return;
    
    const cacheKey = getCacheKey(frameIdx, activeLayer)
    const nativeCanvas = getLayerCanvas(cacheKey);
    if(!nativeCanvas) return;

    const ctx = nativeCanvas.getContext('2d');
    const pos = getPixel()
    if (!ctx || !pos) return

    const { x, y } = pos
    if (x < 0 || x >= state.width || y < 0 || y >= state.height) return

    // ─── [연필 도구] ──────────────────────────────────────────
    if (activeTool === 'pencil') {
      ctx.fillStyle = fgColor
      ctx.fillRect(x, y, brushSize, brushSize)
      ctx.globalAlpha = 1
      isDirty.current = true; // 픽셀이 변경되었음을 표시
    }
    // ─── [지우개 도구] ────────────────────────────────────────
    else if (activeTool === 'eraser') {
      ctx.clearRect(x, y, brushSize, brushSize)
      isDirty.current = true; // 픽셀이 변경되었음을 표시
    }
    // ─── [1. 페인트 통 도구 (Fill) - Flood Fill 알고리즘 최적화 버전] ──────────
    else if (activeTool === 'fill') {
      // 현재 메모리에 있는 픽셀 데이터 캡처 (Raw RGBA 버퍼)
      const imgData = ctx.getImageData(0, 0, state.width, state.height);
      // R/G/B/A 4바이트를 32비트 정수 1개 단위로 재해석 (픽셀당 1개 인덱스로 대응)
      const data32 = new Uint32Array(imgData.data.buffer);
      
      // 시작점의 색상 추출
      // y * canvasW + x -> 2차원 좌표를 1차원 메모리 주소(인덱스)로 변환
      const targetColor = data32[y * state.width + x]; 
      
      // 채우고자 하는 fgColor(Hex 문자열)를 32비트 정수(ABGR 구조)로 변환
      const r = parseInt(fgColor.slice(1, 3), 16);
      const g = parseInt(fgColor.slice(3, 5), 16);
      const b = parseInt(fgColor.slice(5, 7), 16);
      // 비트 시프트 연산(<<) 및 OR(|)로 32비트 색상값 생성, >>> 0 추가하여 Uint32 형태의 양수로 반환
      const fillColor = (255 << 24) | (b << 16) | (g << 8) | r >>> 0;
      
      if (targetColor === fillColor) {
        return;
      }
      const totalPixels = state.width * state.height;
      // 고정 크기 인덱스 큐 (최대 픽셀 수만큼 미리 메모리를 할당하여 GC 과부하 방지)
      const queue = new Int32Array(totalPixels);
      let head = 0; // 읽기 포인터 (pop 연산 시 증가)
      let tail = 0; // 쓰기 포인터 (push 연산 시 증가)

      const startIdx = y * state.width + x; // 시작 픽셀 주소
      queue[tail++] = startIdx; // 시작 주소를 큐에 push
      data32[startIdx] = fillColor; // push 하자마자 즉시 색상 변경 (중복 방문 원천 차단)

      // 큐에 처리할 픽셀이 남아있는 동안 BFS 탐색 반복
      while (head < tail) { 
        const idx = queue[head++]; // 큐의 맨 앞에서 현재 처리할 픽셀 주소를 하나 꺼내옴 (O(1) Pop)
        
        // 1차원 주소 idx를 2차원 좌표(cx, cy)로 복원하여 캔버스 경계 판단에 활용
        const cx = idx % state.width; 
        const cy = Math.floor(idx / state.width); // 소수점 버림 함수
        
        // 상/하/좌/우 이웃 검사 -> targetColor와 같은 색상을 가진 픽셀만 색칠 후 큐에 적재
        
        // 1. 좌측 이웃 검사
        if (cx > 0) { // 왼쪽 벽에 붙어있지 않다면
          const nIdx = idx - 1; // 현재 위치 기준 '좌'측 이웃 주소
          if (data32[nIdx] === targetColor) {
            data32[nIdx] = fillColor; // 즉시 색 변경 (중복 방문 방지)
            queue[tail++] = nIdx;     // 큐에 추가 (Push)
          }
        }
        
        // 2. 우측 이웃 검사
        if (cx < state.width - 1) { // 오른쪽 벽에 붙어있지 않다면
          const nIdx = idx + 1; // 현재 위치 기준 '우'측 이웃 주소
          if (data32[nIdx] === targetColor) {
            data32[nIdx] = fillColor;
            queue[tail++] = nIdx;
          }
        }
        
        // 3. 상단 이웃 검사
        if (cy > 0) { // 위쪽 벽에 붙어있지 않다면
          const nIdx = idx - state.width; // 현재 위치 기준 '상'측 이웃 주소 (한 줄 위)
          if (data32[nIdx] === targetColor) {
            data32[nIdx] = fillColor;
            queue[tail++] = nIdx;
          }
        }
        
        // 4. 하단 이웃 검사
        if (cy < state.height - 1) { // 아래쪽 벽에 붙어있지 않다면
          const nIdx = idx + state.width; // 현재 위치 기준 '하'측 이웃 주소 (한 줄 아래)
          if (data32[nIdx] === targetColor) {
            data32[nIdx] = fillColor;
            queue[tail++] = nIdx;
          }
        }
      }
      
      ctx.putImageData(imgData, 0, 0);
      isDirty.current = true; // 픽셀이 변경되었음을 표시
    }
  
    // ─── [2. 스포이트 도구 (Eyedropper)] ──────────────────────────
    else if (activeTool === 'eyedrop') {
      const imgData = ctx.getImageData(x, y, 1, 1).data;
      // 투명한 영역(알파값 0)을 찍으면 기본 검정 처리 혹은 스킵
      if (imgData[3] !== 0) {
        const r = imgData[0].toString(16).padStart(2, '0');
        const g = imgData[1].toString(16).padStart(2, '0');
        const b = imgData[2].toString(16).padStart(2, '0');
        const pickedHex = `#${r}${g}${b}`;
        
        // 앞서 만든 단일 진입점 변경 함수 호출!
        selectPaletteColor(pickedHex);
      }
      return;
    }

    // 💡 캐시 키(cacheKey)와 달리, Konva 노드는 순수 레이어 고유 ID로 등록되어 있으므로 activeLayer로 찾습니다.
    const activeLayerNode = stage.findOne(`#${activeLayer}`);
    if(activeLayerNode){
      activeLayerNode.getLayer()?.batchDraw();
    }
    setUnsaved(true)
  }, [activeTool, fgColor, brushSize, state.width, state.height, getPixel, activeLayer, getLayerCanvas, safeFrameIdx])

  const handleMouseMove = () => {
    const pos = getPixel()
    if (pos) setCursorPos(pos)
    if (isDrawing.current) drawPixel()
  }

  // --------  state.width/height 변경 시 CustomW/H 동기화 -----------
  useEffect(() => {
    setCustomW(state.width);
    setCustomH(state.height);
  }, [state.width, state.height])

  // -------- 캔버스 크기 변경 -----------
  const applyCanvasSize = (w: number, h: number) => {
    if(state.width === w && state.height === h){
      setOpenMenu(null);
      return;
    }

    setWithHistory((prev) => {
      return {
        ...prev,
        width: w,
        height: h,
      };
    })

    setUnsaved(true);
    setOpenMenu(null);
  }


  // ── 마우스 휠 스크롤을 이용한 줌 인/아웃 ──────────────
  useEffect(() => {
    const stageContainer = stageRef.current?.container();
    if (!stageContainer) return

    const handleWheelZoom = (e: WheelEvent) => {
      e.preventDefault();

      setZoomIdx((prev: number) => {
        const next = e.deltaY > 0
          ? Math.max(0, prev - 1)
          : Math.min(ZOOM_LEVELS.length - 1, prev + 1)

        return next === prev ? prev : next
      })
    }

    stageContainer.addEventListener('wheel', handleWheelZoom, { passive: false })

    return () => {
      stageContainer.removeEventListener('wheel', handleWheelZoom)
    }
  }, [setZoomIdx])

  // ── URL 파라미터로 프로젝트 불러오기 ──────────────
  useEffect(() => {
    const id = searchParams.get('projectId')
    if (!id || !isLoggedIn) return
    const numId = Number(id)
    if (isNaN(numId)) return
    // 이미 메모리에 로드된 프로젝트면 재로드 안 함 — 저장 시 setSearchParams로 URL이 바뀌어도
    // (레이어 저장 전에) 재로드가 현재 캔버스를 비우던 백지 버그 방지
    if (numId === projectId) return

    let cancelled = false
    ;(async () => {
      try {
        const res = await editorApi.getProject(numId)
        if (cancelled) return
        const proj = res.data.data

        // 레이어 그림은 저장 시 webp(fileUrl)로 올라가고 pixelData는 빈값 → fileUrl을 dataURL로 복원해야 렌더됨.
        // pixelData가 이미 있으면 그대로, 없고 fileUrl이 있으면 fetch→dataURL. R2 CORS 필요, dataURL이라 저장 시 캔버스 오염 없음.
        // 🔴 fileUrl이 있는데 복원 실패면 throw → 부분 로드 차단(빈 레이어로 저장 성공 처리 시 원본 파일을 덮어쓸 위험 방지).
        const restoredFrames: any[] = []
        if (proj.layers && proj.layers.length > 0) {
          const rawLayers = proj.layers
          const restoredPixelData: string[] = await Promise.all(
            rawLayers.map(async (sl: any, idx: number): Promise<string> => {
              if (sl.pixelData && String(sl.pixelData).trim()) return sl.pixelData
              if (!sl.fileUrl) return ''
              const r = await fetch(sl.fileUrl)
              if (!r.ok) throw new Error(`레이어 이미지 복원 실패: ${sl.layerId ?? idx}`)
              const blob = await r.blob()
              return await new Promise<string>((resolve, reject) => {
                const reader = new FileReader()
                reader.onloadend = () => typeof reader.result === 'string'
                  ? resolve(reader.result)
                  : reject(new Error(`레이어 이미지 변환 실패: ${sl.layerId ?? idx}`))
                reader.onerror = () => reject(new Error(`레이어 이미지 변환 실패: ${sl.layerId ?? idx}`))
                reader.readAsDataURL(blob)
              })
            })
          )

          let currentFrameLayers: LayerData[] = []
          let frameCounter = 0
          rawLayers.forEach((serverLayer: any, idx: number) => {
            // layerOrder가 0을 만났고 이미 모아둔 레이어가 있으면 → 이전 프레임 완성 후 쪼개기
            if (serverLayer.layerOrder === 0 && currentFrameLayers.length > 0) {
              restoredFrames.push({ id: `frame-${crypto.randomUUID().slice(0, 8)}`, name: `Frame ${frameCounter + 1}`, layers: currentFrameLayers })
              currentFrameLayers = []
              frameCounter++
            }
            currentFrameLayers.push({
              id: String(serverLayer.layerId),
              name: serverLayer.name,
              layerOrder: serverLayer.layerOrder,
              blendMode: serverLayer.blendMode || 'NORMAL',
              isLocked: serverLayer.isLocked || false,
              isVisible: serverLayer.isVisible !== false,
              opacity: serverLayer.opacity ?? 100,
              color: '#818cf8',
              pixelData: restoredPixelData[idx] || '',
            })
          })
          if (currentFrameLayers.length > 0) {
            restoredFrames.push({ id: `frame-${crypto.randomUUID().slice(0, 8)}`, name: `Frame ${frameCounter + 1}`, layers: currentFrameLayers })
          }
        }

        // 모든 레이어 복원이 끝난 뒤에만 상태 커밋 (부분 로드/덮어쓰기 방지). 중간에 다른 프로젝트로 바뀌면 취소.
        if (cancelled) return
        setProjectId(proj.projectId)
        setProjectTitle(proj.title)
        setCustomW(proj.width)
        setCustomH(proj.height)
        
        // 1. 프레임 데이터 결정 (불러온 프레임이 있으면 사용하고, 없으면 기본 프레임 생성 또는 기존 프레임 유지)
        const framesToReset = restoredFrames.length > 0 
          ? restoredFrames 
          : createInitialCanvasData().frames; // 또는 prev/기존 frames 사용
        
        reset({
          frames: framesToReset,
          width: proj.width,
          height: proj.height,
        })

        const firstLayerId = framesToReset[0]?.layers[0]?.id
        if (firstLayerId) setActiveLayer(firstLayerId)
          
        setUnsaved(false)
      } catch {
        if (!cancelled) toast.error('프로젝트를 불러오지 못했습니다.')
      }
    })()

    return () => { cancelled = true }
  }, [searchParams, isLoggedIn, projectId, reset]) // 의존성 배열 보완
  
  //  ── 저장 모달 함수 ──────────────────────────────────
  const openSaveModal = useCallback(() => {
    if (!isLoggedIn) {
      toast.error('로그인이 필요합니다.')
      return
    }
    setSaveIsModalOpen(true)
  }, [isLoggedIn])
  
  // ── Ctrl+S, Ctrl+Y, Ctrl+Z 단축키 ────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (isMod && key === 's') {
        e.preventDefault();
        openSaveModal();
      }
      else if(isMod && !e.shiftKey && key === 'z'){
        e.preventDefault();
        undo();
      }
      else if(isMod && (key === 'y' || (e.shiftKey && key === 'z'))){
        e.preventDefault();
        redo();
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  }, [openSaveModal, undo, redo])


  // ── PNG/GIF 내보내기 ──────────────────────────────────
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = filename
    link.click()

    URL.revokeObjectURL(url)
  }

  // ── .ppit 내보내기/불러오기 ───────────────────────────
  const safeFileName = (title: string) =>
    (title || 'artwork').trim().replace(/[\\/:*?"<>|]+/g, '_') || 'artwork'

  const handleExportPpit = useCallback(() => {
    try {
      const ppit = canvasDataToPpit(state, PALETTE_COLORS)
      const blob = new Blob([serializePpit(ppit)], { type: 'application/json' })
      downloadBlob(blob, `${safeFileName(projectTitle)}.ppit`)
    } catch {
      toast.error('.ppit 내보내기에 실패했습니다.')
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [state, projectTitle])

  // .ppit 텍스트를 에디터 상태로 로드 (파일/URL 공통)
  const loadPpitText = useCallback((text: string, title: string) => {
    const ppit = parsePpit(text)
    const cd = ppitToCanvasData(ppit)

    setCurrentFrameIdx(0);
    setCustomW(cd.width); setCustomH(cd.height)
    reset(cd)
    setActiveLayer(cd.frames[0]?.layers[0]?.id ?? null)
    setProjectId(null)   // 불러온 .ppit은 새 작업(저장된 프로젝트 아님)
    setProjectTitle(title || 'Untitled Project')
    setUnsaved(true)
    // 새 작업이므로 URL의 projectId 제거 (새로고침 시 옛 서버 프로젝트 재로드 방지)
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      p.delete('projectId')
      return p
    }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reset, setActiveLayer, setProjectId, setSearchParams])

  const handleImportPpit = useCallback(async (file: File) => {
    // 미저장 변경 확인 (New Project와 동일)
    if (unsaved && !window.confirm('저장하지 않은 변경사항이 있습니다. 불러오면 현재 작업이 사라집니다. 계속할까요?')) return
    try {
      loadPpitText(await file.text(), file.name.replace(/\.(ppit|json)$/i, ''))
      toast.success('.ppit을 불러왔습니다.')
    } catch (e) {
      toast.error(e instanceof Error ? e.message : '.ppit을 불러오지 못했습니다.')
    }
  }, [loadPpitText, unsaved])

  // 저장된 프로젝트 열기 (모달에서 선택) → URL projectId로 로드 effect 트리거
  const handleOpenProject = useCallback((pid: number) => {
    if (pid !== projectId &&
        unsaved && !window.confirm('저장하지 않은 변경사항이 있습니다. 불러오면 현재 작업이 사라집니다. 계속할까요?')) {
      return
    }
    setOpenProjectModalOpen(false)
    setSearchParams({ projectId: String(pid) }, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId, unsaved, setSearchParams])

  // ── 갤러리에서 진입(편집/리믹스): ?import=<.ppit URL> 자동 로드 ──
  useEffect(() => {
    const url = searchParams.get('import')
    if (!url) return
    let cancelled = false
    ;(async () => {
      try {
        const res = await fetch(url)
        if (!res.ok) throw new Error('fetch failed')
        const text = await res.text()
        if (cancelled) return
        loadPpitText(text, searchParams.get('remixOf') ? '리믹스 작업' : '불러온 작업')
        toast.success('작품을 에디터로 불러왔습니다.')
      } catch {
        if (!cancelled) toast.error('작품을 불러오지 못했습니다.')
      } finally {
        // import 파라미터 제거(새로고침 시 재로드 방지). remixOf는 추후 출처 추적용으로 유지
        if (!cancelled) {
          setSearchParams(prev => {
            const p = new URLSearchParams(prev)
            p.delete('import')
            return p
          }, { replace: true })
        }
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [searchParams, loadPpitText])

  
  const handleExportImage = useCallback(async() => {
    const stage = stageRef.current
    if (!stage) return

    const safeTitle = projectTitle.replace(/\s+/g, '_')

    // 단일 프레임 처리
    if(state.frames.length <= 1){
      const currentFullImage = stage.toDataURL({pixelRatio: 1}); // 원본 크기 1:1 유지
      const link = document.createElement('a');
      link.download = `${safeTitle}.png`;
      link.href = currentFullImage;
      link.click();
      return;
    }
    
    // 멀티 프레임 일 때
    const gif = GIFEncoder()

    // 모든 프레임을 순서대로 필름 인코딩 루프 돌리기
    for(let fIdx = 0; fIdx < state.frames.length; fIdx++){
      const currentFrame = state.frames[fIdx];
      if (!currentFrame) continue;
      
      // 가상 도화지(가상 캔버스) 생성 및 안전장치
      const frameCanvas = document.createElement('canvas')
      frameCanvas.width = state.width
      frameCanvas.height = state.height
      const fCtx = frameCanvas.getContext('2d')
      
      if(!fCtx) continue // GPU 메모리 부족 등 예외 상황 시 다음 프레임으로 스킵
      
      fCtx.imageSmoothingEnabled = false
      fCtx.clearRect(0, 0, state.width, state.height)

      const currentFrameLayers = currentFrame.layers ?? [];
      
      for(const layer of currentFrameLayers){
        if(!layer.isVisible) continue // 보이지 않는 레이어는 합성에서 제외
        
        const cacheKey = getCacheKey(fIdx, layer.id);
        const cachedCanvas = layerCanvasRefs.current[cacheKey];

        fCtx.globalAlpha = (layer.opacity ?? 100) / 100;

        if(cachedCanvas){
          fCtx.drawImage(cachedCanvas, 0, 0, state.width, state.height);
        }else if(layer.pixelData && layer.pixelData.trim() !== ''){
          // 만약 메모리 캐시는 날아갔지만 백업용 pixelData 문자열이 살아있다면 이미지 객체로 복구
          const img = new Image();
          await new Promise<void>((resolve) => {
            img.onload = () => {
              fCtx.drawImage(img, 0, 0, state.width, state.height);
              resolve();
            };
            img.onerror = () => resolve(); // 에러 나더라도 막히지 않게 세이프 가드
            img.src = layer.pixelData;
          });
        }
        fCtx.globalAlpha = 1.0; // 투명도 원상복구
      }
      // 겹치기가 끝난 최종 프레임 캔버스에서 화소 데이터 추출
      const imageData = fCtx.getImageData(0, 0, state.width, state.height)
      
      // 컬러 양자화 알고리즘 구동 (GIF 규격 압축)
      const palette = quantize(imageData.data, 256)
      const indexed = applyPalette(imageData.data, palette)

      gif.writeFrame(indexed, state.width, state.height, {
        palette,
        delay: 100, // 나중에 타임라인 속도 조절(fps) 상태가 있다면 연동 가능
        repeat: 0,
      })
    }

    gif.finish()

    const blob = new Blob([gif.bytes()], { type: 'image/gif' })
    downloadBlob(blob, `${safeTitle}.gif`)
    
  }, [projectTitle, state.frames, safeFrameIdx, state.width, state.height])

  // ── 새 프로젝트 ───────────────────────────────────
  const handleNewProject = useCallback(() => {
    if (unsaved && !confirm('저장되지 않은 변경사항이 있습니다. 계속하시겠습니까?')) return
    
    const defaultLayerId = `layer-${crypto.randomUUID().slice(0, 8)}`;
    
    const defaultLayer: LayerData = {
      id: defaultLayerId, // ID는 문자열로 관리하는 것이 확장성에 좋습니다.
      name: 'Background',
      layerOrder: 0,
      blendMode: 'NORMAL',
      isLocked: false,
      isVisible: true,
      opacity: 100,
      color: '#818cf8',
      pixelData: ''
    }
    // 히스토리 초기화
    reset({
      frames: [
        {
          id: `frame-${crypto.randomUUID().slice(0, 8)}`,
          layers: [defaultLayer] // 진짜 원본 프레임 내부에 레이어 안착
        }
      ],
      width: state.width,
      height: state.height
    });

    setActiveLayer(defaultLayerId);
    
    if (layerCountersRef && layerCountersRef.current) {
      layerCountersRef.current = { 0: 2 }; 
    }

    // 메모리 상에 남아있던 이전 프로젝트의 캔버스 이미지 버퍼 캐시를 전부 청소함
    if (layerCanvasRefs && layerCanvasRefs.current) {
      layerCanvasRefs.current = {};
    }

    // 기타 메타데이터 및 URL 초기화
    setProjectId(null)
    setProjectTitle('Untitled Project')
    setUnsaved(false)

    // URL에 남은 projectId 쿼리 파라미터 제거
    setSearchParams({}, { replace: true })
  }, [unsaved, state.width, state.height, setSearchParams, setActiveLayer, reset])

  // ── RGB ─────────────────
 
  // HEX 입력 → 색상 반영
  const applyHex = () => {
    if (/^#[0-9a-fA-F]{6}$/.test(hexInput)) setFgColor(hexInput)
  }

 // RGB 파싱
  const hexToRgb = (hex: string) => ({
    r: parseInt(hex.slice(1,3),16),
    g: parseInt(hex.slice(3,5),16),
    b: parseInt(hex.slice(5,7),16),
  })
  const rgb = hexToRgb(fgColor)

  // 툴 버튼 공통 스타일
  const toolBtn = (id: string) => ({
    background: activeTool === id ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
    color: activeTool === id ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
  })

  // 팔레트 컬러 칩을 클릭했을 때 색상을 반영하는 함수
  const selectPaletteColor = (color: string) => {
    setFgColor(color);    // 1. 실제로 그려질 메인 전경색 변경
    setHexInput(color);   // 2. 눈에 보이는 HEX 텍스트 입력창 글자도 동기화
  };
  
  // ── [슬라이더 연동을 위해 새로 추가할 코드] ─────────────────
  
  // 1. 슬라이더의 RGB 숫자를 다시 #ffffff 형태의 HEX 문자로 바꿔주는 함수
  const rgbToHex = (r: number, g: number, b: number) => {
    const toHex = (c: number) => {
      const hex = Math.max(0, Math.min(255, c)).toString(16);
      return hex.length === 1 ? "0" + hex : hex; // 한 자리 수면 앞에 0 채우기 (예: f -> 0f)
    };
    return `#${toHex(r)}${toHex(g)}${toHex(b)}`;
  };

  // 2. R, G, B 슬라이더를 밀 때 호출될 핵심 핸들러 함수
  const handleRgbChange = (channel: 'r' | 'g' | 'b', value: number) => {
    // 슬라이더를 민 채널만 value로 바꾸고, 나머지는 기존 rgb 값 유지
    const nextHex = rgbToHex(
      channel === 'r' ? value : rgb.r,
      channel === 'g' ? value : rgb.g,
      channel === 'b' ? value : rgb.b
    );
    
    setFgColor(nextHex);   // 에디터 메인 색상 변경 (도화지에 그려질 색)
    setHexInput(nextHex);  // 눈에 보이는 HEX 입력창 글자도 동기화
  };

  // ── 애니메이션 ───────────────────────────────────
  // 재생 로직
  useEffect(() => {
    if(!isPlaying) return;

    const totalFrames = state.frames.length;
    if(totalFrames <= 1) return;

    const interval = setInterval(() => {
      setCurrentFrameIdx((prevIdx) => (prevIdx + 1) % totalFrames);
    }, 100)

    return () => clearInterval(interval);
  }, [isPlaying, state.frames.length]);

  /**
   * 현재 캔버스의 내용을 이미지 데이터(Base64)로 변환하여 해당 프레임에 저장합니다.
   * setWithHistory -> useHistory 기록용
  */
  const commitLayerChanges = useCallback(() => {
    const stage = stageRef.current;
    if(!stage || !activeLayer) return;

    const capturedFrameIdx = safeFrameIdx;
    if(!state.frames[capturedFrameIdx]) return;
    
    // [핵심 수정]: 마우스를 뗄 때도 현재 지목된 고유한 프레임_레이어 상자에서 그림을 도려냅니다.
    const cacheKey = getCacheKey(capturedFrameIdx, activeLayer);
    const cachedCanvas = layerCanvasRefs.current[cacheKey];
    if (!cachedCanvas) return;

    // 최적화 수정: 무겁고 잔상이 남을 수 있는 Node.toCanvas() 대신 
    // 우리가 실시간으로 낙서하던 진짜 가상 오프스크린 캔버스 캐시에서 직접 순수 PNG 소스를 주출합니다.
    const layerImageData = getLayerImageData(cachedCanvas);

    setWithHistory((prev) => {
      // 프레임 데이터
      const updatedFrames = prev.frames.map((frame, fIdx) =>{
        if(fIdx !== capturedFrameIdx) return frame;
        // 프레임의 레이어 데이터
        const updateLayers = frame.layers.map((layer) => {
          if(layer.id !== activeLayer) return layer;

          return {...layer, pixelData: layerImageData};
        });
        return {...frame, layers: updateLayers}
      });
     
      return {
        ...prev,
        frames: updatedFrames,
        width: state.width,
        height: state.height
      };
    });
    setUnsaved(false);

  }, [safeFrameIdx, activeLayer, setWithHistory, state.width, state.height]);

  
  /* 프레임 선택 시 실행되는 함수 */
  const handleSelectFrame = (nextIndex: number) => {
    const canvas = stageRef.current;
    if (!canvas || !activeLayer) return;

    const nextFrame = state.frames[nextIndex];
    const nextActiveLayerId = nextFrame?.layers[0]?.id || null;

    if (unsaved) {
        const frameIdx = safeFrameIdx;
        const cacheKey = getCacheKey(frameIdx, activeLayer);
        const cachedCanvas = layerCanvasRefs.current[cacheKey];
        if(cachedCanvas){
          const layerImageData = getLayerImageData(cachedCanvas);
          
          setWithHistory((prev) => ({
            ...prev,
            frames: prev.frames.map((f, i) =>
              i === frameIdx
                ? { ...f, layers: f.layers.map(l => l.id === activeLayer ? {...l, pixelData: layerImageData}: l) }
                : f
            ),
          }));

          setUnsaved(false);
        } 
    } 
    setCurrentFrameIdx(nextIndex);
    setActiveLayer(nextActiveLayerId); // 붓의 타깃 동기화
    
  }
  // ── 레이어 ───────────────────────────────────
  const selectLayer = useCallback((frameIdx: number, layerIdToSelect: string) => {
    const stage = stageRef.current;
    if (!stage || !activeLayer) {
        // 만약 기존에 선택된 레이어가 없었다면 예외 처리 없이 즉시 다이렉트 이동
        setActiveLayer(layerIdToSelect);
        return;
    }

    if(unsaved){
      // 현재 작업 중이던 고유한 프레임_레이어 전용 캔버스 캐시를 타깃으로 잡습니다.
      const cacheKey = getCacheKey(frameIdx, activeLayer);
      const cachedCanvas = layerCanvasRefs.current[cacheKey];

     if (cachedCanvas) {
        const layerImageData = getLayerImageData(cachedCanvas)
        setWithHistory((prev) => {
          const updatedFrames = prev.frames.map((frame, fIdx) => {
            if (fIdx !== frameIdx) return frame;

            // 현재 프레임 내부에서 작업 중이던 레이어의 pixelData를 최신화
            const updatedLayers = frame.layers.map((layer) => 
                layer.id === activeLayer ? { ...layer, pixelData: layerImageData } : layer
            );

            return { ...frame, layers: updatedLayers };
          });

          return {
              ...prev,
              frames: updatedFrames,
          };
        });
      }
      setActiveLayer(layerIdToSelect);
      setUnsaved(false); // 저장 완료 상태로 플래그 클린업
    }
    else{
      setActiveLayer(layerIdToSelect);
    }

  }, [activeLayer, unsaved, setWithHistory, setActiveLayer, stageRef])
  
  // 1. 컴포넌트 내부 상단에 배열을 변수로 분리 (as const 적용)
  const layerButtons = [
    ['add', '레이어 추가', addLayer],
    ['delete', '레이어 삭제', deleteLayer]
  ] as const;

  // -------- 레이어 순서 변경 -----------
  const LAYER_DND_MIME = "application/x-pixelhub-layer-index";
  
  // 순서가 뒤집힌 배열을 다루기 위해 실제 원본 인덱스를 포함한 객체 배열을 만듭니다.
  const reversedLayersWithIdx = useMemo(() => { // UI용 역순 배열을 useMemo로 감싸서 최신 상태와 동기화
    return (state.frames[safeFrameIdx]?.layers ?? [])
      .map((layer, index) => ({ layer, originalIndex: index }))
      .reverse();
  }, [state.frames, safeFrameIdx]);

  // 드래그하는 레이어의 '원본 인덱스'를 저장합니다.
  // 레이어 드래그 시작
  const handleDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(LAYER_DND_MIME, String(index)); // 내부 레이어 DnD 전용 값
  }

  // 레이어를 내려놓음
  const handleDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    const rawSourceIndex = e.dataTransfer.getData(LAYER_DND_MIME);
    if (!/^\d+$/.test(rawSourceIndex)) return;

    const sourceIndex = Number(rawSourceIndex);
    const layerCount = state.frames[safeFrameIdx]?.layers.length ?? 0;
    
    if (sourceIndex >= layerCount || targetIndex < 0 || targetIndex >= layerCount) return;

    if(sourceIndex !== targetIndex){
      reorderLayers(safeFrameIdx, sourceIndex, targetIndex)
    }
  }
  // drop 이벤트를 허용하기 위해 기본 동작을 막습니다.
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); 
  };

  // ── 메뉴 정의 (actions can reference state) ──
  const MENU_DEFS: { id: string; label: string; items: MenuItem[] }[] = [
    {
      id: 'file', label: 'File',
      items: [
        { label: 'New Project',        icon: 'add',           shortcut: 'Ctrl+N', action: () => { handleNewProject(); setOpenMenu(null) } },
        { label: 'Open Project…',     icon: 'folder',        action: () => { setOpenProjectModalOpen(true); setOpenMenu(null) } },
        { label: 'Open .ppit…',       icon: 'folder_open',   action: () => { ppitInputRef.current?.click(); setOpenMenu(null) } },
        { separator: true },
        { label: 'Save',               icon: 'save',          shortcut: 'Ctrl+S', action: () => { openSaveModal(); setOpenMenu(null) } },
        //{ label: 'Save As…',          icon: 'save_as',       shortcut: 'Ctrl+Shift+S' },
        { label: 'Browser Save',       icon: 'open_in_browser', shortcut: 'Ctrl + Shift + S'},
        { separator: true },
        { label: 'Export Image',      icon: 'image',         action: () => { handleExportImage(); setOpenMenu(null) } },
        { label: 'Export Spritesheet',      icon: 'grid_on' },
        { label: 'Download .ppit',          icon: 'download', action: () => { handleExportPpit(); setOpenMenu(null) } },
        { separator: true },
        { label: 'Back to Main',       icon: 'arrow_back', action: () => { window.location.href = '/' } },
      ],
    },
    {
      id: 'edit', label: 'Edit',
      items: [
        { label: 'Undo',       icon: 'undo',        shortcut: 'Ctrl+Z', action: () => {undo(); setOpenMenu(null)}},
        { label: 'Redo',       icon: 'redo',        shortcut: 'Ctrl+Y', action: () => {redo(); setOpenMenu(null)}},
        { separator: true },
        { label: 'Cut',        icon: 'content_cut',  shortcut: 'Ctrl+X' },
        { label: 'Copy',       icon: 'content_copy', shortcut: 'Ctrl+C' },
        { label: 'Paste',      icon: 'content_paste',shortcut: 'Ctrl+V' },
        { label: 'RESIZE',     icon: 'crop', shortcut: 'Ctrl + Alt + C'},
        { separator: true },
        { label: 'Select All', icon: 'select_all',   shortcut: 'Ctrl+A' },
        { label: 'Deselect',   icon: 'deselect',     shortcut: 'Ctrl+D' },
      ],
    },
    {
      id: 'image', label: 'Image',
      items: [
        /*
        { label: 'Canvas Size…',     icon: 'crop',      action: () => {} },
        ...CANVAS_PRESETS.map(p => ({
          label: p,
          action: () => {
            const [w, h] = p.split('×').map(Number)
            applyCanvasSize(w, h)
          },
        })),*/
        { separator: true },
        { label: 'Flip Horizontal',  icon: 'flip' },
        { label: 'Flip Vertical',    icon: 'flip', },
        { label: 'Rotate 90° CW',    icon: 'rotate_right' },
      ],
    },
    {
      id: 'view', label: 'View',
      items: [
        { label: 'Fit Screen', icon: 'fit_screen',              action: () => { setZoomIdx(6); setOpenMenu(null) } },
        { label: '100%',       icon: 'crop_free',               action: () => { setZoomIdx(ZOOM_LEVELS.indexOf(1) >= 0 ? ZOOM_LEVELS.indexOf(1) : 0); setOpenMenu(null) } },
        { separator: true },
        { label: showGridLines ? 'Hide Grid' : 'Show Grid', icon: 'grid_on', action: () => { setShowGridLines(v => !v); setOpenMenu(null) } },
      ],
    },
    {
      id: 'layer', label: 'Layer',
      items: [
        { label: 'Add Layer',    icon: 'add' },
        { label: 'Delete Layer', icon: 'delete' },
        { label: 'Duplicate',    icon: 'copy_all' },
        { separator: true },
        { label: 'Move Up',      icon: 'arrow_upward' },
        { label: 'Move Down',    icon: 'arrow_downward' },
        { separator: true },
        { label: 'Merge Visible',icon: 'merge' },
        { label: 'Flatten',      icon: 'layers_clear' },
      ],
    },
    {
      id: 'AI Assistant', label: 'AI Assistant',
      items:[
        {label: 'AI Guide', icon: 'auto_awesome', action: () => setShowAIGuide(!showAIGuide)},
      ],
    },
  ]

  return (
    // 에디터는 뷰포트 전체 사용 (MainLayout의 pt-14 무시)
    <div className="fixed inset-0 top-0 flex flex-col" style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)', zIndex: 60 }}>
      <EditorSaveProjectModal
        isOpen={saveIsModalOpen}
        onClose={() => setSaveIsModalOpen(false)}
        onSave={handleSave}
        initialTitle={projectTitle}
      />

      <EditorOpenProjectModal
        isOpen={openProjectModalOpen}
        onClose={() => setOpenProjectModalOpen(false)}
        onSelect={handleOpenProject}
      />

      {/* .ppit 불러오기 (Open .ppit…) */}
      <input
        ref={ppitInputRef}
        type="file"
        accept=".ppit,.json,application/json"
        className="hidden"
        onChange={(e) => {
          const f = e.target.files?.[0]
          if (f) handleImportPpit(f)
          e.target.value = ''   // 같은 파일 재선택 허용
        }}
      />

      {/* ── TOP BAR (Photoshop 스타일 메뉴 툴바) ─────── */}
      <header className="h-10 flex items-center flex-shrink-0 border-b select-none"
        style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>

        {/* 좌: 로고 + 메뉴바 */}
        <div ref={menuRef} className="flex items-center h-full">
          {/* 로고 */}
          <a href="/" className="flex items-center gap-1.5 font-bold text-sm px-4 h-full hover:bg-surface-container transition-colors"
            style={{ color: 'var(--color-primary)' }}>
            <span className="material-symbols-outlined text-base">grid_view</span>
            PixelHub
          </a>

          <div className="w-px h-5 mx-1" style={{ background: 'var(--color-surface-container-highest)' }} />

          {/* 메뉴 항목들 */}
          {MENU_DEFS.map(menu => (
            <div key={menu.id} className="relative h-full flex items-center">
              <button
                onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
                className="px-3 h-full text-sm transition-colors"
                style={{
                  color: openMenu === menu.id ? 'var(--color-on-surface)' : 'var(--color-on-surface)',
                  background: openMenu === menu.id ? 'var(--color-surface-container)' : 'transparent',
                }}>
                {menu.label}
              </button>

              {openMenu === menu.id && (
                <div className="absolute top-full left-0 rounded-b-lg border shadow-2xl py-1 z-50 min-w-[220px]"
                  style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)', borderTopColor: 'transparent' }}>
                  {menu.items.map((item, idx) => {
                    if ('separator' in item) {
                      return <div key={idx} className="my-1 border-t" style={{ borderColor: 'var(--color-outline)' }} />
                    }
                    return (
                      <button key={idx}
                        onClick={item.action ?? (() => setOpenMenu(null))}
                        disabled={item.disabled}
                        className="w-full flex items-center gap-2.5 px-4 py-1.5 text-sm text-left transition-colors hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-default">
                        {item.icon && (
                          <span className="material-symbols-outlined text-sm w-4 flex-shrink-0"
                            style={{ color: 'var(--color-on-surface-variant)' }}>{item.icon}</span>
                        )}
                        <span className="flex-1" style={{ color: 'var(--color-on-surface)' }}>{item.label}</span>
                        {item.shortcut && (
                          <span className="text-xs ml-4" style={{ color: 'var(--color-on-surface-variant)' }}>{item.shortcut}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 우: 파일명 + 저장 */}
        <div className="ml-auto flex items-center gap-2 pr-3">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>description</span>
            {editingTitle ? (
              <input
                autoFocus
                type="text"
                value={projectTitle}
                onChange={e => setProjectTitle(e.target.value)}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingTitle(false) }}
                className="text-sm font-bold rounded px-1 outline-none"
                style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-primary)', color: 'var(--color-on-surface)', width: 160 }}
              />
            ) : (
              <span
                className="text-sm font-bold cursor-pointer hover:text-white transition-colors"
                title="클릭하여 제목 수정"
                onClick={() => setEditingTitle(true)}
              >{projectTitle}</span>
            )}
            {unsaved && <span className="w-1.5 h-1.5 rounded-full bg-amber-400" title="미저장 변경사항" />}
          </div>
          <div className="w-px h-5 mx-1" style={{ background: 'var(--color-surface-container-highest)' }} />
          <button
            onClick={openSaveModal}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1 text-sm font-bold rounded-lg transition-all hover:bg-surface-container-low disabled:opacity-50"
            style={{ color: saving ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }}>
            <span className="material-symbols-outlined text-base">{saving ? 'hourglass_empty' : 'save'}</span>
            {saving ? 'Saving…' : 'Save'}
          </button>
        </div>
      </header>

      {/* ── EDITOR BODY ──────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── 좌측 툴바 ── */}
        <aside className="flex flex-col items-center py-3 gap-1 flex-shrink-0 border-r"
          style={{ width: 84, background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>

          {/* 그리기 도구 */}
          <div className="flex flex-col items-center gap-1 w-full px-2 pb-3 mb-1 border-b" style={{ borderColor: 'var(--color-outline)' }}>
            {DRAW_TOOLS.map(t => (
              <button key={t.id} title={t.label} onClick={() => setActiveTool(t.id)}
                className="w-14 h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer"
                style={toolBtn(t.id)}>
                <span className="material-symbols-outlined text-2xl">{t.icon}</span>
              </button>
            ))}
          </div>

          {/* 선택 도구 */}
          <div className="flex flex-col items-center gap-1 w-full px-2 pb-3 mb-1 border-b" style={{ borderColor: 'var(--color-outline)' }}>
            {SELECT_TOOLS.map(t => (
              <button key={t.id} title={t.label} onClick={() => setActiveTool(t.id)}
                className="w-14 h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer"
                style={toolBtn(t.id)}>
                <span className="material-symbols-outlined text-2xl">{t.icon}</span>
              </button>
            ))}
          </div>

          {/* 도형 도구 */}
          <div className="flex flex-col items-center gap-1 w-full px-2 pb-3 mb-1 border-b" style={{ borderColor: 'var(--color-outline)' }}>
            {SHAPE_TOOLS.map(t => (
              <button key={t.id} title={t.label} onClick={() => setActiveTool(t.id)}
                className="w-14 h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer"
                style={toolBtn(t.id)}>
                <span className="material-symbols-outlined text-2xl">{t.icon}</span>
              </button>
            ))}
          </div>

          {/* 뷰 도구 (하단 고정) */}
          <div className="flex flex-col items-center gap-1 w-full px-2 mt-auto">
            {VIEW_TOOLS.map(t => (
              <button key={t.id} title={t.label} onClick={() => setActiveTool(t.id)}
                className="w-14 h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer"
                style={toolBtn(t.id)}>
                <span className="material-symbols-outlined text-2xl">{t.icon}</span>
              </button>
            ))}
          </div>
        </aside>

        {/* ── 캔버스 영역 ─────────────────────────────── */}
        {/* 바깥 배경: 캔버스보다 약간 진한 중간 회색 (체커보드) */}
        <main className="flex-1 flex items-center justify-center overflow-hidden relative"
          style={{
            backgroundColor: '#767676',
            backgroundImage: [
              'linear-gradient(45deg,#848484 25%,transparent 25%)',
              'linear-gradient(-45deg,#848484 25%,transparent 25%)',
              'linear-gradient(45deg,transparent 75%,#848484 75%)',
              'linear-gradient(-45deg,transparent 75%,#848484 75%)',
            ].join(','),
            backgroundSize: '16px 16px',
            backgroundPosition: '0 0,0 8px,8px -8px,-8px 0',
            
          }}>

          {/* 캔버스 래퍼 — backgroundColor로 연회색 보장 */}
          <div className="relative shadow-2xl"
              style={{ width: state.width * zoom, 
              height: state.height * zoom, 
              backgroundColor: '#e8e8e8' ,
              imageRendering: 'pixelated'
            }}
          >
            {/* 픽셀 그리드 오버레이 */}
            {showGridLines && zoom >= 8 && (
              <div className="absolute inset-0 pointer-events-none z-20"
                style={{
                  backgroundImage: 'linear-gradient(rgba(80,80,80,0.25) 1px,transparent 1px),linear-gradient(90deg,rgba(80,80,80,0.25) 1px,transparent 1px)',
                  backgroundSize: `${zoom}px ${zoom}px`,
                }} />
            )}
            <Stage
              ref={stageRef}
              width={state.width * zoom}
              height={state.height * zoom}
              scaleX={zoom}
              scaleY={zoom}
              pixelRatio={1}
              style={{imageRendering: 'pixelated'}}
              onMouseDown={() => { isDrawing.current = true; drawPixel() }}
              onMouseMove={handleMouseMove}
              onMouseUp={() => {
                isDrawing.current = false
                // 실제로 변경이 발생했을 때만 커밋 호출
                if(isDirty.current){
                  commitLayerChanges();
                  isDirty.current = false;
                }
               }}
              onMouseLeave={() => { 
                if(isDrawing.current) commitLayerChanges();
                isDrawing.current = false;
                setCursorPos({ x: -1, y: -1 }) 
              }}
            >
              {(state.frames[safeFrameIdx]?.layers ?? [])
                .sort((a, b) => a.layerOrder - b.layerOrder)
                .filter((layer) => layer.isVisible)
                .map((layer) => (
                  <KonvaLayer key={layer.id} id={layer.id} opacity={layer.opacity / 100}>
                    
                    {/* 💡 복잡한 캔버스 생성 및 복원 로직은 이 블랙박스 컴포넌트가 알아서 수행합니다! */}
                    <LayerImageRenderer 
                      layerId={layer.id}
                      pixelData={layer.pixelData}
                      canvasW={state.width}
                      canvasH={state.height}
                      currentFrameIdx={safeFrameIdx}
                      layerCanvasRefs={layerCanvasRefs}
                      isScaleImage = {isScaleImage}
                    />
                  </KonvaLayer>
              ))}
            </Stage>
          </div>

          {/* 줌 컨트롤 (하단 중앙 플로팅) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-xl px-3 py-1.5 shadow-lg border"
            style={{ background: 'var(--color-surface-container)', borderColor: 'var(--color-outline)' }}>
            <button onClick={() => setZoomIdx(i => Math.max(0, i-1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-surface-container-high"
              style={{ color: 'var(--color-on-surface-variant)' }}>
              <span className="material-symbols-outlined text-sm">remove</span>
            </button>
            <span className="text-xs font-bold w-12 text-center">x{zoom}</span>
            <button onClick={() => setZoomIdx(i => Math.min(ZOOM_LEVELS.length-1, i+1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-surface-container-high"
              style={{ color: 'var(--color-on-surface-variant)' }}>
              <span className="material-symbols-outlined text-sm">add</span>
            </button>
          </div>

          {/* 커서 위치 (우하단 플로팅) */}
          <div className="absolute bottom-4 right-4 rounded-lg px-3 py-1.5 shadow border text-xs font-bold"
            style={{ background: 'rgba(33,38,45,0.9)', borderColor: 'var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
            {cursorPos.x >= 0 ? `x: ${cursorPos.x}  y: ${cursorPos.y}` : 'x: —  y: —'}
          </div>
        </main>

         {/* ── 애니메이션 패널 ─────────────────────────────── */}
        <div className="flex flex-col flex-shrink-0 border-l"
          style={{ width: showAnim ? 160 : 36, background: 'var(--color-surface)', borderColor: 'var(--color-outline)', transition: 'width 0.2s' }}>
          {/* 토글 버튼 */}
          <button onClick={() => setShowAnim(v => !v)}
            className="w-9 h-9 flex items-center justify-center flex-shrink-0 transition-colors hover:bg-surface-container"
            style={{ color: showAnim ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }}
            title="Animation">
            <span className="material-symbols-outlined text-xl">animation</span>
          </button>

          {showAnim && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className='px-3 py-2 text-xs font-bold uppercase tracking-widest border-b flex items-center justify-between'
                style={{ color: 'var(--color-on-surface-variant)', borderColor: 'var(--color-outline)' }} > 
                <span>Anim</span>
                <span className='text-[10px]'>{state.frames.length} frame{state.frames.length > 1 ? 's' : ''}</span>  
              </div>

              {/* 프레임 목록 */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {state.frames.map((frame, index) => {
                    const isActive = safeFrameIdx === index;
                    return(
                      <div
                        key = {frame.id}
                        onClick={() => handleSelectFrame(index)} // 프레임 선택 기능
                        className='relative group rounded-lg border-2 p-1 cursor-pointer'
                        style={{
                          borderColor: isActive ? 'var(--color-primary)' : 'var(--color-outline)',
                          background: isActive ? 'var(--color-surface-container-low)' : 'transparent'
                        }}>

                        <button onClick={(e) => {
                          e.stopPropagation(); // 클릭 이벤트가 부모로 퍼지는 것 방지
                          deleteFrame(index);
                        }}
                          className='absolute top-1 right-1 z-10 w-5 h-5 bg-red-500/80 hover:bg-red-600 text-white rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity'
                          title='Delete Frame'>
                          <span className='material-symbols-outlined text-[14px]'>close</span>
                        </button>

                        {/* 미리보기 영역 (Canvas thumbnail  등을 넣을 수 있음)*/}
                        <div className="aspect-square checkerboard rounded overflow-hidden flex items-center justify-center relative">
                          {(() => {
                            // 레이어 탐색, 보이고 pixelData가 존재하는 레이어 중 첫 번째 레이어를 타깃으로 잡음
                            const layerPreviews = (frame.layers ?? [])
                              .filter((layer) => layer.isVisible) // 보이는 레이어만 필터링
                              .map((layer) => {
                                let src: string | null = null;
                                if(layer.pixelData){
                                  try{
                                    const frameImages = layer.pixelData;
                                    if(frameImages) src = frameImages;
                                  } catch (e){
                                    console.error("레이어 썸네일 파싱 에러", e);
                                  }
                                }
                                return {id: layer.id, src, opacity: layer.opacity}
                              });
                              // 만약 모든 레이어에 아무런 그림이 없다면 Empty 표시
                              const hasAnyImage = layerPreviews.some((lp) => lp.src);
                              if(!hasAnyImage){
                                return <span className="text-[10px] text-gray-500 z-10">Empty</span>; 
                              }

                              // 수집된 레이어들을 CSS 절대 좌표(absolute)를 이용해 아래서부터 위로 차곡차곡 겹쳐서 렌더링
                              return(
                                <div className='absolute inset-0 w-full h-full pointer-events-none'>
                                  {layerPreviews.map((lp) => {
                                    if(!lp.src) return null; // 해당 프레임에 그림이 없는 레이어는 패스
                                    return (
                                    <img
                                      key={lp.id}
                                      src={lp.src}
                                      className="absolute inset-0 w-full h-full object-contain"
                                      style={{
                                        // 💡 픽셀 아트 깨짐(뭉개짐) 방지 및 레이어별 실제 투명도 실시간 반영!
                                        imageRendering: 'pixelated', 
                                        opacity: lp.opacity / 100, 
                                      }}
                                      alt="layer-thumb"
                                    />
                                  );
                                  })}
                                </div>
                              )
                          })()}
                        </div>
                      </div>
                    )
                })}
            
                {/* 프레임 추가 버튼 */}
                <button
                  onClick={() => addFrame()}
                  className='w-full aspect-square rounded-lg border-2 border-dashed flex items-center justify-center transition-colors hover:bg-surface-container hover:border-on-surface-variant'
                  style={{ borderColor: 'var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
                  <span className="material-symbols-outlined text-lg">add</span>
                </button>
              </div>

              {/* 재생 컨트롤 */}
              <div className="flex items-center justify-center gap-4 p-3 border-t" 
                  style={{ borderColor: 'var(--color-outline)' }}>
                
                  {/* 이전 프레임으로 이동 */}
                  <button 
                    onClick={() => {
                      const nextIdx = safeFrameIdx > 0 ? safeFrameIdx - 1 : state.frames.length - 1;
                      handleSelectFrame(nextIdx);
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-container"
                    style={{ color: 'var(--color-on-surface-variant)' }}>
                    <span className="material-symbols-outlined text-lg">skip_previous</span>
                  </button>

                  {/* 재생 / 일시정지 */}
                  <button 
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-container"
                    style={{ color: isPlaying ? 'var(--color-primary)' : 'var(--color-on-surface-variant)' }}>
                    <span className="material-symbols-outlined text-lg">
                      {isPlaying ? 'pause' : 'play_arrow'}
                    </span>
                  </button>
                    
                  {/* 다음 프레임으로 이동 */}
                  <button 
                    onClick={() => {
                      const nextIdx = (safeFrameIdx + 1) % state.frames.length;
                      handleSelectFrame(nextIdx); 
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-container"
                    style={{ color: 'var(--color-on-surface-variant)' }}>
                    <span className="material-symbols-outlined text-lg">skip_next</span>
                  </button>
              </div>
            </div>
          )}
        </div>

        {/* ── 우측 패널 ──────── */}
        <aside className="flex flex-col flex-shrink-0 border-l overflow-y-auto"
          style={{ width: 300, background: 'var(--color-surface)', borderColor: 'var(--color-outline)',
            scrollbarWidth: 'thin', scrollbarColor: 'var(--color-surface-container) transparent' }}>

          {/* 색상 섹션 */}
          <div className="p-4 border-b" style={{ borderColor: 'var(--color-outline)' }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>Color</div>
            {/* FG / BG 색상 */}
            <div className="flex items-center gap-4 mb-4 px-1">
              <div className="relative">
                <div className="w-12 h-12 rounded-lg border-2 cursor-pointer shadow-sm"
                  style={{ background: fgColor, borderColor: 'var(--color-outline)' }} 
                  title="Foreground"
                  onClick={() => setIsHexModal(true)} 
                />
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-lg border-2 shadow-sm"
                  style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }} title="Background" />
              </div>
              <div className="flex-1">
                <div className="text-xs mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>HEX</div>
                <input type="text" value={hexInput}
                  onChange={e => setHexInput(e.target.value)}
                  onBlur={applyHex}
                  onKeyDown={e => e.key === 'Enter' && applyHex()}
                  className="w-full text-sm font-bold rounded-lg px-2 py-1.5 outline-none"
                  style={{ background: 'var(--color-surface-container-low)', border: 'none', color: 'var(--color-on-surface)' }} />
              </div>
            </div>
            {/* RGB 슬라이더 */}
            <div className="space-y-2 px-1">
              {[
                { ch: 'R', val: rgb.r, color: '#ef4444', accent: 'accent-red-500' },
                { ch: 'G', val: rgb.g, color: '#22c55e', accent: 'accent-emerald-500' },
                { ch: 'B', val: rgb.b, color: '#3b82f6', accent: 'accent-blue-500' },
              ].map(({ ch, val, color: col, accent }) => (
                <div key={ch} className="flex items-center gap-2">
                  <span className="text-xs font-bold w-3 flex-shrink-0" style={{ color: col }}>{ch}</span>

                  <input 
                    type="range"
                    min={0}
                    max={255}
                    value={val}
                    className={`flex-1 h-1.5 cursor-pointer ${accent}`} 
                    onChange={(e) => handleRgbChange(ch.toLowerCase() as 'r' | 'g' | 'b', Number(e.target.value))}
                    />
                  <span className="text-xs font-bold w-7 text-right" style={{ color: 'var(--color-on-surface-variant)' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 팔레트 섹션 */}
          <div className="p-4 border-b" style={{ borderColor: 'var(--color-outline)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)' }}>Palette</div>
              <div className="flex gap-1">
                {[['add','색상 추가'],['upload','팔레트 가져오기']].map(([icon,tip]) => (
                  <button key={icon} title={tip}
                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-surface-container"
                    style={{ color: 'var(--color-on-surface-variant)' }}>
                    <span className="material-symbols-outlined text-sm">{icon}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5 px-1">
              {PALETTE_COLORS.map(c => (
                <button 
                  key={c} 
                  onClick={() => { selectPaletteColor(c) }}
                  className="w-8 h-8 rounded cursor-pointer transition-all border-2 hover:scale-110"
                  style={{ background: c, borderColor: fgColor === c ? 'var(--color-on-surface)' : 'transparent' }} />
              ))}
            </div>
            <button className="mt-3 text-xs font-bold hover:underline px-1"
              style={{ color: 'var(--color-primary)' }}>Browse Lospec palettes…</button>
          </div>

          {/* 툴 옵션 섹션 */}
          <div className="p-4 border-b" style={{ borderColor: 'var(--color-outline)' }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>Tool Options</div>
            <div className="space-y-4 px-1">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>Brush Size</span>
                  <span className="text-sm font-bold">{brushSize}px</span>
                </div>
                <input type="range" min={1} max={16} value={brushSize}
                  onChange={e => setBrushSize(Number(e.target.value))}
                  className="w-full h-1.5 cursor-pointer accent-primary" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>Opacity</span>
                  <span className="text-sm font-bold">{opacity}%</span>
                </div>
                <input type="range" min={0} max={100} value={opacity}
                  onChange={e => setOpacity(Number(e.target.value))}
                  className="w-full h-1.5 cursor-pointer accent-primary" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: 'var(--color-on-surface-variant)' }}>Pixel Perfect</span>
                <button onClick={() => setPixelPerfect(v => !v)}
                  className="w-11 h-6 rounded-full relative transition-all flex-shrink-0"
                  style={{ background: pixelPerfect ? 'var(--color-primary)' : 'var(--color-surface-container-highest)' }}>
                  <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                    style={{ left: pixelPerfect ? 'calc(100% - 22px)' : '2px' }} />
                </button>
              </div>
            </div>
          </div>

          {/* 캔버스 크기 섹션 */}
          <div className="p-4 border-b" style={{ borderColor: 'var(--color-outline)' }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>Canvas Size</div>
            <div className="px-1 space-y-2">

              {/* 1. 프리셋 버튼 grid */}
              <div className="grid grid-cols-3 gap-1">
                {CANVAS_PRESETS.map(p => {
                  const [w, h] = p.split('×').map(Number)
                  const active = state.width === w && state.height === h
                  return (
                    <button 
                      key={p} 
                      onClick={() =>{
                        setCustomW(w);
                        setCustomH(h);
                        
                      }}
                      className="py-1 text-xs rounded-lg font-bold transition-all border"
                      style={{
                        background: active ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'var(--color-surface-container-low)',
                        borderColor: active ? 'var(--color-primary)' : 'var(--color-outline)',
                        color: active ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                      }}>{p}</button>
                  )
                })}
              </div>

              {/* 2. 커스텀 크기 설정 및 Apply 버튼 */}
              <div className="flex items-center gap-1.5 pt-1">
                <input type="number" value={customW} min={1} max={512}
                  onChange={e => setCustomW(Number(e.target.value))}
                  className="w-16 px-2 py-1 rounded text-xs outline-none text-center font-bold"
                  style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }} />
                <span className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>×</span>
                <input type="number" value={customH} min={1} max={512}
                  onChange={e => setCustomH(Number(e.target.value))}
                  className="w-16 px-2 py-1 rounded text-xs outline-none text-center font-bold"
                  style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }} />
                <button onClick={() => applyCanvasSize(customW, customH)}
                  className="flex-1 py-1 rounded text-xs font-bold transition-all hover:opacity-90"
                  style={{ background: 'var(--color-primary)', color: '#fff' }}>Apply</button>
              </div>
              
              {/*3. 이미지 비율 보정 체크 박스*/}
              <div className="flex items-center gap-2 pt-1 pb-0.5 select-none cursor-pointer"
                onClick={() => setIsScaleImage(prev => !prev)} // 글씨를 클릭해도 토글되게 유저 경험 개선
              >
                <input
                  type="checkbox"
                  id="scale-image-toggle"
                  checked={isScaleImage}
                  onChange={(e) => setIsScaleImage(e.target.checked)}
                  className="rounded cursor-pointer accent-primary bg-surface-container-low" 
                  style={{ 
                    width: '13px', 
                    height: '13px',
                    border: '1px solid var(--color-outline)'
                  }}
                />
                <label
                  htmlFor="scale-image-toggle"
                  className="text-[11px] font-semibold cursor-pointer" // 전체 UI 비율에 맞춰 폰트 크기를 약간 슬림하게 조절
                  style={{ color: 'var(--color-on-surface-variant)' }}
                >
                  크기 변경 시 기존 이미지 비율 보정
                </label>
              </div>
            </div>
          </div>
          
          {/* ⏳레이어 섹션 */}
          <div className="p-4 flex-1">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)' }}>Layers</div>
              <div className="flex gap-1">
                {layerButtons.map(([icon,tip, handler]) => (
                  <button key={icon} title={tip}
                    onClick={() => {
                      if(!handler) return;
                      if (icon === 'add') {
                        handler(safeFrameIdx);
                      } else if (icon === 'delete') {
                        // deleteLayer는 (frameIdx, layerId) 두 개를 받으므로 맞춰서 전달
                        handler(safeFrameIdx, activeLayer);
                      }
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-surface-container"
                    style={{ color: 'var(--color-on-surface-variant)' }}>
                    <span className="material-symbols-outlined text-sm">{icon}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-0.5">
              {reversedLayersWithIdx.map(({layer, originalIndex}) => (
                <div 
                  key={layer.id}
                  role="button"
                  draggable // 드래그 가능하도록 설정
                  onDragStart={(e) => handleDragStart(e, originalIndex)}
                  onDragOver={(e) => handleDragOver(e)}
                  onDrop={(e) => handleDrop(e, originalIndex)}
                  onClick={() => selectLayer(safeFrameIdx, layer.id)}
                  onKeyDown={(e) => {
                    if(e.key === 'Enter' || e.key === ' '){
                      e.preventDefault();
                      selectLayer(safeFrameIdx, layer.id);
                    }
                  }}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm"
                  style={{
                    background: activeLayer === layer.id ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
                    color: activeLayer === layer.id ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                    fontWeight: activeLayer === layer.id ? 700 : 400,
                  }}>
                  
                  {/* 레이어 눈 토글 버튼 활성화 */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation(); // 💡 중요: 버튼을 누를 때 부모 div의 selectLayer가 트리거되는 것을 방지!
                      toggleVisibility(safeFrameIdx, layer.id);
                    }}
                    className="flex items-center justify-center p-0.5 rounded hover:bg-surface-container-highest transition-colors"
                    style={{ color: layer.isVisible ? 'var(--color-primary)' : 'var(--color-outline-strong)' }}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {layer.isVisible ? 'visibility' : 'visibility_off'}
                    </span>
                  </button>
                  {/* 레이어 썸네일 박스 */}
                  <div className="w-8 h-8 rounded border flex-shrink-0 checkerboard pointer-events-none"
                    style={{
                      borderColor: activeLayer === layer.id ? 'var(--color-primary)' : 'var(--color-outline)',
                    }} />
                    
                  <span className="text-sm truncate flex-1 pointer-events-none">{layer.name}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>
        
        <ColorPickerModal 
          isOpen={isHexModal}
          onClose={() => setIsHexModal(false)}
          color={fgColor}
          onChange={selectPaletteColor}
        />
        {/* ── ⏳AI 가이드 전용 패널 (VS Code Secondary Side Bar 스타일) ── */}
        <div className="flex flex-col flex-shrink-0 border-l transition-all duration-300 ease-in-out overflow-hidden"
          style={{ 
            width: showAIGuide ? 350 : 0, // AI 가이드 온오프 상태에 따라 너비 조절
            background: 'var(--color-background)',        // 메인 패널보다 살짝 더 어두운 배경 (구분감)
            borderColor: 'var(--color-outline)',
            opacity: showAIGuide ? 1 : 0  // 닫혔을 때 잔상 방지
          }}>
          
          {/* 헤더: VS Code 패널 느낌 */}
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: 'var(--color-outline)' }}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-primary text-lg">auto_awesome</span>
              <span className="text-xs font-bold uppercase tracking-widest text-on-surface">AI Assistant</span>
            </div>
            <button onClick={() => setShowAIGuide(false)} className="hover:text-on-surface text-on-surface-variant">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          {/* 컨텐츠: 큼직한 가이드 영역 */}
          <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
            {/* 여기에 광고나 AI 분석 결과 렌더링 */}
            <div className="w-full aspect-[3/4] mb-4 rounded-xl border-2 border-dashed border-outline flex items-center justify-center bg-surface">
              <p className="text-[11px] text-outline-strong text-center">
                캔버스 분석 중...<br/>(광고 또는 AI 가이드 이미지)
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-surface-container-low border border-outline">
                <p className="text-xs leading-relaxed text-on-surface-variant">
                  <strong className="text-primary">💡 조언:</strong> 현재 캐릭터의 실루엣이 불분명합니다. 외곽선(Outline) 레이어에 좀 더 어두운 색을 사용해 보세요.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 하단 상태바 ──────────── */}
      <footer className="flex items-center gap-6 px-5 flex-shrink-0 border-t text-sm font-bold"
        style={{ height: 42, background: 'var(--color-surface)', borderColor: 'var(--color-outline)', color: 'var(--color-on-surface-variant)' }}>
        <span>Canvas: {state.width} × {state.height}</span>
        <span className="w-px h-4" style={{ background: 'var(--color-surface-container-highest)' }} />
        <span>Zoom: {Math.round(zoom * 100)}%</span>
        <span className="w-px h-4" style={{ background: 'var(--color-surface-container-highest)' }} />
        <span>{cursorPos.x >= 0 ? `Cursor: ${cursorPos.x}, ${cursorPos.y}` : 'Cursor: —'}</span>
        <span className="w-px h-4" style={{ background: 'var(--color-surface-container-highest)' }} />
        <span>Tool: {activeTool.charAt(0).toUpperCase() + activeTool.slice(1)}</span>
        <span className="w-px h-4" style={{ background: 'var(--color-surface-container-highest)' }} />
        <span>Active: {state.frames[safeFrameIdx]?.layers.find(l => String(l.id) === String(activeLayer))?.name || '-'}</span>
        <div className="ml-auto flex items-center gap-4">
          <span>{state.frames[safeFrameIdx]?.layers.length} layers</span>
          <span className="w-px h-4" style={{ background: 'var(--color-surface-container-highest)' }} />
          {unsaved
            ? <span style={{ color: '#f59e0b' }}>● Unsaved</span>
            : <span style={{ color: 'var(--color-success)' }}>● Saved</span>}
        </div>
      </footer>
    </div>
  )
}
