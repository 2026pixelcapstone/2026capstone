import { Stage } from "konva/lib/Stage"
import { toast } from "../../store/toastStore"
import { getCacheKey } from "../../utils/editorUtils"
import { useCallback } from "react"
import { CanvasState } from "../../type/editor";
import { applyPalette, GIFEncoder, quantize } from "gifenc";
import { canvasDataToPpit } from "../../utils/ppitConvert";
import { PALETTE_COLORS } from "../../constants/editor/editor";
import { serializePpit } from "../../lib/ppit";

interface UseEditorExport{
    stageRef:React.RefObject<Stage | null>;
    state: CanvasState
    projectTitle: string | null;
    peekLayerCanvas: (cachekey: string) => HTMLCanvasElement | null;
}

export function useEditorExport({
    stageRef,
    state,
    projectTitle,
    peekLayerCanvas,
}: UseEditorExport){

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
    
    // ── PNG/GIF 내보내기 ──────────────────────────────────
    const handleExportImage = useCallback(async() => {
        const stage = stageRef.current;
        if (!stage) return;
        if(!projectTitle){
            toast.error("제목을 입력해주세요.");
            return;
        }
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
          const gif = GIFEncoder();
    
          // 가상 도화지(가상 캔버스) 생성 및 안전장치
          const frameCanvas = document.createElement('canvas');

          const width = state.width;
          const height = state.height;

          frameCanvas.width = width;
          frameCanvas.height = height;
          const fCtx = frameCanvas.getContext('2d', { willReadFrequently: true });
    
          if(fCtx){
            fCtx.imageSmoothingEnabled = false;
            // 모든 프레임을 순서대로 필름 인코딩 루프 돌리기
            for(let fIdx = 0; fIdx < state.frames.length; fIdx++){
              const currentFrame = state.frames[fIdx];
              if (!currentFrame || !currentFrame.id) continue;
              
              fCtx.clearRect(0, 0, width, height)
    
              const currentFrameLayers = currentFrame.layers ?? [];
              
              for(const layer of currentFrameLayers){
                if(!layer.isVisible || !layer.id || !layer.opacity) continue // 보이지 않는 레이어는 합성에서 제외
                
                const cacheKey = getCacheKey(currentFrame.id, layer.id);
                const cachedCanvas = peekLayerCanvas(cacheKey);
    
                fCtx.globalAlpha = (layer.opacity ?? 100) / 100;
    
                if(cachedCanvas){
                  // 1순위: 메모리 캔버스 캐시 사용
                  fCtx.drawImage(cachedCanvas, 0, 0, width, height);
                }
                else {
                  // 2순위: 미리 로드해둔 imageMap에서 즉시 동기 추출
                  const img = imageMap.get(cacheKey);
                  if(img){
                    fCtx.drawImage(img, 0, 0, width, height);
                  }
                }
                fCtx.globalAlpha = 1.0; // 투명도 원상복구
              }
              // 겹치기가 끝난 최종 프레임 캔버스에서 화소 데이터 추출
              const imageData = fCtx.getImageData(0, 0, width, height)
              // 컬러 양자화 알고리즘 구동 (GIF 규격 압축)
              const palette = quantize(imageData.data, 256)
              const indexed = applyPalette(imageData.data, palette)
    
              gif.writeFrame(indexed, width, height, {
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
    }, [stageRef, projectTitle, state.frames, state.width, state.height, peekLayerCanvas]);


    // ── .ppit 내보내기/불러오기 ───────────────────────────
    const safeFileName = (title: string) =>
        (title || 'artwork').trim().replace(/[\\/:*?"<>|]+/g, '_') || 'artwork'
    
    const handleExportPpit = useCallback(() => {
        if(!projectTitle){
            toast.error("제목을 입력해주세요.");
            return;
        }
        try {
        const ppit = canvasDataToPpit(state, PALETTE_COLORS)
        const blob = new Blob([serializePpit(ppit)], { type: 'application/json' })
        downloadBlob(blob, `${safeFileName(projectTitle)}.ppit`)
        } catch {
        toast.error('.ppit 내보내기에 실패했습니다.')
        }
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [state, projectTitle])
      
    return {handleExportImage, handleExportPpit}
}