import { FrameData } from "@/type/editor";
import { useMemo } from "react";

interface EditorLayerProps{
    activeFrameId: string | null;
    activeLayerId: string | null;
    currentFrame: FrameData;
    selectLayer: (layerIdToSelect: string) => void;
    reorderLayers: (targetFrameId: string | null, layerStartIndex: number, layerEndIndex: number) => void;
    toggleVisibility: (targetFrameId: string | null, layerId: string | null) => void;
    handleAddLayer: () => void;
    handleDeleteLayer: () => void;
}

export function EditorLayerBar({
    activeFrameId,
    activeLayerId,
    currentFrame,
    selectLayer,
    reorderLayers,
    toggleVisibility,
    handleAddLayer,
    handleDeleteLayer,
}:EditorLayerProps){
    // 1. 컴포넌트 내부 상단에 배열을 변수로 분리 (as const 적용)
    const layerButtons = [
        ['add', '레이어 추가', handleAddLayer],
        ['delete', '레이어 삭제', handleDeleteLayer]
    ] as const;


    // 순서가 뒤집힌 배열을 다루기 위해 실제 원본 인덱스를 포함한 객체 배열을 만듭니다.
    const reversedLayersWithIdx = useMemo(() => { // UI용 역순 배열을 useMemo로 감싸서 최신 상태와 동기화
        return (currentFrame?.layers ?? [])
          .map((layer, index) => ({ layer, originalIndex: index }))
          .reverse();
    }, [currentFrame.layers]);

    // -------- 레이어 순서 변경 -----------
    const LAYER_DND_MIME = "application/x-pixelhub-layer-index";
    
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
    
    return(
        <div className="p-4 border-b" style={{ borderColor: 'var(--color-outline)' }}>
            <div className="flex items-center justify-between mb-3">
              <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)' }}>{currentFrame.layers.length} Layer{currentFrame.layers.length === 1 ? '' : 's'}</div>
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
                  tabIndex={0}
                  draggable // 드래그 가능하도록 설정
                  onDragStart={(e) => handleLayerDragStart(e, originalIndex)}
                  onDragOver={(e) => handleDragOver(e)}
                  onDrop={(e) => handleLayerDrop(e, originalIndex)}
                  onClick={() => selectLayer(layer.id)}
                  onKeyDown={(e) => {
                    if (e.target !== e.currentTarget) return;
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
    )
}