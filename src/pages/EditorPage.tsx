import { useRef, useState, useEffect, useCallback } from 'react'
import {useSearchParams } from 'react-router-dom'
import { LayerData } from '../constants/editorType'
import {createInitialCanvasData, DRAW_TOOLS, SELECT_TOOLS, SHAPE_TOOLS, VIEW_TOOLS, PALETTE_COLORS, ZOOM_LEVELS, CANVAS_PRESETS, createDefaultLayer} from '../constants/editor'
import {useCanvasView} from '../hooks/editor/useCanvasView'
import EditorSaveProjectModal from '../components/EditorSaveProjectModal'
import { editorApi } from '../api/editorApi'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'
import {useAnimation} from '../hooks/editor/useAnimation'
import { useHistory } from '../hooks/editor/useHistory'
import { applyPalette, GIFEncoder, quantize } from 'gifenc'
import { useLayers } from '../hooks/editor/useLayer'
import { Stage, Layer as KonvaLayer } from 'react-konva'
import Konva from 'konva'
import { KonvaEventObject } from 'konva/lib/Node'
import { useEditor } from '../hooks/editor/useEditor'
import { LayerImageRenderer } from '../components/LayerImageRender'

type MenuItem =
  | { separator: true }
  | { label: string; shortcut?: string; icon?: string; action?: () => void; disabled?: boolean }

// ── 컴포넌트 ──────────────────────────────────────────
export default function EditorPage() {
  
  const stageRef = useRef<Konva.Stage>(null)
  const menuRef   = useRef<HTMLDivElement>(null)
  const [searchParams, setSearchParams] = useSearchParams()
  const { isLoggedIn } = useAuthStore()

  const [activeTool, setActiveTool]   = useState('pencil')
  const [fgColor, setFgColor]         = useState('#2f81f7')
  const [hexInput, setHexInput]       = useState('#2f81f7')
  const [brushSize, setBrushSize]     = useState(1)
  const [opacity, setOpacity]         = useState(100)
  const [pixelPerfect, setPixelPerfect] = useState(true)

  const {canvasW, setCanvasW, canvasH, setCanvasH, zoom, setZoomIdx} = useCanvasView(32, 32)
  const [cursorPos, setCursorPos]     = useState({ x: -1, y: -1 })

  const {state, setState, setWithHistory, undo, redo} = useHistory(createInitialCanvasData());
  
  // ── 애니메이션 상태 및 훅 ──────────────────────────
  const{addFrame, deleteFrame} = useAnimation({
    frames: state.frames,
    currentFrameIdx: state.currentFrameIdx,
    onChange: (newFrames, nextIdx) => {
      setWithHistory((prev) => ({
        ...prev,
        frames: newFrames,
        currentFrameIdx: nextIdx ?? prev.currentFrameIdx
      }));
    }
  });
  const [isPlaying, setIsPlaying] = useState(false);
  const framesCountRef = useRef(state.frames.length);  // 최신 프레임 개수를 실시간으로 추적할 Ref 생성

  // ── AI 가이드 상태 ──────────────────────────
  const[showAIGuide, setShowAIGuide] = useState(false);

  // ── 레이어 상태 및 훅 ──────────────────────────
  const firstLayer = createInitialCanvasData().frames?.[0]?.layers?.[0];
  const [layers, setLayers] = useState<LayerData[]>([firstLayer]);
  const [activeLayer, setActiveLayer] = useState<string | null>(firstLayer.id);
  const { addLayer, deleteLayer, toggleVisibility, layerCounter} = useLayers(
    state, 
    setWithHistory, 
    activeLayer, 
    setActiveLayer
  );
  // ────────────────────────────

  const [customW, setCustomW]         = useState(32)
  const [customH, setCustomH]         = useState(32)

  const [showAnim, setShowAnim]       = useState(false)
  const [unsaved, setUnsaved]         = useState(false)
  const [openMenu, setOpenMenu]       = useState<string | null>(null)
  const [showGridLines, setShowGridLines] = useState(true)

  // ── 프로젝트 저장 관련 상태 ──────────────────────────
  const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)

  const [projectTitle, setProjectTitle] = useState('Untitled Project')
  const [editingTitle, setEditingTitle] = useState(false)
  const isDrawing = useRef(false)
  const layerCanvasRefs = useRef<Record<string, HTMLCanvasElement>>({})

  const {handleSave, setProjectId, saving} = useEditor({
    stageRef,
    canvasW,
    canvasH,
    zoom,
    isLoggedIn,
    layers,
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

  // ── 캔버스 그리기 로직 ──────────────

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
      existingCanvas.width === canvasW &&
      existingCanvas.height === canvasH
    ) {
      return existingCanvas;
    }

    // 2. 크기가 바뀌었거나 아예 처음 만든 방이라면 메모리에 가상 도화지 새로 생성
    const nextCanvas = document.createElement('canvas')
    nextCanvas.width = canvasW
    nextCanvas.height = canvasH

    const ctx = nextCanvas.getContext('2d')
    if (ctx) {
      ctx.imageSmoothingEnabled = false; // 픽셀아트 흐림 방지
      
      // 크기 조절 등으로 인해 기존 도화지를 복사해야 하는 상황
      if (existingCanvas) {
        ctx.drawImage(existingCanvas, 0, 0);
      }
    }
    layerCanvasRefs.current[id] = nextCanvas
    return nextCanvas;
  }, [canvasW, canvasH])


  useEffect(() => {
    const liveLayerIds = new Set(layers.map((layer) => layer.id))
    layers.forEach((layer) => getLayerCanvas(layer.id))

    Object.keys(layerCanvasRefs.current).forEach((layerId) => {
      if (!liveLayerIds.has(layerId)) {
        delete layerCanvasRefs.current[layerId]
      }
    })
  }, [layers, getLayerCanvas])
  
  // -------- 활성 프레임의 활성 레이어에 대한 캔버스에다가 픽셀 도구 효과를 적용하는 로직 -----------
  const drawPixel = useCallback((e:KonvaEventObject<MouseEvent>) => {
    const stage = stageRef.current;
    const currentFrameIdx = state.currentFrameIdx;
    if(!stage || !activeLayer) return;
    
    const cacheKey = `frame-${currentFrameIdx}_layer-${activeLayer}`
    const nativeCanvas = getLayerCanvas(cacheKey);
    if(!nativeCanvas) return;

    const ctx = nativeCanvas.getContext('2d');
    const pos = getPixel()
    if (!ctx || !pos) return

    const { x, y } = pos
    if (x < 0 || x >= canvasW || y < 0 || y >= canvasH) return

    if (activeTool === 'pencil') {
      ctx.fillStyle = fgColor
      ctx.fillRect(x, y, brushSize, brushSize)
      ctx.globalAlpha = 1
    } else if (activeTool === 'eraser') {
      ctx.clearRect(x, y, brushSize, brushSize)
    }

    const activeLayerNode = stage.findOne(`#${activeLayer}`);
    if(activeLayerNode){
      activeLayerNode.getLayer()?.batchDraw();
    }
    setUnsaved(true)
  }, [activeTool, fgColor, brushSize, canvasW, canvasH, getPixel, activeLayer, getLayerCanvas])

  const handleMouseMove = (e: KonvaEventObject<MouseEvent>) => {
    const pos = getPixel()
    if (pos) setCursorPos(pos)
    if (isDrawing.current) drawPixel(e)
  }

  const applyCanvasSize = (w: number, h: number) => {
    setCanvasW(w); setCanvasH(h)
    setOpenMenu(null)
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

    editorApi.getProject(numId).then(res => {
      const proj = res.data.data
      setProjectId(proj.projectId)
      setProjectTitle(proj.title)
      
      // 1. 크기 상태를 먼저 세팅 (초기화 useEffect가 먼저 돌 수 있도록 유도)
      setCanvasW(proj.width)
      setCanvasH(proj.height)
      setCustomW(proj.width)
      setCustomH(proj.height)

      if(proj.layers && proj.layers.length > 0){
        // layerOrder 순서대로 오름차순 정렬 (0, 1, 2...)
        const sortedLayers = [...proj.layers].sort((a, b) => a.layerOrder - b.layerOrder)

        const loadedLayers: LayerData[] = sortedLayers.map((serverLayer) => ({
          id: String(serverLayer.layerId),
          name: serverLayer.name,
          layerOrder: serverLayer.layerOrder,
          blendMode: serverLayer.blendMode,
          isLocked: serverLayer.isLocked,
          isVisible: serverLayer.isVisible,
          opacity: serverLayer.opacity,
          color: '#818cf8',
          pixelData: serverLayer.pixelData || '',
        }));
        setLayers(loadedLayers);
        const firstLayer = loadedLayers[0];

        if(firstLayer && firstLayer.pixelData?.trim().startsWith('[')){ // 공백을 없앤 후 첫 글자가 [로 시작한는지 검사
          try{
            const parsedFrameImages = JSON.parse(firstLayer.pixelData);

            setWithHistory((prev) => {
              const restoredFrames = parsedFrameImages.map((imgObj: any) => {
                return {
                  id: `frame-${imgObj.frameIdx}`,
                  name: `Frame ${imgObj.frameIdx + 1}`,
                  // 각 프레임 객체는 위에서 파싱한 레이어 묶음들을 알맹이로 이식받습니다.
                  layers: loadedLayers
                };
              });
              return {
                ...prev,
                frames: restoredFrames.length > 0 ? restoredFrames : prev.frames,
                currentFrameIdx: 0 // 항상 첫 번째 프레임부터 감상 시작
              };
            });
          }catch(e){
            console.error("프로젝트 히스토리 데이터 복원 실패:", e);
          }
        }
      }
      setUnsaved(false)
    }).catch(() => toast.error('프로젝트를 불러오지 못했습니다.'))
  }, [searchParams, isLoggedIn, setCanvasW, setCanvasH, setState]) // 의존성 배열 보완

  // ── Ctrl+S, Ctrl+Y, Ctrl+Z 단축키 ────────────────────────────────
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const isMod = e.ctrlKey || e.metaKey;
      const key = e.key.toLowerCase();
      if (isMod && key === 's') {
        e.preventDefault();
        handleSave();
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
  }, [handleSave, undo, redo])

  //  ── 저장 모달 함수 ──────────────────────────────────
  const openSaveModal = useCallback(() => {
    if (!isLoggedIn) {
      toast.error('로그인이 필요합니다.')
      return
    }
    setIsSaveModalOpen(true)
  }, [isLoggedIn])
  
  // ── PNG/GIF 내보내기 ──────────────────────────────────
  const downloadBlob = (blob: Blob, filename: string) => {
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')

    link.href = url
    link.download = filename
    link.click()

    URL.revokeObjectURL(url)
  }

  const handleExportImage = useCallback(async() => {
    const stage = stageRef.current
    if (!stage) return

    const safeTitle = projectTitle.replace(/\s+/g, '_')
    // 단일 프레임 처리: 햔재 보이는 Stage 전체를 PNG로 내보내기
    if(state.frames.length <= 1){
      const currentFullImage = stage.toDataURL({pixelRatio: 1}) // 원본 크기 유지
      const link = document.createElement('a')
      link.download = `${safeTitle}.png`
      link.href = currentFullImage
      link.click()
      return;
    }
    // 멀티 프레임 일 때
    const gif = GIFEncoder()

    for(let fIdx = 0; fIdx < state.frames.length; fIdx++){
      const frameCanvas = document.createElement('canvas')
      frameCanvas.width = canvasW
      frameCanvas.height = canvasH
      const fCtx = frameCanvas.getContext('2d')
      if(!fCtx) continue // 질문: continue를 쓰는 이유는? 로딩이 안되었을 까봐 그런건가

      fCtx.imageSmoothingEnabled = false
      fCtx.clearRect(0, 0, canvasW, canvasH)

      for(const layer of layers){
        if(!layer.isVisible) continue // 보이지 않는 레이어는 합성에서 제외

        let layerFrameSrc: string | null = null
        if(layer.pixelData){
          try{
            const frameImages = JSON.parse(layer.pixelData) // [ {frameIdx: 0, image: '...'}, ... ]
            const match = frameImages.find((img: any) => img.frameIdx === fIdx) // 질문
            if(match) layerFrameSrc = match.image
          }
          catch(e){
            console.error("레이어 프레임 파싱 실패", e)
          }
        }
        // 해당 레이어에 이 프레임 장수의 그림이 존재한다면 가상 도화지에 덧칠합니다.
        if(layerFrameSrc){
          const img = new Image()
          await new Promise<void>((resolve) => {
            img.onload = () => {
              fCtx.globalAlpha = layer.opacity
              fCtx.drawImage(img, 0, 0, canvasW, canvasH)
              fCtx.globalAlpha = 1.0
              resolve()
            }
            img.onerror = () => resolve() // 에러 시 스킵하고 다음 레이어로 진행
            img.src = layerFrameSrc! // ! -> null이나 ubdefined일 리가 없다는 표시
          })
        }
      }
      // 모든 레이어가 이쁘게 겹쳐진 최종 캔버스에서 ImageData를 추출합니다.
      const imageData = fCtx.getImageData(0, 0, canvasW, canvasH)
      // 기존 픽셀 양자화 및 인코딩 로직 실행
      const palette = quantize(imageData.data, 256)
      const indexed = applyPalette(imageData.data, palette)

      gif.writeFrame(indexed, canvasW, canvasH, {
        palette,
        delay: 100, // 나중에 타임라인 속도 조절(fps) 상태가 있다면 연동 가능
        repeat: 0,
      })
    }

    gif.finish()

    const blob = new Blob([gif.bytes()], { type: 'image/gif' })
    downloadBlob(blob, `${safeTitle}.gif`)
    
  }, [projectTitle, state.frames, state.currentFrameIdx, canvasW, canvasH, layers])

  // ── 새 프로젝트 ───────────────────────────────────
  const handleNewProject = useCallback(() => {
    if (unsaved && !confirm('저장되지 않은 변경사항이 있습니다. 계속하시겠습니까?')) return
    
    const defaultLayerId = `layer-${Date.now()}` // 고유 Id
    
    const defaultLayer: LayerData = {
      id: defaultLayerId, // ID는 문자열로 관리하는 것이 확장성에 좋습니다.
      name: 'Background',
      layerOrder: 0,
      blendMode: 'NORMAL',
      isLocked: false,
      isVisible: true,
      opacity: 100,
      color: '#818cf8',
      pixelData: JSON.stringify([{frameIdx: 0, image: ''}])
    }

    setLayers([defaultLayer])
    setActiveLayer(defaultLayerId)
    if(layerCounter){
      layerCounter.current = 1 // 1로 초기화
    }

    setState({
      frames: [
        {
          id: `frame-${Date.now()}`, // 프레임 고유 ID 부여
          layers: [defaultLayer] // 새 프레임에도 이 기본 레이어 정보 주입
        }
      ],
      currentFrameIdx: 0,
      width: canvasW,
      height: canvasH
    })
    setProjectId(null)
    setProjectTitle('Untitled Project')
    setUnsaved(false)
    // URL에 남은 projectId 쿼리 파라미터 제거
    setSearchParams({}, { replace: true })
  }, [unsaved, canvasW, canvasH, setSearchParams, setLayers, setActiveLayer, setState])

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
    background: activeTool === id ? 'rgba(47,129,247,0.15)' : 'transparent',
    color: activeTool === id ? '#2f81f7' : '#7d8590',
  })

  // ── 애니메이션 ───────────────────────────────────
  useEffect(() => {
    framesCountRef.current = state.frames.length;
  }, [state.frames.length]);

  // 재생 로직
  useEffect(() => {
    if(!isPlaying) return;
    const interval = setInterval(() => {
      setState((prev) => {
        const total = prev.frames.length;
        if(total <= 1) return prev;

        const nextIdx = (prev.currentFrameIdx + 1) % total;

        return{
          ...prev,
          currentFrameIdx: nextIdx,
        };
      });
    }, 100)
    return () => clearInterval(interval);
  }, [isPlaying, setState]);

  /**
   * 현재 캔버스의 내용을 이미지 데이터(Base64)로 변환하여 해당 프레임에 저장합니다.
   * setWithHistory -> useHistory 기록용
  */
  const commitLayerChanges = useCallback(() => {
    const stage = stageRef.current;
    if(!stage || !activeLayer) return;

    const capturedFrameIdx = state.currentFrameIdx;
    if(!state.frames[capturedFrameIdx]) return;
    
    // 💡 [핵심 수정]: 마우스를 뗄 때도 현재 지목된 고유한 프레임_레이어 상자에서 그림을 도려냅니다.
    const cacheKey = `frame-${capturedFrameIdx}_layer-${activeLayer}`;
    const cachedCanvas = layerCanvasRefs.current[cacheKey];
    if (!cachedCanvas) return;

    // 🔥 최적화 수정: 무겁고 잔상이 남을 수 있는 Node.toCanvas() 대신 
    // 우리가 실시간으로 낙서하던 진짜 가상 오프스크린 캔버스 캐시에서 직접 순수 PNG 소스를 주출합니다.
    const layerImageData = cachedCanvas.toDataURL('image/png');

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
      };
    });
    setUnsaved(true);
  }, [state.currentFrameIdx, activeLayer, setWithHistory]);

  /* 프레임 선택 시 실행되는 함수 */
  const handleSelectFrame = (nextIndex: number) => {
    const canvas = stageRef.current;
    if (!canvas) return;

    if (unsaved) {
        const imageData = canvas.toDataURL();
        setWithHistory((prev) => ({
          ...prev,
          frames: prev.frames.map((f, i) =>
            i === prev.currentFrameIdx ? { ...f, data: imageData } : f
          ),
          currentFrameIdx: nextIndex,
        }));
        setUnsaved(false);
    } 
    else {
      setState((prev) => ({ ...prev, currentFrameIdx: nextIndex }));
    }
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
      const cacheKey = `frame-${frameIdx}_layer-${activeLayer}`;
      const cachedCanvas = layerCanvasRefs.current[cacheKey];

     if (cachedCanvas) {
        const layerImageData = cachedCanvas.toDataURL('image/png');
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

  // ── 메뉴 정의 (actions can reference state) ──
  const MENU_DEFS: { id: string; label: string; items: MenuItem[] }[] = [
    {
      id: 'file', label: 'File',
      items: [
        { label: 'New Project',        icon: 'add',           shortcut: 'Ctrl+N', action: () => { handleNewProject(); setOpenMenu(null) } },
        { label: 'Open Project…',     icon: 'folder_open',   shortcut: 'Ctrl+O' },
        { separator: true },
        { label: 'Save',               icon: 'save',          shortcut: 'Ctrl+S', action: () => { openSaveModal(); setOpenMenu(null) } },
        //{ label: 'Save As…',          icon: 'save_as',       shortcut: 'Ctrl+Shift+S' },
        { label: 'Browser Save',       icon: 'open_in_browser', shortcut: 'Ctrl + Shift + S'},
        { separator: true },
        { label: 'Export Image',      icon: 'image',         action: () => { handleExportImage(); setOpenMenu(null) } },
        { label: 'Export Spritesheet',      icon: 'grid_on' },
        { label: 'Download .pixhub',        icon: 'download' },
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
    <div className="fixed inset-0 top-0 flex flex-col" style={{ background: '#0d1117', color: '#e6edf3', zIndex: 60 }}>
      <EditorSaveProjectModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSave}
        initialTitle={projectTitle}
      />
      
      {/* ── TOP BAR (Photoshop 스타일 메뉴 툴바) ─────── */}
      <header className="h-10 flex items-center flex-shrink-0 border-b select-none"
        style={{ background: '#161b22', borderColor: '#30363d' }}>

        {/* 좌: 로고 + 메뉴바 */}
        <div ref={menuRef} className="flex items-center h-full">
          {/* 로고 */}
          <a href="/" className="flex items-center gap-1.5 font-bold text-sm px-4 h-full hover:bg-[#21262d] transition-colors"
            style={{ color: '#2f81f7' }}>
            <span className="material-symbols-outlined text-base">grid_view</span>
            PixelHub
          </a>

          <div className="w-px h-5 mx-1" style={{ background: '#30363d' }} />

          {/* 메뉴 항목들 */}
          {MENU_DEFS.map(menu => (
            <div key={menu.id} className="relative h-full flex items-center">
              <button
                onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
                className="px-3 h-full text-sm transition-colors"
                style={{
                  color: openMenu === menu.id ? '#e6edf3' : '#c9d1d9',
                  background: openMenu === menu.id ? '#21262d' : 'transparent',
                }}>
                {menu.label}
              </button>

              {openMenu === menu.id && (
                <div className="absolute top-full left-0 rounded-b-lg border shadow-2xl py-1 z-50 min-w-[220px]"
                  style={{ background: '#21262d', borderColor: '#30363d', borderTopColor: 'transparent' }}>
                  {menu.items.map((item, idx) => {
                    if ('separator' in item) {
                      return <div key={idx} className="my-1 border-t" style={{ borderColor: '#30363d' }} />
                    }
                    return (
                      <button key={idx}
                        onClick={item.action ?? (() => setOpenMenu(null))}
                        disabled={item.disabled}
                        className="w-full flex items-center gap-2.5 px-4 py-1.5 text-sm text-left transition-colors hover:bg-[#292f38] disabled:opacity-40 disabled:cursor-default">
                        {item.icon && (
                          <span className="material-symbols-outlined text-sm w-4 flex-shrink-0"
                            style={{ color: '#7d8590' }}>{item.icon}</span>
                        )}
                        <span className="flex-1" style={{ color: '#e6edf3' }}>{item.label}</span>
                        {item.shortcut && (
                          <span className="text-xs ml-4" style={{ color: '#7d8590' }}>{item.shortcut}</span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}
            </div>
          ))}
        </div>

        {/* 우: 파일명 + 저장 + 공유 */}
        <div className="ml-auto flex items-center gap-2 pr-3">
          <div className="flex items-center gap-1.5">
            <span className="material-symbols-outlined text-sm" style={{ color: '#7d8590' }}>description</span>
            {editingTitle ? (
              <input
                autoFocus
                type="text"
                value={projectTitle}
                onChange={e => setProjectTitle(e.target.value)}
                onBlur={() => setEditingTitle(false)}
                onKeyDown={e => { if (e.key === 'Enter' || e.key === 'Escape') setEditingTitle(false) }}
                className="text-sm font-bold rounded px-1 outline-none"
                style={{ background: '#1c2128', border: '1px solid #2f81f7', color: '#e6edf3', width: 160 }}
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
          <div className="w-px h-5 mx-1" style={{ background: '#30363d' }} />
          <button
            onClick={openSaveModal}
            disabled={saving}
            className="flex items-center gap-1.5 px-3 py-1 text-sm font-bold rounded-lg transition-all hover:bg-[#1c2128] disabled:opacity-50"
            style={{ color: saving ? '#2f81f7' : '#7d8590' }}>
            <span className="material-symbols-outlined text-base">{saving ? 'hourglass_empty' : 'save'}</span>
            {saving ? 'Saving…' : 'Save'}
          </button>
          <button className="flex items-center gap-1.5 px-3 py-1 rounded-lg text-sm font-bold transition-all hover:opacity-90 active:scale-95"
            style={{ background: '#2f81f7', color: '#fff', boxShadow: '0 2px 8px rgba(47,129,247,0.3)' }}>
            <span className="material-symbols-outlined text-base">share</span>Share
          </button>
        </div>
      </header>

      {/* ── EDITOR BODY ──────────────────────────────── */}
      <div className="flex flex-1 min-h-0">

        {/* ── 좌측 툴바 ── */}
        <aside className="flex flex-col items-center py-3 gap-1 flex-shrink-0 border-r"
          style={{ width: 84, background: '#161b22', borderColor: '#30363d' }}>

          {/* 그리기 도구 */}
          <div className="flex flex-col items-center gap-1 w-full px-2 pb-3 mb-1 border-b" style={{ borderColor: '#30363d' }}>
            {DRAW_TOOLS.map(t => (
              <button key={t.id} title={t.label} onClick={() => setActiveTool(t.id)}
                className="w-14 h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer"
                style={toolBtn(t.id)}>
                <span className="material-symbols-outlined text-2xl">{t.icon}</span>
              </button>
            ))}
          </div>

          {/* 선택 도구 */}
          <div className="flex flex-col items-center gap-1 w-full px-2 pb-3 mb-1 border-b" style={{ borderColor: '#30363d' }}>
            {SELECT_TOOLS.map(t => (
              <button key={t.id} title={t.label} onClick={() => setActiveTool(t.id)}
                className="w-14 h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer"
                style={toolBtn(t.id)}>
                <span className="material-symbols-outlined text-2xl">{t.icon}</span>
              </button>
            ))}
          </div>

          {/* 도형 도구 */}
          <div className="flex flex-col items-center gap-1 w-full px-2 pb-3 mb-1 border-b" style={{ borderColor: '#30363d' }}>
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
            style={{ width: canvasW * zoom, height: canvasH * zoom, backgroundColor: '#e8e8e8' }}>
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
              width={canvasW * zoom}
              height={canvasH * zoom}
              scaleX={zoom}
              scaleY={zoom}
              onMouseDown={e => { isDrawing.current = true; drawPixel(e) }}
              onMouseMove={handleMouseMove}
              onMouseUp={() => {
                isDrawing.current = false
                commitLayerChanges();
               }}
              onMouseLeave={() => { 
                if(isDrawing.current) commitLayerChanges();
                isDrawing.current = false;
                setCursorPos({ x: -1, y: -1 }) 
              }}
            >
              {(state.frames[state.currentFrameIdx]?.layers ?? [])
                .sort((a, b) => a.layerOrder - b.layerOrder)
                .filter((layer) => layer.isVisible)
                .map((layer) => (
                  <KonvaLayer key={layer.id} id={layer.id} opacity={layer.opacity / 100}>
                    
                    {/* 💡 복잡한 캔버스 생성 및 복원 로직은 이 블랙박스 컴포넌트가 알아서 수행합니다! */}
                    <LayerImageRenderer 
                      layerId={layer.id}
                      pixelData={layer.pixelData}
                      canvasW={canvasW}
                      canvasH={canvasH}
                      currentFrameIdx={state.currentFrameIdx}
                      layerCanvasRefs={layerCanvasRefs}
                    />
                  </KonvaLayer>
              ))}
            </Stage>
          </div>

          {/* 줌 컨트롤 (하단 중앙 플로팅) */}
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex items-center gap-1 rounded-xl px-3 py-1.5 shadow-lg border"
            style={{ background: '#21262d', borderColor: '#30363d' }}>
            <button onClick={() => setZoomIdx(i => Math.max(0, i-1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-[#292f38]"
              style={{ color: '#7d8590' }}>
              <span className="material-symbols-outlined text-sm">remove</span>
            </button>
            <span className="text-xs font-bold w-12 text-center">x{zoom}</span>
            <button onClick={() => setZoomIdx(i => Math.min(ZOOM_LEVELS.length-1, i+1))}
              className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-[#292f38]"
              style={{ color: '#7d8590' }}>
              <span className="material-symbols-outlined text-sm">add</span>
            </button>
          </div>

          {/* 커서 위치 (우하단 플로팅) */}
          <div className="absolute bottom-4 right-4 rounded-lg px-3 py-1.5 shadow border text-xs font-bold"
            style={{ background: 'rgba(33,38,45,0.9)', borderColor: '#30363d', color: '#7d8590' }}>
            {cursorPos.x >= 0 ? `x: ${cursorPos.x}  y: ${cursorPos.y}` : 'x: —  y: —'}
          </div>
        </main>

         {/* ── 애니메이션 패널 ─────────────────────────────── */}
        <div className="flex flex-col flex-shrink-0 border-l"
          style={{ width: showAnim ? 160 : 36, background: '#161b22', borderColor: '#30363d', transition: 'width 0.2s' }}>
          {/* 토글 버튼 */}
          <button onClick={() => setShowAnim(v => !v)}
            className="w-9 h-9 flex items-center justify-center flex-shrink-0 transition-colors hover:bg-[#21262d]"
            style={{ color: showAnim ? '#2f81f7' : '#7d8590' }}
            title="Animation">
            <span className="material-symbols-outlined text-xl">animation</span>
          </button>

          {showAnim && (
            <div className="flex flex-col flex-1 overflow-hidden">
              <div className='px-3 py-2 text-xs font-bold uppercase tracking-widest border-b flex items-center justify-between'
                style={{ color: '#7d8590', borderColor: '#30363d' }} > 
                <span>Anim</span>
                <span className='text-[10px]'>{state.frames.length} frame{state.frames.length > 1 ? 's' : ''}</span>  
              </div>

              {/* 프레임 목록 */}
              <div className="flex-1 overflow-y-auto p-2 space-y-1.5">
                {state.frames.map((frame, index) => {
                    const isActive = state.currentFrameIdx === index;
                    return(
                      <div
                        key = {frame.id}
                        onClick={() => handleSelectFrame(index)} // 프레임 선택 기능
                        className='relative group rounded-lg border-2 p-1 cursor-pointer'
                        style={{
                          borderColor: isActive ? '#2f81f7' : '#30363d',
                          background: isActive ? '#1c2128' : 'transparent'
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
                                    const frameImages = JSON.parse(layer.pixelData);
                                    const match = frameImages.find((img: any) => img.frameIdx === index)
                                    if (match) src = match.image;
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
                  className='w-full aspect-square rounded-lg border-2 border-dashed flex items-center justify-center transition-colors hover:bg-[#21262d] hover:border-[#7d8590]'
                  style={{ borderColor: '#30363d', color: '#7d8590' }}>
                  <span className="material-symbols-outlined text-lg">add</span>
                </button>
              </div>

              {/* 재생 컨트롤 */}
              <div className="flex items-center justify-center gap-4 p-3 border-t" 
                  style={{ borderColor: '#30363d' }}>
                
                  {/* 이전 프레임으로 이동 */}
                  <button 
                    onClick={() => {
                      const nextIdx = state.currentFrameIdx > 0 ? state.currentFrameIdx - 1 : state.frames.length - 1;
                      handleSelectFrame(nextIdx);
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#21262d]"
                    style={{ color: '#7d8590' }}>
                    <span className="material-symbols-outlined text-lg">skip_previous</span>
                  </button>

                  {/* 재생 / 일시정지 */}
                  <button 
                    onClick={() => setIsPlaying(!isPlaying)}
                    className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#21262d]"
                    style={{ color: isPlaying ? '#2f81f7' : '#7d8590' }}>
                    <span className="material-symbols-outlined text-lg">
                      {isPlaying ? 'pause' : 'play_arrow'}
                    </span>
                  </button>
                    
                  {/* 다음 프레임으로 이동 */}
                  <button 
                    onClick={() => {
                      const nextIdx = (state.currentFrameIdx + 1) % state.frames.length;
                      handleSelectFrame(nextIdx); 
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-[#21262d]"
                    style={{ color: '#7d8590' }}>
                    <span className="material-symbols-outlined text-lg">skip_next</span>
                  </button>
              </div>
            </div>
          )}
        </div>

        
        {/* ── 우측 패널 ──────── */}
        <aside className="flex flex-col flex-shrink-0 border-l overflow-y-auto"
          style={{ width: 300, background: '#161b22', borderColor: '#30363d',
            scrollbarWidth: 'thin', scrollbarColor: '#21262d transparent' }}>

          {/* 색상 섹션 */}
          <div className="p-4 border-b" style={{ borderColor: '#30363d' }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#7d8590' }}>Color</div>
            {/* FG / BG 색상 */}
            <div className="flex items-center gap-4 mb-4 px-1">
              <div className="relative">
                <div className="w-12 h-12 rounded-lg border-2 cursor-pointer shadow-sm"
                  style={{ background: fgColor, borderColor: '#30363d' }} title="Foreground" />
                <div className="absolute -bottom-2 -right-2 w-8 h-8 rounded-lg border-2 shadow-sm"
                  style={{ background: '#161b22', borderColor: '#30363d' }} title="Background" />
              </div>
              <div className="flex-1">
                <div className="text-xs mb-1" style={{ color: '#7d8590' }}>HEX</div>
                <input type="text" value={hexInput}
                  onChange={e => setHexInput(e.target.value)}
                  onBlur={applyHex}
                  onKeyDown={e => e.key === 'Enter' && applyHex()}
                  className="w-full text-sm font-bold rounded-lg px-2 py-1.5 outline-none"
                  style={{ background: '#1c2128', border: 'none', color: '#e6edf3' }} />
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
                  <input type="range" min={0} max={255} value={val}
                    className={`flex-1 h-1.5 cursor-pointer ${accent}`} readOnly />
                  <span className="text-xs font-bold w-7 text-right" style={{ color: '#7d8590' }}>{val}</span>
                </div>
              ))}
            </div>
          </div>

          {/* 팔레트 섹션 */}
          <div className="p-4 border-b" style={{ borderColor: '#30363d' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7d8590' }}>Palette</div>
              <div className="flex gap-1">
                {[['add','색상 추가'],['upload','팔레트 가져오기']].map(([icon,tip]) => (
                  <button key={icon} title={tip}
                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-[#21262d]"
                    style={{ color: '#7d8590' }}>
                    <span className="material-symbols-outlined text-sm">{icon}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5 px-1">
              {PALETTE_COLORS.map(c => (
                <button key={c} onClick={() => { setFgColor(c); setHexInput(c) }}
                  className="w-8 h-8 rounded cursor-pointer transition-all border-2 hover:scale-110"
                  style={{ background: c, borderColor: fgColor === c ? '#e6edf3' : 'transparent' }} />
              ))}
            </div>
            <button className="mt-3 text-xs font-bold hover:underline px-1"
              style={{ color: '#2f81f7' }}>Browse Lospec palettes…</button>
          </div>

          {/* 툴 옵션 섹션 */}
          <div className="p-4 border-b" style={{ borderColor: '#30363d' }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#7d8590' }}>Tool Options</div>
            <div className="space-y-4 px-1">
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm" style={{ color: '#7d8590' }}>Brush Size</span>
                  <span className="text-sm font-bold">{brushSize}px</span>
                </div>
                <input type="range" min={1} max={16} value={brushSize}
                  onChange={e => setBrushSize(Number(e.target.value))}
                  className="w-full h-1.5 cursor-pointer accent-[#2f81f7]" />
              </div>
              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <span className="text-sm" style={{ color: '#7d8590' }}>Opacity</span>
                  <span className="text-sm font-bold">{opacity}%</span>
                </div>
                <input type="range" min={0} max={100} value={opacity}
                  onChange={e => setOpacity(Number(e.target.value))}
                  className="w-full h-1.5 cursor-pointer accent-[#2f81f7]" />
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm" style={{ color: '#7d8590' }}>Pixel Perfect</span>
                <button onClick={() => setPixelPerfect(v => !v)}
                  className="w-11 h-6 rounded-full relative transition-all flex-shrink-0"
                  style={{ background: pixelPerfect ? '#2f81f7' : '#30363d' }}>
                  <span className="absolute top-0.5 w-5 h-5 bg-white rounded-full shadow transition-all"
                    style={{ left: pixelPerfect ? 'calc(100% - 22px)' : '2px' }} />
                </button>
              </div>
            </div>
          </div>

          {/* 캔버스 크기 섹션 */}
          <div className="p-4 border-b" style={{ borderColor: '#30363d' }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: '#7d8590' }}>Canvas Size</div>
            <div className="px-1 space-y-2">
              <div className="grid grid-cols-3 gap-1">
                {CANVAS_PRESETS.map(p => {
                  const [w, h] = p.split('×').map(Number)
                  const active = canvasW === w && canvasH === h
                  return (
                    <button key={p} onClick={() => applyCanvasSize(w, h)}
                      className="py-1 text-xs rounded-lg font-bold transition-all border"
                      style={{
                        background: active ? 'rgba(47,129,247,0.15)' : '#1c2128',
                        borderColor: active ? '#2f81f7' : '#30363d',
                        color: active ? '#2f81f7' : '#7d8590',
                      }}>{p}</button>
                  )
                })}
              </div>
              <div className="flex items-center gap-1.5 pt-1">
                <input type="number" value={customW} min={1} max={512}
                  onChange={e => setCustomW(Number(e.target.value))}
                  className="w-16 px-2 py-1 rounded text-xs outline-none text-center font-bold"
                  style={{ background: '#1c2128', border: '1px solid #30363d', color: '#e6edf3' }} />
                <span className="text-xs" style={{ color: '#7d8590' }}>×</span>
                <input type="number" value={customH} min={1} max={512}
                  onChange={e => setCustomH(Number(e.target.value))}
                  className="w-16 px-2 py-1 rounded text-xs outline-none text-center font-bold"
                  style={{ background: '#1c2128', border: '1px solid #30363d', color: '#e6edf3' }} />
                <button onClick={() => applyCanvasSize(customW, customH)}
                  className="flex-1 py-1 rounded text-xs font-bold transition-all hover:opacity-90"
                  style={{ background: '#2f81f7', color: '#fff' }}>Apply</button>
              </div>
            </div>
          </div>
          
          {/* ⏳레이어 섹션 */}
          <div className="p-4 flex-1">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: '#7d8590' }}>Layers</div>
              <div className="flex gap-1">
                {layerButtons.map(([icon,tip, handler]) => (
                  <button key={icon} title={tip}
                    onClick={() => {
                      if(!handler) return;
                      if (icon === 'add') {
                        handler(state.currentFrameIdx);
                      } else if (icon === 'delete') {
                        // deleteLayer는 (frameIdx, layerId) 두 개를 받으므로 맞춰서 전달
                        handler(state.currentFrameIdx, activeLayer);
                      }
                    }}
                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-[#21262d]"
                    style={{ color: '#7d8590' }}>
                    <span className="material-symbols-outlined text-sm">{icon}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="space-y-0.5">
              {([...(state.frames[state.currentFrameIdx]?.layers ?? [])]).reverse().map(layer => (
                <div key={layer.id}
                  onClick={() => selectLayer(state.currentFrameIdx, layer.id)}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm"
                  style={{
                    background: activeLayer === layer.id ? 'rgba(47,129,247,0.1)' : 'transparent',
                    color: activeLayer === layer.id ? '#2f81f7' : '#7d8590',
                    fontWeight: activeLayer === layer.id ? 700 : 400,
                  }}>
                  
                  {/* 레이어 눈 토글 버튼 활성화 */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation(); // 💡 중요: 버튼을 누를 때 부모 div의 selectLayer가 트리거되는 것을 방지!
                      toggleVisibility(state.currentFrameIdx, layer.id);
                    }}
                    className="flex items-center justify-center p-0.5 rounded hover:bg-[#30363d] transition-colors"
                    style={{ color: layer.isVisible ? '#2f81f7' : '#484f58' }}
                  >
                    <span className="material-symbols-outlined text-sm">
                      {layer.isVisible ? 'visibility' : 'visibility_off'}
                    </span>
                  </button>
                  {/* 레이어 썸네일 박스 */}
                  <div className="w-8 h-8 rounded border flex-shrink-0 checkerboard"
                    style={{
                      borderColor: activeLayer === layer.id ? '#2f81f7' : '#30363d',
                    }} />
                    
                  <span className="text-sm truncate flex-1">{layer.name}</span>
                </div>
              ))}
            </div>
          </div>
        </aside>

        {/* ── ⏳AI 가이드 전용 패널 (VS Code Secondary Side Bar 스타일) ── */}
        <div className="flex flex-col flex-shrink-0 border-l transition-all duration-300 ease-in-out overflow-hidden"
          style={{ 
            width: showAIGuide ? 350 : 0, // AI 가이드 온오프 상태에 따라 너비 조절
            background: '#0d1117',        // 메인 패널보다 살짝 더 어두운 배경 (구분감)
            borderColor: '#30363d',
            opacity: showAIGuide ? 1 : 0  // 닫혔을 때 잔상 방지
          }}>
          
          {/* 헤더: VS Code 패널 느낌 */}
          <div className="flex items-center justify-between p-4 border-b" style={{ borderColor: '#30363d' }}>
            <div className="flex items-center gap-2">
              <span className="material-symbols-outlined text-[#2f81f7] text-lg">auto_awesome</span>
              <span className="text-xs font-bold uppercase tracking-widest text-[#e6edf3]">AI Assistant</span>
            </div>
            <button onClick={() => setShowAIGuide(false)} className="hover:text-[#e6edf3] text-[#7d8590]">
              <span className="material-symbols-outlined text-sm">close</span>
            </button>
          </div>

          {/* 컨텐츠: 큼직한 가이드 영역 */}
          <div className="flex-1 p-4 overflow-y-auto custom-scrollbar">
            {/* 여기에 광고나 AI 분석 결과 렌더링 */}
            <div className="w-full aspect-[3/4] mb-4 rounded-xl border-2 border-dashed border-[#30363d] flex items-center justify-center bg-[#161b22]">
              <p className="text-[11px] text-[#484f58] text-center">
                캔버스 분석 중...<br/>(광고 또는 AI 가이드 이미지)
              </p>
            </div>
            
            <div className="space-y-4">
              <div className="p-3 rounded-lg bg-[#1c2128] border border-[#30363d]">
                <p className="text-xs leading-relaxed text-[#8b949e]">
                  <strong className="text-[#2f81f7]">💡 조언:</strong> 현재 캐릭터의 실루엣이 불분명합니다. 외곽선(Outline) 레이어에 좀 더 어두운 색을 사용해 보세요.
                </p>
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* ── 하단 상태바 ──────────── */}
      <footer className="flex items-center gap-6 px-5 flex-shrink-0 border-t text-sm font-bold"
        style={{ height: 42, background: '#161b22', borderColor: '#30363d', color: '#7d8590' }}>
        <span>Canvas: {canvasW} × {canvasH}</span>
        <span className="w-px h-4" style={{ background: '#30363d' }} />
        <span>Zoom: {zoom * 100}%</span>
        <span className="w-px h-4" style={{ background: '#30363d' }} />
        <span>{cursorPos.x >= 0 ? `Cursor: ${cursorPos.x}, ${cursorPos.y}` : 'Cursor: —'}</span>
        <span className="w-px h-4" style={{ background: '#30363d' }} />
        <span>Tool: {activeTool.charAt(0).toUpperCase() + activeTool.slice(1)}</span>
        <span className="w-px h-4" style={{ background: '#30363d' }} />
        <span>Active: {layers.find(l => l.id === activeLayer)?.name}</span>
        <div className="ml-auto flex items-center gap-4">
          <span>{layers.length} layers</span>
          <span className="w-px h-4" style={{ background: '#30363d' }} />
          {unsaved
            ? <span style={{ color: '#f59e0b' }}>● Unsaved</span>
            : <span style={{ color: '#3fb950' }}>● Saved</span>}
        </div>
      </footer>
    </div>
  )
}
