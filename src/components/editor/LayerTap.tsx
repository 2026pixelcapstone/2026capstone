import { useState } from 'react';
import type { Dispatch, SetStateAction } from 'react';
import type { CanvasState, LayerData } from '../../type/editor';
import { createDefaultLayer } from '../../constants/editor/editor';
import { getCacheKey, getLayerImageData } from '../../utils/editorUtils';

interface Props {
    state: CanvasState;
    activeFrameId: string | null;
    activeLayerId: string | null;
    setWithHistory: Dispatch<SetStateAction<CanvasState>>;
    setUnsaved: Dispatch<SetStateAction<boolean>>;
    peekLayerCanvas: (key: string) => HTMLCanvasElement | null;
    onSelectFrame: (id: string) => void;
    onSelectLayer: (frameId: string, layerId: string) => void;
    onAddLayer: (frameId: string) => void;
    onDeleteLayer: (frameId: string, layerId: string) => void;
    onToggleVisibility: (frameId: string, layerId: string) => void;
}

/** 프레임별 독립 레이어를 탐색하고, 스냅샷을 독립적인 새 레이어로 복사합니다. */
export function LayerTap({ 
    state, 
    activeFrameId, 
    activeLayerId, 
    setWithHistory, 
    setUnsaved, 
    peekLayerCanvas, 
    onSelectFrame, 
    onSelectLayer, 
    onAddLayer, 
    onDeleteLayer, 
    onToggleVisibility 
}: Props) {
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set(activeFrameId ? [activeFrameId] : []));
    const [clipboard, setClipboard] = useState<LayerData | null>(null);
    const [message, setMessage] = useState('');
    const [destination, setDestination] = useState('');
    const [renaming, setRenaming] = useState<{ frameId: string; layerId: string } | null>(null);
    const [source, setSource] = useState<{ frameId: string; layerId: string } | null>(null);

    const rename = (frameId: string, layerId: string, value: string) => {
        const name = value.trim().slice(0, 50);
        const original = state.frames.find(f => f.id === frameId)?.layers.find(l => l.id === layerId);
        setRenaming(null);
        if (!name || !original || original.name === name) return;
        setWithHistory(prev => ({ ...prev, frames: prev.frames.map(frame => frame.id !== frameId ? frame : {
            ...frame, layers: frame.layers.map(layer => layer.id === layerId ? { ...layer, name } : layer),
        }) }));
        setUnsaved(true);
        setMessage(`레이어 이름을 ‘${name}’으로 변경했습니다.`);
    };

    const snapshot = (frameId: string, layerId: string) => {
        const layer = state.frames.find(f => f.id === frameId)?.layers.find(l => l.id === layerId);
        if (!layer) return null;
        // 현재 프레임만 실시간 캐시를 사용합니다. 다른 프레임은 Undo 이후의 상태가 기준입니다.
        const canvas = frameId === activeFrameId && layerId === activeLayerId
            ? peekLayerCanvas(getCacheKey(frameId, layerId)) : null;
        return { ...layer, pixelData: canvas ? getLayerImageData(canvas) : layer.pixelData };
    };

    const append = (image: LayerData, targetIds: string[], remove?: { frameId: string; layerId: string }) => {
        // 리듀서 updater 안에서는 ID 생성 등의 부수 효과를 수행하지 않습니다.
        const copies = new Map(targetIds.map(id => [id, { ...image, id: `layer-${crypto.randomUUID()}` }]));
        const emptyLayer = remove ? createDefaultLayer() : null;
        setWithHistory(prev => ({ ...prev, frames: prev.frames.map(frame => {
            let layers = frame.layers;
            if (remove?.frameId === frame.id) {
                layers = layers.filter(l => l.id !== remove.layerId);
                if (layers.length === 0 && emptyLayer) layers = [emptyLayer];
            }
            const copy = copies.get(frame.id);
            if (copy) layers = [...layers, { ...copy, layerOrder: layers.length }];
            return layers === frame.layers ? frame : { ...frame, layers: layers.map((l, i) => ({ ...l, layerOrder: i })) };
        }) }));
        setUnsaved(true);
    };

    const copy = (frameId: string, layerId: string) => {
        const image = snapshot(frameId, layerId);
        if (!image) return;
        setClipboard(image);
        setMessage(`‘${image.name}’ 복사됨. 붙여넣을 프레임을 선택하세요.`);
    };

    const transfer = (move: boolean) => {
        if (!source || !destination || source.frameId === destination) return;
        const frame = state.frames.find(f => f.id === source.frameId);
        const image = snapshot(source.frameId, source.layerId);
        if (!frame || !image || !state.frames.some(f => f.id === destination)) return;
        append(image, [destination], move ? source : undefined);
        setExpanded(prev => new Set([...prev, destination]));
        setMessage(`‘${image.name}’ ${move ? '이동' : '복사'} 완료. 편집 프레임은 유지됩니다.`);
        setSource(null);
    };

    const icon = (name: string) => <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{name}</span>;
    const button = 'cursor-pointer transition-colors inline-flex items-center justify-center rounded-md p-1.5 hover:bg-surface-container-highest disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-primary';

    return <section className="flex flex-col text-on-surface-variant" style={{ background: 'var(--color-surface)' }} aria-label="전체 프레임 레이어">
        <header className="px-4 py-3 border-b border-outline font-bold">레이어</header>
        <div className="p-3">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold">전체 프레임의 레이어 요약</h2>
                <button type="button" className={button} title={expanded.size ? '모든 프레임 접기' : '모든 프레임 펼치기'} aria-label={expanded.size ? '모든 프레임 접기' : '모든 프레임 펼치기'} onClick={() => setExpanded(expanded.size ? new Set() : new Set(state.frames.map(f => f.id)))}>
                    {icon(expanded.size ? 'unfold_less' : 'unfold_more')}
                </button>
            </div>
            <div className="space-y-2">
                {state.frames.map((frame, index) => {
                    const open = expanded.has(frame.id);
                    const current = frame.id === activeFrameId;
                    return <div key={frame.id} className="rounded-xl overflow-hidden border border-outline">
                        <div className={`flex items-center gap-1 px-1 py-2 ${current ? 'bg-primary/10 text-primary' : 'bg-surface-container-low'}`}>
                            <button type="button" className={button} aria-label={`프레임 ${index + 1} 레이어 ${open ? '접기' : '펼치기'}`} aria-expanded={open}
                                onClick={() => setExpanded(prev => { const next = new Set(prev); if (next.has(frame.id)) next.delete(frame.id); else next.add(frame.id); return next; })}>
                                {icon(open ? 'expand_more' : 'chevron_right')}
                            </button>
                            <button type="button" className="flex-1 min-w-0 cursor-pointer transition-colors hover:text-primary text-left text-sm font-bold rounded focus-visible:outline-2 focus-visible:outline-primary"
                                title="이 프레임을 캔버스에서 편집" aria-current={current ? 'true' : undefined} onClick={() => onSelectFrame(frame.id)}>
                                프레임 {index + 1}{current ? ' (현재)' : ''}<span className="ml-1 text-[10px] opacity-60">{frame.layers.length}개</span>
                            </button>
                            <button type="button" className={button} title="이 프레임에 빈 레이어 추가" aria-label={`프레임 ${index + 1}에 레이어 추가`} onClick={() => onAddLayer(frame.id)}>{icon('add')}</button>
                            <button type="button" className={button} disabled={!clipboard} title="복사한 레이어를 새 레이어로 추가" aria-label={`프레임 ${index + 1}에 새 레이어로 붙여넣기`}
                                onClick={() => { if (!clipboard) return; append(clipboard, [frame.id]); setExpanded(prev => new Set([...prev, frame.id])); setMessage(`프레임 ${index + 1}에 ‘${clipboard.name}’ 새 레이어 추가됨.`); }}>{icon('content_paste')}</button>
                        </div>
                        {open && <ul className="py-1 bg-surface-container-low/40">
                            {[...frame.layers].reverse().map(layer => <li key={layer.id} tabIndex={0} aria-label={`${layer.name} 레이어 선택`}
                                onClick={e => {
                                    if ((e.target as HTMLElement).closest('button, input, select, label, [data-layer-transfer]')) return;
                                    onSelectLayer(frame.id, layer.id);
                                }}
                                onKeyDown={e => {
                                    if (e.target !== e.currentTarget) return;
                                    if (e.key === 'Enter' || e.key === ' ') {
                                        e.preventDefault();
                                        onSelectLayer(frame.id, layer.id);
                                    }
                                }}
                                className={`cursor-pointer focus-visible:outline-2 focus-visible:outline-primary px-2 py-2 transition-colors hover:bg-surface-container-highest/50 border-l-2 ${current && layer.id === activeLayerId ? 'border-primary bg-primary/5' : 'border-transparent'}`}>
                                <div className="flex items-center gap-2">
                                    <button type="button" className={`${button} ${layer.isVisible ? 'text-primary' : 'opacity-40'}`} aria-label={`${layer.name} ${layer.isVisible ? '숨기기' : '표시'}`} onClick={() => onToggleVisibility(frame.id, layer.id)}>{icon(layer.isVisible ? 'visibility' : 'visibility_off')}</button>
                                    <div className="checkerboard w-8 h-8 shrink-0 rounded border border-outline overflow-hidden flex items-center justify-center">
                                        {layer.pixelData && <img src={layer.pixelData} alt="" draggable={false} className="max-w-full max-h-full" style={{ imageRendering: 'pixelated' }} />}
                                    </div>
                                    {renaming?.frameId === frame.id && renaming.layerId === layer.id ? (
                                        <input autoFocus defaultValue={layer.name} maxLength={50}
                                            aria-label="레이어 이름 편집"
                                            className="min-w-0 flex-1 rounded border border-primary bg-surface px-1 py-1 text-xs text-on-surface outline-none"
                                            onFocus={e => e.currentTarget.select()}
                                            onBlur={e => rename(frame.id, layer.id, e.currentTarget.value)}
                                            onKeyDown={e => {
                                                e.stopPropagation();
                                                if (e.key === 'Enter' && !e.nativeEvent.isComposing) e.currentTarget.blur();
                                                if (e.key === 'Escape') { e.currentTarget.value = layer.name; e.currentTarget.blur(); }
                                            }} />
                                    ) : <button type="button" className="min-w-0 truncate flex-1 cursor-pointer transition-colors hover:text-primary hover:bg-surface-container-highest text-left text-xs rounded focus-visible:outline-2 focus-visible:outline-primary"
                                        title={`${layer.name} — 더블클릭 또는 F2로 이름 편집`}
                                        onDoubleClick={() => setRenaming({ frameId: frame.id, layerId: layer.id })}
                                        onKeyDown={e => { if (e.key === 'F2') { e.preventDefault(); setRenaming({ frameId: frame.id, layerId: layer.id }); } }}
                                        onClick={() => onSelectLayer(frame.id, layer.id)}>
                                        {layer.name}
                                    </button>}
                                    <button type="button" className={button} title="레이어 이름 편집" aria-label={`${layer.name} 이름 편집`}
                                        onClick={() => setRenaming({ frameId: frame.id, layerId: layer.id })}>{icon('edit')}</button>
                                    {layer.isLocked && <span title="잠긴 레이어">{icon('lock')}</span>}
                                    <button type="button" className={button} disabled={frame.layers.length <= 1} aria-label={`${layer.name} 삭제`} title={frame.layers.length <= 1 ? '프레임에는 최소 1개 레이어가 필요합니다' : '레이어 삭제'} onClick={() => onDeleteLayer(frame.id, layer.id)}>{icon('delete')}</button>
                                </div>
                                <div className="flex flex-wrap justify-end gap-1 mt-1 text-[10px]">
                                    <button type="button" className={button} title="레이어 복사" aria-label={`${layer.name} 복사`} onClick={() => copy(frame.id, layer.id)}>{icon('content_copy')}</button>
                                    <button type="button" className={button} title="다른 프레임으로 복사 또는 이동" aria-label={`${layer.name} 다른 프레임으로 복사 또는 이동`} onClick={() => { setSource({ frameId: frame.id, layerId: layer.id }); setDestination(state.frames.find(f => f.id !== frame.id)?.id ?? ''); }} disabled={state.frames.length < 2}>{icon('drive_file_move')}</button>
                                    <button type="button" className={button} disabled={state.frames.length < 2} aria-label={`${layer.name} 다른 모든 프레임에 1회 복사`} title="다른 모든 프레임에 새 레이어로 1회 복사 (이후 수정은 연동되지 않음)"
                                        onClick={() => { const image = snapshot(frame.id, layer.id); if (!image) return; append(image, state.frames.filter(f => f.id !== frame.id).map(f => f.id)); setMessage(`‘${image.name}’ 다른 모든 프레임에 1회 복사됨. 이후 수정은 연동되지 않습니다.`); }}>{icon('library_add')}</button>
                                </div>
                                {source?.frameId === frame.id && source.layerId === layer.id && <div data-layer-transfer className="cursor-default mt-2 rounded-lg bg-surface-container p-2 space-y-2">
                                    <label className="block text-xs">대상 프레임
                                        <select aria-label="복사 또는 이동할 대상 프레임" className="mt-1 w-full rounded p-1 bg-surface text-on-surface" value={destination} onChange={e => setDestination(e.target.value)}>
                                            {state.frames.map((f, i) => f.id !== frame.id && <option key={f.id} value={f.id}>프레임 {i + 1}</option>)}
                                        </select>
                                    </label>
                                    <div className="flex gap-1 text-xs">
                                        <button type="button" className={button} title="대상 프레임에 새 레이어로 복사" aria-label="대상 프레임에 새 레이어로 복사" onClick={() => transfer(false)}>{icon('content_copy')}</button>
                                        <button type="button" className={button} disabled={!destination} title="대상 프레임으로 이동 (마지막 레이어이면 원본에 빈 배경을 남깁니다)" aria-label="대상 프레임으로 이동" onClick={() => transfer(true)}>{icon('drive_file_move')}</button>
                                        <button type="button" className={button} title="취소" aria-label="프레임 전송 취소" onClick={() => setSource(null)}>{icon('close')}</button>
                                    </div>
                                </div>}
                            </li>)}
                        </ul>}
                    </div>;
                })}
            </div>
            <p className="text-[11px] leading-relaxed mt-4 pt-3 border-t border-outline">화살표는 목록 펼치기, 프레임 제목이나 레이어 행을 클릭하면 편집 대상으로 전환됩니다. 이름은 더블클릭하거나 연필 버튼으로 변경합니다. 붙여넣기는 원본을 덮어쓰지 않고 맨 위에 새 레이어를 추가합니다. 복사본은 서로 연동되지 않습니다.</p>
            {clipboard && <p className="mt-2 text-xs text-primary">복사한 레이어: {clipboard.name}</p>}
            <p role="status" aria-live="polite" className="mt-2 text-xs leading-relaxed">{message}</p>
        </div>
    </section>;
}
