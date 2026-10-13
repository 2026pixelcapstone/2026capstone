import React, { useRef, useState, useEffect, useCallback, useMemo } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { CanvasState } from '../type/editor'
import {createInitialCanvasData, DRAW_TOOLS, SELECT_TOOLS, SHAPE_TOOLS, VIEW_TOOLS, PALETTE_COLORS, ZOOM_LEVELS, CANVAS_PRESETS, MAX_CANVAS_SIZE} from '../constants/editor/editor'
import {useCanvasView} from '../hooks/editor/useCanvasView'
import EditorSaveProjectModal from '../components/editor/EditorSaveProjectModal'
import EditorOpenProjectModal from '../components/editor/EditorOpenProjectModal'
import { useAuthStore } from '../store/authStore'
import { toast } from '../store/toastStore'
import {useFrame} from '../hooks/editor/useFrame'
import { useHistory } from '../hooks/editor/useHistory'
import { applyPalette, GIFEncoder, quantize } from 'gifenc'
import { useLayers as useLayer } from '../hooks/editor/useLayer'
import { Stage, Layer as KonvaLayer, Layer, Rect } from 'react-konva'
import Konva from 'konva'
import { LayerImageRenderer } from '../components/editor/LayerImageRender'
import { getCacheKey, getLabel, getLayerImageData } from '../utils/editorUtils'
import { ColorPickerModal } from '../components/ColorPickerModal'
import { aiApi } from '../api/aiApi'
import type { RelatedPost } from '../api/aiApi'
import { extractUsedColors } from '../utils/colorExtract'
import { getErrorMessage } from '../lib/errorUtils'
import { parsePpit, serializePpit } from '../lib/ppit'
import { canvasDataToPpit, ppitToCanvasData } from '../utils/ppitConvert'
import MenuBar from '../components/editor/MenuBar'
import PaletteBrowserModal, { type PaletteApplyMode } from '../components/editor/PaletteBrowserModal'
import PaletteFormModal from '../components/palette/PaletteFormModal'
import { paletteApi } from '../api/paletteApi'
import { useLayerCanvas } from '../hooks/editor/useLayerCanvas'
import { useLayerCommit } from '../hooks/editor/useLayerCommit'
import { useEditorProject } from '../hooks/editor/project/useEditorProject'
import { useCanvasTool } from '../hooks/editor/canvasTool/useCanvasTool'
import { useCanvasDrawing } from '../hooks/editor/useCanvasDrawing'
import { useColor } from '../hooks/editor/color/useColor'
import { usePalette } from '../hooks/editor/color/usePalette'
import { useCanvasSize } from '../hooks/editor/useCanvasSize'

const initialCanvasData = createInitialCanvasData(); // 캔버스 데이터 초기화 

// ── 컴포넌트 ──────────────────────────────────────────
export default function EditorPage() {
  // ── Ref & Navigation ──────────────────────────
  const stageRef = useRef<Konva.Stage>(null);
  const isDirty =  useRef(false); 
  const ppitInputRef = useRef<HTMLInputElement>(null)   // .ppit 불러오기 파일 입력

  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams()
  const { isLoggedIn } = useAuthStore()

  
  // ── status & state ──────────────────────────
  // ── 도구 관련 ──────────────
  const [opacity, setOpacity]         = useState(100)

  // ── CanvasData 관련 ──────────────
  const [activeFrameId, setActiveFrameId] = useState<string | null>(
    initialCanvasData.frames[0]?.id || null
  )
  const [isPlaying, setIsPlaying] = useState(false);
  const [showAnim, setShowAnim]       = useState(false)
  const [previewFrameIdx, setPreviewFrameIdx] = useState(0)

  const [activeLayerId, setActiveLayerId] = useState<string | null>(
    initialCanvasData.frames[0]?.layers[0].id || null
  );

  const [showGridLines, setShowGridLines] = useState(true)

  // ── AI 가이드 ──────────────
  const[showAIGuide, setShowAIGuide] = useState(false);
  // ── AI 색 팔레트 추천 상태 ──────────────────────────────
  // ── 커뮤니티 팔레트 연동(C-1): 가져오기 모달 / 현재 팔레트 저장 모달 ──
  const [paletteBrowserOpen, setPaletteBrowserOpen] = useState(false);
  const [paletteSaveOpen, setPaletteSaveOpen] = useState(false);
  const [aiPrompt, setAiPrompt] = useState('');       // 원하는 느낌(선택) 자연어
  const [aiColors, setAiColors] = useState<string[]>([]); // AI가 추천한 색(스와치로 표시)
  const [aiLoading, setAiLoading] = useState(false);
  // ── AI 태그로 색 찾기 상태 ──
  const [tagInput, setTagInput] = useState('');           // 콤마 구분 태그 입력
  const [aiTagColors, setAiTagColors] = useState<string[]>([]);
  const [aiTagLoading, setAiTagLoading] = useState(false);
  // ── AI 컨셉 도우미 상태 (자연어 → 색 + 관련 작품) ──
  const [conceptInput, setConceptInput] = useState('');            // 자연어 컨셉 설명
  const [conceptColors, setConceptColors] = useState<string[]>([]);
  const [conceptKeywords, setConceptKeywords] = useState<string[]>([]);
  const [conceptRelated, setConceptRelated] = useState<RelatedPost[]>([]);
  const [conceptLoading, setConceptLoading] = useState(false);
  const conceptReqIdRef = useRef(0);   // 컨셉 추천 세대 가드(오래된/실패 응답이 최신 결과 덮지 않도록)

  // ── 프로젝트 관련  ──────────────
  const [openProjectModalOpen, setOpenProjectModalOpen] = useState(false)
  const [editingTitle, setEditingTitle] = useState(false) 
  const [unsaved, setUnsaved] = useState(false);
  
  // ── hook ──────────────────────────
  // ── useHistory 훅 ──────────────
  const {state, setWithHistory, undo, redo, reset} = useHistory<CanvasState>(initialCanvasData);

  // ── useFrame 훅 ──────────────
  const{addFrame, deleteFrame, reorderFrames} = useFrame({
    frames: state.frames,
    activeFrameId,
    setWithHistory,
    setActiveFrameId,
    setActiveLayerId,
    setUnsaved,
  });
  // 활성화된 프레임 찾기
  const currentFrame = state.frames.find((f) => f.id === activeFrameId) ?? state.frames[0];

  // ── 레이어 훅 ──────────────
  const { addLayer, deleteLayer, toggleVisibility, reorderLayers, resetLayerCounters} = useLayer({
    frames: state.frames,
    setWithHistory, 
    activeLayer: activeLayerId, 
    setActiveLayer: setActiveLayerId,
    setUnsaved,
  });

  // ── useLayerCanvas 훅 ──────────────
  const { ensureLayerCanvas, peekLayerCanvas, clearAllLayerCanvas } = useLayerCanvas({
    frames: state.frames,
    width: state.width,
    height: state.height,
  });
  
  // ── useLayerCommit 훅 ──────────────
  const { commitLayerChanges } = useLayerCommit({
    activeFrameId,
    activeLayerId,
    peekLayerCanvas,
    setWithHistory,
  });

  // ── useColor 훅 ──────────────
  const { isHexModal, hexInput, fgColor, rgb, setIsHexModal, setHexInput, setFgColor, applyHex, handleRgbChange } = useColor();
  
  // ── usePalette 훅 ──────────────
  const {paletteColors, setPaletteColors, selectPaletteColor, addColorsToPalette} = usePalette({
    setFgColor,
    setHexInput,
  })
  // ── useCanvasTool 훅 ──────────────
  const { applyDirectTool, activeTool, setActiveTool, brushSize, setBrushSize, 
    pixelPerfect, setPixelPerfect
  } = useCanvasTool({
    fgColor,
    isDirty,
    setUnsaved,
    selectPaletteColor,
  });

  // ── useCanvasDrawing 훅 ──────────────
  const {cursorPos, handleMouseDown, handleMouseMove, handleMouseUp, handleMouseLeave} = useCanvasDrawing({
    stageRef,
    isDirty,
    state,
    activeFrameId,
    activeLayerId,
    activeTool,
    brushSize,
    fgColor,
    setUnsaved,
    commitLayerChanges,
    applyDirectTool,
    ensureLayerCanvas,
  });

  // ── CanvasSize 훅 ──────────────
  const {
    customW, customH, isScaleImage, setCustomW, setCustomH, setIsScaleImage, applyCanvasSize
  } = useCanvasSize({
      peekLayerCanvas,
      width: state.width,
      height: state.height,
      frame: state.frames,
      setWithHistory,
      setUnsaved,
  });

  // ── View 훅 ──────────────
  const {zoom, setZoomIdx} = useCanvasView({ width: state.width, height: state.height });

  // ── useEditorProject 훅 ──────────────
  const { 
    handleNewProject, handleSave, saving, openSaveModal, isSaveModalOpen, setIsSaveModalOpen, 
    projectId, setProjectId, projectTitle, setProjectTitle, isPublic
  } = useEditorProject({
    isLoggedIn,
    stageRef,
    state,
    unsaved,
    setUnsaved,
    setCustomW,
    setCustomH,
    reset,
    setActiveFrameId,
    setActiveLayerId,
    resetLayerCounters,
    peekLayerCanvas,
    clearAllLayerCanvas,
  });

  // ── Navigation / Page Control ───────────────────────────────────
  const handleBackToMain = useCallback((e?: React.MouseEvent) => {
    e?.preventDefault();
    if (unsaved && !window.confirm('저장하지 않은 변경사항이 있습니다. 계속할까요?')) return;
    navigate('/');
  }, [unsaved, navigate])

  // ── 현재 프레임 및 레이어 인덱스 동기화 ────────────────
  useEffect(() => {
    if(state.frames.length === 0) return;

    if(!currentFrame) return;
    
    // 프레임 ID 유효성 보정 (activeFrameId가 유실된 경우)
    if(activeFrameId !== currentFrame.id){
      setActiveFrameId(currentFrame.id);
    }

    // 레이어 유효성 보정
    if(currentFrame.layers.length > 0){
      const hasActiveLayer = currentFrame.layers.some((l) => l.id === activeLayerId)
      if (!hasActiveLayer) {
        setActiveLayerId(currentFrame.layers[0].id);
      }
    }
  }, [currentFrame?.id, currentFrame?.layers, activeFrameId, activeLayerId, setActiveFrameId, setActiveLayerId]);

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
  }, [activeLayerId, zoom, state.width, state.height]); // 프레임이 바뀌거나 줌이 바뀔 때 동기화

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

  const loadImage = (src: string): Promise<HTMLImageElement | null> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => resolve(null); // 에러 발생 시 세이프가드로 null 반환
      img.src = src;
    });
  };

  const handleExportImage = useCallback(async() => {
    const stage = stageRef.current
    if (!stage) return

    const safeTitle = projectTitle.replace(/\s+/g, '_')
    
    // 단일 프레임 처리 (PNG 저장)
    if(state.frames.length <= 1){
      try{
        toast.info('PNG 이미지를 내보내는 중입니다...');

        //const oldScale = stage.scale();
        //const oldPos = stage.position();
        
        const currentFullImage = stage.toDataURL({pixelRatio: 1}); // 원본 크기 1:1 유지
        
        const link = document.createElement('a');
        link.download = `${safeTitle}.png`;
        link.href = currentFullImage;
        link.click();
        toast.success('PNG 내보내기 완료!');
      } catch(err){
        console.error(err);
        toast.error('PNG 내보내기 중 오류가 발생했습니다.');
      }
      return;
    }
    
    // 다중 프레임 처리(GIF 처리)
    try{
      toast.info('GIF 프레임 생성 및 변환을 시작합니다...');

      // GIF 추출 최적화 버전
      // 모든 프레임/레이어의 un-cached pixelData를 미리 병렬로 로드
      const uncachedLayers: { key: string; src: string }[] = [];

      state.frames.forEach((frame) => {
        (frame.layers ?? []).forEach((layer) => {
          const cacheKey = getCacheKey(frame.id, layer.id);
          const cachedCanvas = peekLayerCanvas(cacheKey);

          // 메모리 캐시가 없지만 pixelData 문자열이 존재하는 경우에만 로드 대상에 추가
          if(!cachedCanvas && layer.pixelData && layer.pixelData.trim() !== ''){
            uncachedLayers.push({ key: cacheKey, src: layer.pixelData });
          }
        });
      });
      
      // 모든 이미지를 동시로 디코딩
      const loadedEntries = await Promise.all(
        uncachedLayers.map(async({ key, src }) => {
          const img = await loadImage(src);
          return [key, img] as const;
        })
      );

      // 빠르게 꺼내쓸 수 있도록 Map 객체로 변환
      const imageMap = new Map<string, HTMLImageElement | null>(loadedEntries);
    
      // 3. GIF 인코딩 프로세스
      const gif = GIFEncoder()

      // 가상 도화지(가상 캔버스) 생성 및 안전장치
      const frameCanvas = document.createElement('canvas');
      frameCanvas.width = state.width;
      frameCanvas.height = state.height;
      const fCtx = frameCanvas.getContext('2d', { willReadFrequently: true });

      if(fCtx){
        fCtx.imageSmoothingEnabled = false;
        // 모든 프레임을 순서대로 필름 인코딩 루프 돌리기
        for(let fIdx = 0; fIdx < state.frames.length; fIdx++){
          const currentFrame = state.frames[fIdx];
          if (!currentFrame || !currentFrame.id) continue;
          
          fCtx.clearRect(0, 0, state.width, state.height)

          const currentFrameLayers = currentFrame.layers ?? [];
          
          for(const layer of currentFrameLayers){
            if(!layer.isVisible || !layer.id || !layer.opacity) continue // 보이지 않는 레이어는 합성에서 제외
            
            const cacheKey = getCacheKey(currentFrame.id, layer.id);
            const cachedCanvas = peekLayerCanvas(cacheKey);

            fCtx.globalAlpha = (layer.opacity ?? 100) / 100;

            if(cachedCanvas){
              // 1순위: 메모리 캔버스 캐시 사용
              fCtx.drawImage(cachedCanvas, 0, 0, state.width, state.height);
            }
            else {
              // 2순위: 미리 로드해둔 imageMap에서 즉시 동기 추출
              const img = imageMap.get(cacheKey);
              if(img){
                fCtx.drawImage(img, 0, 0, state.width, state.height);
              }
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
          });
        }
      }
      frameCanvas.width = 0;
      frameCanvas.height = 0;

      gif.finish()

      const blob = new Blob([gif.bytes()], { type: 'image/gif' });
      downloadBlob(blob, `${safeTitle}.gif`);

      toast.success('GIF 애니메이션 내보내기 완료!');
    }catch(err){
      console.error(err);
      toast.error('GIF 내보내기 처리 중 오류가 발생했습니다.');
    }
  }, [projectTitle, state.frames, zoom, state.width, state.height])

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

    const firstFrame = cd.frames[0];
    const firstLayer = firstFrame?.layers[0];
    
    setActiveFrameId(firstFrame?.id ?? null);
    setActiveLayerId(firstLayer?.id ?? null);

    setCustomW(cd.width); 
    setCustomH(cd.height);
    reset(cd);

    setProjectId(null);  // 불러온 .ppit은 새 작업(저장된 프로젝트 아님)
    setProjectTitle(title || 'Untitled Project');
    setUnsaved(true);

    // 새 작업이므로 URL의 projectId 제거 (새로고침 시 옛 서버 프로젝트 재로드 방지)
    setSearchParams(prev => {
      const p = new URLSearchParams(prev)
      p.delete('projectId')
      return p
    }, { replace: true });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reset, setActiveLayerId, setActiveFrameId, setProjectId, setSearchParams])

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

  // ── 커뮤니티 팔레트에서 진입: ?palette=<id> → 에디터 팔레트를 그 팔레트로 교체 ──
  useEffect(() => {
    const raw = searchParams.get('palette')
    if (!raw) return
    const id = Number(raw)
    let cancelled = false
    ;(async () => {
      try {
        if (!Number.isInteger(id) || id <= 0) throw new Error('bad id')
        const p = (await paletteApi.get(id)).data.data
        if (cancelled) return
        setPaletteColors(p.colors)
        if (p.colors[0]) setFgColor(p.colors[0])
        toast.success(`'${p.name}' 팔레트를 불러왔습니다.`)
      } catch {
        if (!cancelled) toast.error('팔레트를 불러오지 못했습니다.')
      } finally {
        // palette 파라미터 제거(새로고침 시 재적용 방지)
        if (!cancelled) {
          setSearchParams(prev => {
            const next = new URLSearchParams(prev)
            next.delete('palette')
            return next
          }, { replace: true })
        }
      }
    })()
    return () => { cancelled = true }
    // eslint-disable-next-line react-hooks/exhaustive-deps -- 진입 시 1회
  }, [])

  /** 팔레트 가져오기 모달에서 고른 색 적용 — 교체 또는 뒤에 추가(중복 제외) */
  const applyPaletteFromBrowser = (colors: string[], mode: PaletteApplyMode, name: string) => {
    if (mode === 'replace') {
      setPaletteColors(colors)
      if (colors[0]) setFgColor(colors[0])
      toast.success(`'${name}' 팔레트로 바꿨습니다.`)
    } else {
      addColorsToPalette(colors)
    }
    setPaletteBrowserOpen(false)
  }

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

  const handleOpenPpit = () => {
    ppitInputRef.current?.click();
  }

  // ── RGB ─────────────────
  // 툴 버튼 공통 스타일
  const toolBtn = (id: string) => ({
    background: activeTool === id ? 'color-mix(in srgb, var(--color-primary) 15%, transparent)' : 'transparent',
    color: activeTool === id ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
  })

  // AI 색 팔레트 추천 — 현재 프레임 캔버스(PNG) + 사용된 색 + 자연어 → 서버 → 어울리는 색
  const handleSuggestPalette = async () => {
    const stage = stageRef.current;
    if (!stage) return;
    setAiLoading(true);
    try {
      // 원본 픽셀 크기로 추출(줌 상태에서 이미지·스캔 범위가 zoom²로 커지는 것 방지)
      const pixelRatio = 1;
      const imageBase64 = stage.toDataURL({ pixelRatio });            // 현재 프레임 PNG(data URL)
      const currentColors = extractUsedColors(stage.toCanvas({ pixelRatio })); // 실제 사용색
      const res = await aiApi.suggestPalette({
        imageBase64,
        currentColors,
        description: aiPrompt.trim() || undefined,
      });
      // 런타임 응답 검증(TS 제네릭은 실제 형식을 보장하지 않음) — 배열 + #RRGGBB만 수용
      const colors = res.data?.data?.colors;
      if (
        !Array.isArray(colors) ||
        colors.length === 0 ||
        !colors.every((c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c))
      ) {
        throw new Error('AI 색 추천 응답 형식이 올바르지 않습니다.');
      }
      setAiColors(colors);
    } catch (e) {
      toast.error(getErrorMessage(e, 'AI 색 추천에 실패했습니다.'));
    } finally {
      setAiLoading(false);
    }
  };

  // 태그로 색 찾기 — 콤마 구분 태그 → 서버 → 어울리는 색
  const handleSuggestByTags = async () => {
    const tags = tagInput.split(',').map((t) => t.trim()).filter(Boolean);
    if (tags.length === 0) {
      toast.error('태그를 하나 이상 입력해 주세요.');
      return;
    }
    setAiTagLoading(true);
    try {
      const res = await aiApi.suggestPaletteByTags({ tags });
      const colors = res.data?.data?.colors;
      if (
        !Array.isArray(colors) ||
        colors.length === 0 ||
        !colors.every((c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c))
      ) {
        throw new Error('AI 색 찾기 응답 형식이 올바르지 않습니다.');
      }
      setAiTagColors(colors);
    } catch (e) {
      toast.error(getErrorMessage(e, 'AI 색 찾기에 실패했습니다.'));
    } finally {
      setAiTagLoading(false);
    }
  };

  // 컨셉 도우미 — 자연어 설명 → 색 팔레트 + 관련 작품(우리 갤러리)
  const handleSuggestConcept = async () => {
    const description = conceptInput.trim();
    if (!description) {
      toast.error('컨셉 설명을 입력해 주세요.');
      return;
    }
    // 새 요청 시작 — 이전 결과를 즉시 비워, 실패/다른 컨셉 응답이 이전 결과와 섞여 오인 선택되는 것 방지
    const reqId = ++conceptReqIdRef.current;
    setConceptColors([]);
    setConceptKeywords([]);
    setConceptRelated([]);
    setConceptLoading(true);
    try {
      const res = await aiApi.suggestConcept({ description });
      if (conceptReqIdRef.current !== reqId) return;   // 더 최신 요청이 있으면 이 응답은 폐기
      const data = res.data?.data;
      const colors = data?.colors;
      if (
        !Array.isArray(colors) ||
        colors.length === 0 ||
        !colors.every((c) => typeof c === 'string' && /^#[0-9a-fA-F]{6}$/.test(c))
      ) {
        throw new Error('AI 컨셉 추천 응답 형식이 올바르지 않습니다.');
      }
      setConceptColors(colors);
      // 키워드·관련 작품은 없어도 색은 표시(옵셔널) — 형식 이상 시 빈 목록으로 방어
      setConceptKeywords(
        Array.isArray(data?.keywords)
          ? data.keywords.filter((k): k is string => typeof k === 'string')
          : [],
      );
      setConceptRelated(
        Array.isArray(data?.relatedPosts)
          ? data.relatedPosts
              // postId·title이 유효한 것만 수용(title은 alt/aria 이름에 필요)
              .filter(
                (p): p is RelatedPost =>
                  !!p && typeof p.postId === 'number' && typeof p.title === 'string',
              )
              // thumbnailUrl이 문자열이 아니면 null로 정규화(이미지 렌더 깨짐 방지)
              .map((p) => ({
                ...p,
                thumbnailUrl: typeof p.thumbnailUrl === 'string' ? p.thumbnailUrl : null,
              }))
          : [],
      );
    } catch (e) {
      if (conceptReqIdRef.current !== reqId) return;   // 최신 요청이 아니면 이 실패 토스트도 무시
      toast.error(getErrorMessage(e, 'AI 컨셉 추천에 실패했습니다.'));
    } finally {
      if (conceptReqIdRef.current === reqId) setConceptLoading(false);
    }
  };

  // ── 애니메이션 ───────────────────────────────────
  // 재생 로직
  useEffect(() => {
    if(!isPlaying){
      setPreviewFrameIdx(0); // 재생 중이 아니면 항상 첫 프레임으로 초기화
      return;
    }
    const totalFrames = state.frames.length;
    if(totalFrames <= 1) return;

    const interval = setInterval(() => {
      setPreviewFrameIdx((prevIdx) => (prevIdx + 1) % totalFrames);
    }, 100);
    
    return () => clearInterval(interval);
  }, [isPlaying, state.frames.length, setPreviewFrameIdx]);

  // 프레임 수가 바뀌면 미리보기 인덱스를 0으로 초기화
  useEffect(() => {
    setPreviewFrameIdx(0);
  }, [state.frames.length]);

  // ── 프레임 ───────────────────────────────────
  /* 프레임 선택 시 실행되는 함수 */
  const handleSelectFrame = (nextFrameId: string) => {
    const canvas = stageRef.current;
    if (!canvas || !activeLayerId || !activeFrameId) return;

    if(activeFrameId === nextFrameId) return;

    // 이동하려는 대상 프레임 탐색
    const nextFrame = state.frames.find((f) => f.id === nextFrameId);
    if(!nextFrame) return;

    const nextActiveLayerId = nextFrame?.layers[0]?.id || null;

    if (isDirty.current) {
        const cacheKey = getCacheKey(activeFrameId, activeLayerId);
        const cachedCanvas = peekLayerCanvas(cacheKey);
        if(cachedCanvas){
          const layerImageData = getLayerImageData(cachedCanvas);
          
          setWithHistory((prev) => ({
            ...prev,
            frames: prev.frames.map((frame) =>
              frame.id === activeFrameId
                ? { 
                  ...frame,
                  layers: frame.layers.map((layer) =>
                    layer.id === activeLayerId 
                    ? {...layer, pixelData: layerImageData}
                    : layer
                  )}
                : frame
            ),
          }));
        }
        isDirty.current = false;
    } 
    // 4. 새로운 활성 프레임 및 레이어로 전환
    setActiveFrameId(nextFrame.id);
    setActiveLayerId(nextActiveLayerId); // 붓의 타깃 동기화
  }


  // -------- 프레임 순서 변경 -----------
  const FRAME_DND_MIME = "application/x-pixelhub-frame-index";

  const handleFrameDragStart = (e: React.DragEvent<HTMLDivElement>, frameIdx: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(FRAME_DND_MIME, String(frameIdx));
  }

  const handleFrameDrop = (e: React.DragEvent<HTMLDivElement>, targetIdx: number) => {
    e.preventDefault();
    const rawSourceIdx = e.dataTransfer.getData(FRAME_DND_MIME);
    if(!/^\d+$/.test(rawSourceIdx)) return;

    const sourceIdx = Number(rawSourceIdx);
    const frameCount = state.frames.length;
    
    if(sourceIdx >= frameCount || targetIdx < 0 || targetIdx >= frameCount) return;

    if(sourceIdx !== targetIdx){
      reorderFrames(sourceIdx, targetIdx);
    }

  }
  // ── 레이어 ───────────────────────────────────
  const handleAddLayer = () => {
    addLayer(activeFrameId); 
  }
  const handleDeleteLayer = () => {
    deleteLayer(activeFrameId, activeLayerId)
  }
  
  const selectLayer = useCallback((layerIdToSelect: string) => {
    if(activeLayerId === layerIdToSelect) return;

    const stage = stageRef.current;
    if (!stage || !activeLayerId || !activeFrameId) {
        // 기존 선택된 레이어나 활성 프레임이 없다면 즉시 선택 후 종료
        setActiveLayerId(layerIdToSelect);
        return;
    }

    // 변경 사항(Dirty)이 있을 때만 이전 작업 레이어의 픽셀 데이터 저장
    if(isDirty.current){
      const cacheKey = getCacheKey(activeFrameId, activeLayerId);
      const cachedCanvas = peekLayerCanvas(cacheKey);

     if (cachedCanvas) {
        const layerImageData = getLayerImageData(cachedCanvas)
        
        setWithHistory((prev) => {
          const updatedFrames = prev.frames.map((frame) => {
            if (frame.id !== activeFrameId) return frame;

            // 현재 프레임 내부에서 작업 중이던 레이어의 pixelData를 최신화
            const updatedLayers = frame.layers.map((layer) => 
                layer.id === activeLayerId ? { ...layer, pixelData: layerImageData } : layer
            );
            return { ...frame, layers: updatedLayers };
          });

          return {
              ...prev,
              frames: updatedFrames,
          };
        });
      }
      isDirty.current = false;
    }
    setActiveLayerId(layerIdToSelect);
  }, [activeFrameId, activeLayerId, setWithHistory, setActiveLayerId, stageRef])
  
  // 1. 컴포넌트 내부 상단에 배열을 변수로 분리 (as const 적용)
  const layerButtons = [
    ['add', '레이어 추가', handleAddLayer],
    ['delete', '레이어 삭제', handleDeleteLayer]
  ] as const;

  // -------- 레이어 순서 변경 -----------
  const LAYER_DND_MIME = "application/x-pixelhub-layer-index";
  
  // 순서가 뒤집힌 배열을 다루기 위해 실제 원본 인덱스를 포함한 객체 배열을 만듭니다.
  const reversedLayersWithIdx = useMemo(() => { // UI용 역순 배열을 useMemo로 감싸서 최신 상태와 동기화
    return (currentFrame?.layers ?? [])
      .map((layer, index) => ({ layer, originalIndex: index }))
      .reverse();
  }, [currentFrame.layers]);

  // 드래그하는 레이어의 '원본 인덱스'를 저장합니다.
  // 레이어 드래그 시작
  const handleLayerDragStart = (e: React.DragEvent<HTMLDivElement>, index: number) => {
    e.dataTransfer.effectAllowed = "move";
    e.dataTransfer.setData(LAYER_DND_MIME, String(index)); // 내부 레이어 DnD 전용 값
  }

  // 레이어를 내려놓음
  const handleLayerDrop = (e: React.DragEvent<HTMLDivElement>, targetIndex: number) => {
    e.preventDefault();
    const rawSourceIndex = e.dataTransfer.getData(LAYER_DND_MIME);
    if (!/^\d+$/.test(rawSourceIndex)) return;

    const sourceIndex = Number(rawSourceIndex);

    const layerCount = currentFrame.layers.length ?? 0;
    
    if (sourceIndex >= layerCount || targetIndex < 0 || targetIndex >= layerCount) return;

    if(sourceIndex !== targetIndex){
      reorderLayers(activeFrameId, sourceIndex, targetIndex);
    }
  }

  // drop 이벤트를 허용하기 위해 기본 동작을 막습니다.
  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault(); 
  };

  return (
    // 에디터는 뷰포트 전체 사용 (MainLayout의 pt-14 무시)
    <div className="fixed inset-0 top-0 flex flex-col" style={{ background: 'var(--color-background)', color: 'var(--color-on-surface)', zIndex: 60 }}>
      <EditorSaveProjectModal
        isOpen={isSaveModalOpen}
        onClose={() => setIsSaveModalOpen(false)}
        onSave={handleSave}
        initialTitle={projectTitle}
        initialIsPublic={isPublic}
        saving={saving}
      />

      <EditorOpenProjectModal
        isOpen={openProjectModalOpen}
        onClose={() => setOpenProjectModalOpen(false)}
        onSelect={handleOpenProject}
      />

      {paletteBrowserOpen && (
        <PaletteBrowserModal onClose={() => setPaletteBrowserOpen(false)} onApply={applyPaletteFromBrowser} />
      )}
      {paletteSaveOpen && (
        <PaletteFormModal
          initialName={projectTitle ? `${projectTitle} 팔레트` : ''}
          initialColors={paletteColors}
          onClose={() => setPaletteSaveOpen(false)}
          onSaved={p => { setPaletteSaveOpen(false); toast.success(`'${p.name}' 팔레트를 커뮤니티에 저장했습니다.`) }}
        />
      )}

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
        <div className="flex items-center h-full">
          {/* 로고 */}
          <a href="/" onClick={handleBackToMain} className="flex items-center gap-1.5 font-bold text-sm px-4 h-full hover:bg-surface-container transition-colors"
            style={{ color: 'var(--color-primary)' }}>
            <span className="material-symbols-outlined text-base">grid_view</span>
            PixelPilot
          </a>

          <div 
            className="w-px h-5 mx-1" // w -> 1픽셀, h -> 20px, mx -> 좌우 간격 4px씩
            style={{ background: 'var(--color-surface-container-highest)' }} 
          />
              <MenuBar
                fileActions={{
                  handleNewProject,
                  setOpenProjectModalOpen,
                  handleOpenPpit,
                  openSaveModal,
                  handleExportImage,
                  handleExportPpit,
                  handleBackToMain
                }}
                editActions={{
                  undo,
                  redo,
                }}
                viewActions={{
                  setZoomIdx,
                  showGridLines,
                  setShowGridLines,
                }}
                layerActions={{
                  handleAddLayer,
                  handleDeleteLayer
                }}
                pixelGuides={{
                  showAIGuide,
                  setShowAIGuide,
                }}
              />
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
              <button key={t.id} title={getLabel(t.label)} onClick={() => setActiveTool(t.id)}
                className="w-14 h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer"
                style={toolBtn(t.id)}>
                <span className="material-symbols-outlined text-2xl">{t.icon}</span>
              </button>
            ))}
          </div>

          {/* 선택 도구 */}
          <div className="flex flex-col items-center gap-1 w-full px-2 pb-3 mb-1 border-b" style={{ borderColor: 'var(--color-outline)' }}>
            {SELECT_TOOLS.map(t => (
              <button key={t.id} title={getLabel(t.label)} onClick={() => setActiveTool(t.id)}
                className="w-14 h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer"
                style={toolBtn(t.id)}>
                <span className="material-symbols-outlined text-2xl">{t.icon}</span>
              </button>
            ))}
          </div>

          {/* 도형 도구 */}
          <div className="flex flex-col items-center gap-1 w-full px-2 pb-3 mb-1 border-b" style={{ borderColor: 'var(--color-outline)' }}>
            {SHAPE_TOOLS.map(t => (
              <button key={t.id} title={getLabel(t.label)} onClick={() => setActiveTool(t.id)}
                className="w-14 h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer"
                style={toolBtn(t.id)}>
                <span className="material-symbols-outlined text-2xl">{t.icon}</span>
              </button>
            ))}
          </div>

          {/* 뷰 도구 (하단 고정) */}
          <div className="flex flex-col items-center gap-1 w-full px-2 mt-auto">
            {VIEW_TOOLS.map(t => (
              <button key={t.id} title={getLabel(t.label)} onClick={() => setActiveTool(t.id)}
                className="w-14 h-14 flex items-center justify-center rounded-xl transition-all cursor-pointer"
                style={toolBtn(t.id)}>
                <span className="material-symbols-outlined text-2xl">{t.icon}</span>
              </button>
            ))}
          </div>
        </aside>

         {/* ── 프레임 패널 ─────────────────────────────── */}
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
                    const isActive = frame.id === activeFrameId;
                    return(
                      <div
                        key = {frame.id}
                        draggable
                        onClick={() => handleSelectFrame(frame.id)} // 프레임 선택 기능
                        onDragStart={(e) => handleFrameDragStart(e, index)} // 드래그 시작
                        onDragOver={(e) => handleDragOver(e)} // 드래그 오버 허용
                        onDrop={(e) => handleFrameDrop(e, index)} // 드롭
                        className='relative group rounded-lg border-2 p-1 cursor-pointer'
                        style={{
                          borderColor: isActive ? 'var(--color-primary)' : 'var(--color-outline)',
                          background: isActive ? 'var(--color-surface-container-low)' : 'transparent'
                        }}>

                        <button onClick={(e) => {
                          e.stopPropagation(); // 클릭 이벤트가 부모로 퍼지는 것 방지
                          deleteFrame(frame.id);
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
                      if(state.frames.length === 0) return;

                      const currentIdx = state.frames.findIndex((f) => f.id === activeFrameId);
                      const safeIdx = currentIdx >= 0 ? currentIdx : 0;
                      
                      // 이전 프레임 idx 가공 및 주입
                      const prevIdx = safeIdx >= 1 ? safeIdx - 1 : state.frames.length - 1;
                      const targetFrame = state.frames[prevIdx];
                      if(targetFrame){
                        handleSelectFrame(targetFrame.id); 
                      }
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
                      const currentIdx = state.frames.findIndex((f) => f.id === activeFrameId);
                      const safeIdx = currentIdx >= 0 ? currentIdx : 0; 
                      
                      const nextIdx = (safeIdx + 1) % state.frames.length;
                      const targetFrame = state.frames[nextIdx]

                      if(targetFrame){
                        handleSelectFrame(targetFrame.id); 
                      }
                    }}
                    className="w-10 h-10 flex items-center justify-center rounded-lg hover:bg-surface-container"
                    style={{ color: 'var(--color-on-surface-variant)' }}>
                    <span className="material-symbols-outlined text-lg">skip_next</span>
                  </button>
              </div>
            </div>
          )}
        </div>
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

          {/* 애니메이션 프리뷰 */}
          <div className="absolute top-4 right-4 w-48 bg-[#1e2329] rounded-lg shadow-xl border border-gray-700 flex flex-col overflow-hidden z-50">
            <div className="aspect-square checkerboard rounded overflow-hidden flex items-center justify-center relative">
              {(() => {
                const safePreviewFrameIdx = Math.max(0, Math.min(previewFrameIdx, state.frames.length - 1));
                // 레이어 탐색, 보이고 pixelData가 존재하는 레이어 중 첫 번째 레이어를 타깃으로 잡음
                const layerPreviews = (state.frames[safePreviewFrameIdx].layers ?? [])
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

          {/* 캔버스 래퍼 — backgroundColor로 연회색 보장 */}
          <div className="relative shadow-2xl"
              style={{ 
                width: state.width, 
                height: state.height,
                transform: `scale(${zoom})`,
                transformOrigin: 'center center',
                backgroundColor: '#e8e8e8',
                imageRendering: 'pixelated'
            }}
          >
            {/* 픽셀 그리드 오버레이 */}
            {showGridLines && zoom >= 8 && (
              <div className="absolute inset-0 pointer-events-none z-20"
                style={{
                  backgroundImage: `linear-gradient(rgba(80,80,80,0.25) ${1/zoom}px, transparent 0), linear-gradient(90deg, rgba(80,80,80,0.25) ${1/zoom}px, transparent 0)`,
                  backgroundSize: `1px 1px`,
                }} />
            )}
            <Stage
              ref={stageRef}
              width={state.width}
              height={state.height}
              pixelRatio={1}
              style={{imageRendering: 'pixelated'}}
              onMouseDown={() => {handleMouseDown()}}
              onMouseMove={(e) => {handleMouseMove(e)}}
              onMouseUp={(e) => {handleMouseUp(e)}}
              onMouseLeave={(e) => {handleMouseLeave(e)}}
            >
              {(currentFrame?.layers ?? [])
                .sort((a, b) => a.layerOrder - b.layerOrder)
                .map((layer) => (
                  <KonvaLayer
                    key={layer.id} 
                    id={layer.id} 
                    opacity={layer.opacity / 100}
                    visible={layer.isVisible}>
                    
                    {/* 💡 복잡한 캔버스 생성 및 복원 로직은 이 블랙박스 컴포넌트가 알아서 수행합니다! */}
                    <LayerImageRenderer
                      layerId={layer.id}
                      pixelData={layer.pixelData}
                      canvasW={state.width}
                      canvasH={state.height}
                      currentFrameId={activeFrameId}
                      peekLayerCanvas={peekLayerCanvas}
                      ensureLayerCanvas={ensureLayerCanvas}
                    />
                  </KonvaLayer>
              ))}
              {cursorPos.x >= 0 && cursorPos.y >= 0 && (
                <Layer>
                  <Rect
                    x={cursorPos.x}
                    y={cursorPos.y}
                    width={1}
                    height={1}
                    fill="rgba(128, 128, 128, 0.6)" // 기준 색상을 흰색으로 설정
                    listening={false}
                  />
                </Layer>
              )}
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
                {([
                  ['add', '현재 색을 팔레트에 추가', () => addColorsToPalette([fgColor])],
                  ['upload', '팔레트 가져오기', () => setPaletteBrowserOpen(true)],
                  ['save', '현재 팔레트를 커뮤니티에 저장', () => setPaletteSaveOpen(true)],
                ] as const).map(([icon, tip, onClick]) => (
                  <button key={icon} type="button" title={tip} aria-label={tip} onClick={onClick}
                    className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-surface-container"
                    style={{ color: 'var(--color-on-surface-variant)' }}>
                    <span className="material-symbols-outlined text-sm">{icon}</span>
                  </button>
                ))}
              </div>
            </div>
            <div className="grid grid-cols-7 gap-1.5 px-1">
              {paletteColors.map(c => (
                <button
                  key={c}
                  onClick={() => { selectPaletteColor(c) }}
                  aria-label={`색상 ${c}`}
                  title={c}
                  className="w-8 h-8 rounded cursor-pointer transition-all border-2 hover:scale-110"
                  style={{ background: c, borderColor: fgColor === c ? 'var(--color-on-surface)' : 'transparent' }} />
              ))}
            </div>
            <button type="button" onClick={() => setPaletteBrowserOpen(true)}
              className="mt-3 text-xs font-bold hover:underline px-1"
              style={{ color: 'var(--color-primary)' }}>팔레트 둘러보기…</button>
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
                <button onClick={() => {
                  // 최대 크기 초과 방지 유효성 검사
                  if (customW > MAX_CANVAS_SIZE || customH > MAX_CANVAS_SIZE) {
                      alert(`캔버스 크기는 최대 ${MAX_CANVAS_SIZE}x${MAX_CANVAS_SIZE}까지 설정할 수 있습니다.`);
                      return;
                  }
                  if (customW < 1 || customH < 1) {
                      alert('캔버스 크기는 최소 1 이상이어야 합니다.');
                      return;
                  }
                  
                  if (!Number.isInteger(customW) || !Number.isInteger(customH)) {
                    alert('캔버스 크기는 정수여야 합니다.');
                    return;
                  } 
                  applyCanvasSize(customW, customH)

                }}
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
          
          {/* 레이어 섹션 */}
          <div className="p-4 flex-1">
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)' }}>{currentFrame.layers.length} Layers</div>
              <div className="flex gap-1">
                {layerButtons.map(([icon,tip, handler]) => (
                  <button key={icon} title={tip}
                    onClick={() => {
                      if(!handler) return;
                      if (icon === 'add') {
                        handler();
                      } else if (icon === 'delete') {
                        // deleteLayer는 (frameIdx, layerId) 두 개를 받으므로 맞춰서 전달
                        handler();
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
                  onDragStart={(e) => handleLayerDragStart(e, originalIndex)}
                  onDragOver={(e) => handleDragOver(e)}
                  onDrop={(e) => handleLayerDrop(e, originalIndex)}
                  onClick={() => selectLayer(layer.id)}
                  onKeyDown={(e) => {
                    if(e.key === 'Enter' || e.key === ' '){
                      e.preventDefault();
                      selectLayer(layer.id);
                    }
                  }}
                  className="flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm"
                  style={{
                    background: activeLayerId === layer.id ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
                    color: activeLayerId === layer.id ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                    fontWeight: activeLayerId === layer.id ? 700 : 400,
                  }}>
                  
                  {/* 레이어 눈 토글 버튼 활성화 */}
                  <button 
                    onClick={(e) => {
                      e.stopPropagation(); // 💡 중요: 버튼을 누를 때 부모 div의 selectLayer가 트리거되는 것을 방지!
                      toggleVisibility(activeFrameId, layer.id);
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
                      borderColor: activeLayerId === layer.id ? 'var(--color-primary)' : 'var(--color-outline)',
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
        {/* ── AI 가이드 전용 패널 (VS Code Secondary Side Bar 스타일) ── */}
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
            {/* 🎨 색 팔레트 추천 — 현재 작업물+자연어 기반 */}
            <div className="mb-4 p-3 rounded-lg bg-surface-container-low border border-outline">
              <div className="text-xs font-bold mb-2 text-on-surface">🎨 색 팔레트 추천</div>
              <textarea
                value={aiPrompt}
                onChange={(e) => setAiPrompt(e.target.value)}
                placeholder="원하는 느낌 (선택) — 예: 숲속 밤, 아늑한"
                rows={2}
                maxLength={500}
                className="w-full text-xs p-2 rounded border resize-none bg-surface"
                style={{ borderColor: 'var(--color-outline)', color: 'var(--color-on-surface)' }}
              />
              <button
                onClick={handleSuggestPalette}
                disabled={aiLoading}
                className="mt-2 w-full py-1.5 text-xs font-bold rounded-lg text-white disabled:opacity-50"
                style={{ background: 'var(--color-primary)' }}
              >
                {aiLoading ? '추천 중…' : '색 추천'}
              </button>
              {aiColors.length > 0 && (
                <div className="mt-3">
                  <div className="grid grid-cols-8 gap-1 mb-2">
                    {aiColors.map((c) => (
                      <button
                        key={c}
                        title={c}
                        aria-label={`추천 색상 ${c}`}
                        onClick={() => selectPaletteColor(c)}
                        className="w-full aspect-square rounded border hover:scale-110 transition-all"
                        style={{ background: c, borderColor: 'var(--color-outline)' }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => addColorsToPalette(aiColors)}
                    className="w-full py-1.5 text-xs font-bold rounded-lg border hover:bg-surface-container"
                    style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                  >
                    + 팔레트에 추가
                  </button>
                </div>
              )}
            </div>

            {/* 🏷️ 태그로 색 찾기 — 키워드 기반(이미지 없음) */}
            <div className="mb-4 p-3 rounded-lg bg-surface-container-low border border-outline">
              <div className="text-xs font-bold mb-2 text-on-surface">🏷️ 태그로 색 찾기</div>
              <input
                type="text"
                value={tagInput}
                onChange={(e) => setTagInput(e.target.value)}
                placeholder="태그 (콤마로 구분) — 예: 석양, 숲"
                maxLength={200}
                className="w-full text-xs p-2 rounded border bg-surface"
                style={{ borderColor: 'var(--color-outline)', color: 'var(--color-on-surface)' }}
              />
              <button
                onClick={handleSuggestByTags}
                disabled={aiTagLoading}
                className="mt-2 w-full py-1.5 text-xs font-bold rounded-lg text-white disabled:opacity-50"
                style={{ background: 'var(--color-primary)' }}
              >
                {aiTagLoading ? '찾는 중…' : '색 찾기'}
              </button>
              {aiTagColors.length > 0 && (
                <div className="mt-3">
                  <div className="grid grid-cols-8 gap-1 mb-2">
                    {aiTagColors.map((c) => (
                      <button
                        key={c}
                        title={c}
                        aria-label={`추천 색상 ${c}`}
                        onClick={() => selectPaletteColor(c)}
                        className="w-full aspect-square rounded border hover:scale-110 transition-all"
                        style={{ background: c, borderColor: 'var(--color-outline)' }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => addColorsToPalette(aiTagColors)}
                    className="w-full py-1.5 text-xs font-bold rounded-lg border hover:bg-surface-container"
                    style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                  >
                    + 팔레트에 추가
                  </button>
                </div>
              )}
            </div>

            {/* 🎨 컨셉 도우미 — 자연어 → 색 + 관련 작품(우리 갤러리) */}
            <div className="mb-4 p-3 rounded-lg bg-surface-container-low border border-outline">
              <div className="text-xs font-bold mb-2 text-on-surface">🎨 컨셉 도우미</div>
              <textarea
                value={conceptInput}
                onChange={(e) => setConceptInput(e.target.value)}
                placeholder="만들고 싶은 컨셉 — 예: 네온이 빛나는 사이버펑크 도시의 밤"
                rows={2}
                maxLength={500}
                className="w-full text-xs p-2 rounded border resize-none bg-surface"
                style={{ borderColor: 'var(--color-outline)', color: 'var(--color-on-surface)' }}
              />
              <button
                onClick={handleSuggestConcept}
                disabled={conceptLoading}
                className="mt-2 w-full py-1.5 text-xs font-bold rounded-lg text-white disabled:opacity-50"
                style={{ background: 'var(--color-primary)' }}
              >
                {conceptLoading ? '추천 중…' : '추천받기'}
              </button>
              {conceptColors.length > 0 && (
                <div className="mt-3">
                  <div className="grid grid-cols-8 gap-1 mb-2">
                    {conceptColors.map((c) => (
                      <button
                        key={c}
                        title={c}
                        aria-label={`추천 색상 ${c}`}
                        onClick={() => selectPaletteColor(c)}
                        className="w-full aspect-square rounded border hover:scale-110 transition-all"
                        style={{ background: c, borderColor: 'var(--color-outline)' }}
                      />
                    ))}
                  </div>
                  <button
                    onClick={() => addColorsToPalette(conceptColors)}
                    className="w-full py-1.5 text-xs font-bold rounded-lg border hover:bg-surface-container"
                    style={{ borderColor: 'var(--color-primary)', color: 'var(--color-primary)' }}
                  >
                    + 팔레트에 추가
                  </button>

                  {conceptKeywords.length > 0 && (
                    <div className="mt-3">
                      <div className="text-[11px] mb-1 text-on-surface-variant">이 태그로 찾았어요</div>
                      <div className="flex flex-wrap gap-1">
                        {conceptKeywords.map((k) => (
                          <span
                            key={k}
                            className="px-1.5 py-0.5 text-[11px] rounded bg-surface-container text-on-surface-variant"
                          >
                            {k}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  <div className="mt-3">
                    <div className="text-[11px] mb-1 text-on-surface-variant">관련 작품</div>
                    {conceptRelated.length > 0 ? (
                      <div className="grid grid-cols-3 gap-1">
                        {conceptRelated.map((p) => (
                          <a
                            key={p.postId}
                            href={`/gallery/${p.postId}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            title={p.title}
                            aria-label={`관련 작품 열기: ${p.title}`}
                            className="block aspect-square rounded border overflow-hidden hover:opacity-80 transition-opacity bg-surface-container"
                            style={{ borderColor: 'var(--color-outline)' }}
                          >
                            {p.thumbnailUrl && (
                              <img
                                src={p.thumbnailUrl}
                                alt={p.title}
                                loading="lazy"
                                className="w-full h-full object-cover"
                                style={{ imageRendering: 'pixelated' }}
                              />
                            )}
                          </a>
                        ))}
                      </div>
                    ) : (
                      <div className="text-[11px] text-on-surface-variant">관련 작품을 찾지 못했어요.</div>
                    )}
                  </div>
                </div>
              )}
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
        <span>Active: {currentFrame?.layers.find(l => String(l.id) === String(activeLayerId))?.name || '-'}</span>
      </footer>
    </div>
  )
}
