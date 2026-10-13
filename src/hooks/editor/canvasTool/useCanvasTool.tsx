import { Point } from "../../../type/editor";
import React, { useCallback, useState } from "react";

interface UseCanvasTool {
    fgColor: string;
    isDirty: React.RefObject<boolean>;
    setUnsaved: React.Dispatch<React.SetStateAction<boolean>>;
    selectPaletteColor: (color: string) => void;
}
export function useCanvasTool({
  fgColor,
  isDirty,
  setUnsaved,
  selectPaletteColor,
}: UseCanvasTool){
    const [activeTool, setActiveTool]   = useState('pencil');
    const [brushSize, setBrushSize]     = useState(1);
    const [pixelPerfect, setPixelPerfect] = useState(true);
    
    // -------- 활성 프레임의 활성 레이어에 대한 캔버스에다가 픽셀 도구 효과를 적용하는 로직 -----------
    const applyDirectTool = useCallback((ctx: CanvasRenderingContext2D, pos : Point | null) => {
        if (!ctx || !pos) return
    
        const { x, y } = pos;
        const {width, height} = ctx.canvas;
        if (x < 0 || x >= width || y < 0 || y >= height) return
    
        // ─── [연필 도구] ──────────────────────────────────────────
        if (activeTool === 'pencil') {
          ctx.fillStyle = fgColor
          ctx.fillRect(x, y, brushSize, brushSize)
          ctx.globalAlpha = 1
          isDirty.current = true; // 픽셀이 변경되었음을 표시
          setUnsaved(true);
        }
        // ─── [지우개 도구] ────────────────────────────────────────
        else if (activeTool === 'eraser') {
          ctx.clearRect(x, y, brushSize, brushSize)
          isDirty.current = true; // 픽셀이 변경되었음을 표시
          setUnsaved(true);
        }
        // ─── [페인트 통 도구 (Fill) - Flood Fill 알고리즘 최적화 버전] ──────────
        else if (activeTool === 'fill') {
          // 현재 메모리에 있는 픽셀 데이터 캡처 (Raw RGBA 버퍼)
          const imgData = ctx.getImageData(0, 0, width, height);
          // R/G/B/A 4바이트를 32비트 정수 1개 단위로 재해석 (픽셀당 1개 인덱스로 대응)
          const data32 = new Uint32Array(imgData.data.buffer);
          
          // 시작점의 색상 추출
          // y * canvasW + x -> 2차원 좌표를 1차원 메모리 주소(인덱스)로 변환
          const targetColor = data32[y * width + x]; 
          
          // 채우고자 하는 fgColor(Hex 문자열)를 32비트 정수(ABGR 구조)로 변환
          const r = parseInt(fgColor.slice(1, 3), 16);
          const g = parseInt(fgColor.slice(3, 5), 16);
          const b = parseInt(fgColor.slice(5, 7), 16);
          // 비트 시프트 연산(<<) 및 OR(|)로 32비트 색상값 생성, >>> 0 추가하여 Uint32 형태의 양수로 반환
          const fillColor = (255 << 24) | (b << 16) | (g << 8) | r >>> 0;
          
          if (targetColor === fillColor) {
            return;
          }
          const totalPixels = width * height;
          // 고정 크기 인덱스 큐 (최대 픽셀 수만큼 미리 메모리를 할당하여 GC 과부하 방지)
          const queue = new Int32Array(totalPixels);
          let head = 0; // 읽기 포인터 (pop 연산 시 증가)
          let tail = 0; // 쓰기 포인터 (push 연산 시 증가)
    
          const startIdx = y * width + x; // 시작 픽셀 주소
          queue[tail++] = startIdx; // 시작 주소를 큐에 push
          data32[startIdx] = fillColor; // push 하자마자 즉시 색상 변경 (중복 방문 원천 차단)
    
          // 큐에 처리할 픽셀이 남아있는 동안 BFS 탐색 반복
          while (head < tail) { 
            const idx = queue[head++]; // 큐의 맨 앞에서 현재 처리할 픽셀 주소를 하나 꺼내옴 (O(1) Pop)
            
            // 1차원 주소 idx를 2차원 좌표(cx, cy)로 복원하여 캔버스 경계 판단에 활용
            const cx = idx % width; 
            const cy = Math.floor(idx / width); // 소수점 버림 함수
            
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
            if (cx < width - 1) { // 오른쪽 벽에 붙어있지 않다면
              const nIdx = idx + 1; // 현재 위치 기준 '우'측 이웃 주소
              if (data32[nIdx] === targetColor) {
                data32[nIdx] = fillColor;
                queue[tail++] = nIdx;
              }
            }
            
            // 3. 상단 이웃 검사
            if (cy > 0) { // 위쪽 벽에 붙어있지 않다면
              const nIdx = idx - width; // 현재 위치 기준 '상'측 이웃 주소 (한 줄 위)
              if (data32[nIdx] === targetColor) {
                data32[nIdx] = fillColor;
                queue[tail++] = nIdx;
              }
            }
            
            // 4. 하단 이웃 검사
            if (cy < height - 1) { // 아래쪽 벽에 붙어있지 않다면
              const nIdx = idx + width; // 현재 위치 기준 '하'측 이웃 주소 (한 줄 아래)
              if (data32[nIdx] === targetColor) {
                data32[nIdx] = fillColor;
                queue[tail++] = nIdx;
              }
            }
          }

          ctx.putImageData(imgData, 0, 0);
          isDirty.current = true; // 픽셀이 변경되었음을 표시
          setUnsaved(true);
        }
      
        // ─── [스포이트 도구 (Eyedropper)] ──────────────────────────
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
    }, [activeTool, fgColor, brushSize]);

    return {applyDirectTool, activeTool, setActiveTool, brushSize, setBrushSize, pixelPerfect, setPixelPerfect}
}