import { CANVAS_PRESETS, MAX_CANVAS_SIZE } from "../../constants/editor/editor";
import React from "react";

interface EditorCanvasSizeProps{
    customW: number;
    customH: number;
    isScaleImage: boolean;
    width: number;
    height: number;
    setCustomW: React.Dispatch<React.SetStateAction<number>>;
    setCustomH: React.Dispatch<React.SetStateAction<number>>;
    setIsScaleImage: React.Dispatch<React.SetStateAction<boolean>>;
    applyCanvasSize: (w: number, h: number) => void
}
export function EditorCanvasSize({
    customW,
    customH,
    isScaleImage,
    width,
    height,
    setCustomW,
    setCustomH,
    setIsScaleImage,
    applyCanvasSize,
}:EditorCanvasSizeProps){
    return(
        <div className="p-4 border-b" style={{ borderColor: 'var(--color-outline)' }}>
            <div className="text-xs font-bold uppercase tracking-widest mb-3" style={{ color: 'var(--color-on-surface-variant)' }}>Canvas Size</div>
                <div className="px-1 space-y-2">
                {/* 1. 프리셋 버튼 grid */}
                <div className="grid grid-cols-3 gap-1">
                    {CANVAS_PRESETS.map(p => {
                    const [w, h] = p.split('×').map(Number)
                    const active = width === w && height === h
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
    )
}