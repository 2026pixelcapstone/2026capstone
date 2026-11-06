import { FrameData } from "../../type/editor";
import React, { useMemo, useState } from "react";

interface EditorLayerProps{
    detailLayer: string | null;
    activeFrameId: string | null;
    activeLayerId: string | null;
    currentFrame: FrameData;
    setDetailLayer: React.Dispatch<React.SetStateAction<string | null>>;
    selectLayer: (layerIdToSelect: string) => void;
    reorderLayers: (targetFrameId: string | null, layerStartIndex: number, layerEndIndex: number) => void;
    toggleVisibility: (targetFrameId: string | null, layerId: string | null) => void;
    handleAddLayer: () => void;
    handleDeleteLayer: () => void;
    /** PR-F: 잠금 켜고 끄기·이름 바꾸기(없으면 버튼·더블클릭 없음) */
    toggleLock?: (layerId: string) => void;
    renameLayer?: (layerId: string, name: string) => void;
}

export function EditorLayerBar({
    detailLayer,
    activeFrameId,
    activeLayerId,
    currentFrame,
    setDetailLayer,
    selectLayer,
    reorderLayers,
    toggleVisibility,
    handleAddLayer,
    handleDeleteLayer,
    toggleLock,
    renameLayer,
}:EditorLayerProps){
  // 이름 바꾸는 중인 레이어(더블클릭)
  const [renaming, setRenaming] = useState<{ id: string; value: string } | null>(null);
  const finishRename = () => {
    if (renaming && renameLayer) {
      const name = renaming.value.trim();
      if (name) renameLayer(renaming.id, name.slice(0, 50));
    }
    setRenaming(null);
  };
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
          <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)' }}>레이어 {currentFrame.layers.length}개</div>
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

        <div 
          className="space-y-0.5 overflow-y-auto pr-1"
          style={{
            minHeight: '135px',
            maxHeight: '300px',
            scrollbarWidth: 'thin',
            scrollbarColor: 'var(--color-surface-container) transparent'
          }}    
        >
          {reversedLayersWithIdx.map(({layer, originalIndex}) => {
            const isActive = activeLayerId === layer.id;
            return(
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
                className="group flex items-center gap-2.5 px-3 py-2.5 rounded-lg cursor-pointer transition-all text-sm"
                style={{
                  background: isActive ? 'color-mix(in srgb, var(--color-primary) 10%, transparent)' : 'transparent',
                  color: isActive ? 'var(--color-primary)' : 'var(--color-on-surface-variant)',
                  fontWeight: isActive ? 700 : 400,
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

                {/* 잠금 토글(PR-F) — 잠긴 레이어는 그리기·지우기·채우기·이동이 막힘 */}
                {toggleLock && (
                  <button
                    type="button"
                    onClick={(e) => { e.stopPropagation(); toggleLock(layer.id); }}
                    aria-label={layer.isLocked ? `${layer.name} 잠금 풀기` : `${layer.name} 잠그기`}
                    title={layer.isLocked ? '잠금 풀기' : '잠그기'}
                    className={`flex items-center justify-center p-0.5 rounded hover:bg-surface-container-highest transition-opacity ${layer.isLocked ? 'opacity-100' : 'opacity-0 group-hover:opacity-100 focus-visible:opacity-100'}`}
                    style={{ color: layer.isLocked ? 'var(--color-warning)' : 'var(--color-outline-strong)' }}
                  >
                    <span className="material-symbols-outlined text-sm">{layer.isLocked ? 'lock' : 'lock_open'}</span>
                  </button>
                )}

                {/* 레이어 썸네일 박스 — 지금 그림(PR-F) */}
                <div className="w-8 h-8 rounded border flex-shrink-0 checkerboard pointer-events-none overflow-hidden flex items-center justify-center"
                  style={{
                    borderColor: activeLayerId === layer.id ? 'var(--color-primary)' : 'var(--color-outline)',
                  }} 
                >
                  {layer.pixelData && (
                    <img src={layer.pixelData} alt="" className="max-w-full max-h-full" style={{ imageRendering: 'pixelated', opacity: layer.isVisible ? 1 : 0.4 }} draggable={false} />
                  )}
                </div>

                {/* 레이어 이름 — 더블클릭으로 바꾸기(PR-F) */}
                {renaming?.id === layer.id ? (
                  <input
                    autoFocus
                    value={renaming.value}
                    maxLength={50}
                    aria-label="레이어 이름"
                    onClick={e => e.stopPropagation()}
                    onChange={e => setRenaming({ id: layer.id, value: e.target.value })}
                    onBlur={finishRename}
                    onKeyDown={e => {
                      e.stopPropagation();
                      if (e.key === 'Enter') finishRename();
                      if (e.key === 'Escape') setRenaming(null);
                    }}
                    className="text-sm flex-1 min-w-0 rounded px-1 outline-none"
                    style={{ background: 'var(--color-surface-container-low)', border: '1px solid var(--color-primary)', color: 'var(--color-on-surface)' }}
                  />
                ) : (
                  <span className="text-sm truncate flex-1"
                    title={renameLayer ? '더블클릭으로 이름 바꾸기' : undefined}
                    onDoubleClick={(e) => { if (!renameLayer) return; e.stopPropagation(); setRenaming({ id: layer.id, value: layer.name }); }}
                  >{layer.name}</span>
                )}
                
                {/* 레이어 설정 버튼 */}
                <button
                  onClick={(e) => {
                    e.stopPropagation(); // 레이어 선택 이벤트 버블링 방지
                    selectLayer(layer.id);
                    
                    // 이미 열려있는 레이어의 설정 버튼을 한번 더 눌렀을 경우
                    if(detailLayer === layer.id){
                      setDetailLayer(null);
                    }
                    else{
                      setDetailLayer(layer.id);
                    }
                  }}
                  className={`flex items-center justify-center p-1 rounded hover:bg-surface-container-highest trasition-opacity flex-shrink-0 ${
                    isActive ? 'opacity-100' : 'opacity-0 group-hover: opacity-100 focus-visible:opacity-100'
                  }`}
                  style={{color: isActive ? 'var(--color-primary)' : 'var(--color-on-surface-variant)'}}
                  title="레이어 설정"
                >
                  <span className="material-symbols-outlined text-sm">settings</span>
                </button>
              </div>
            )
        })}
      </div>
    </div>
  )
}