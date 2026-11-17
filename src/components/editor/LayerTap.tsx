import { useState } from 'react';
import type { ButtonHTMLAttributes, Dispatch, SetStateAction } from 'react';
import type { CanvasState, LayerData } from '../../type/editor';
import { toast } from '../../store/toastStore';
import { createDefaultLayer } from '../../constants/editor/editor';
import { getCacheKey, getLayerImageData } from '../../utils/editorUtils';

const ICON_BUTTON_CLASS = 'cursor-pointer transition-colors inline-flex items-center justify-center rounded-md p-1.5 hover:bg-surface-container-highest disabled:opacity-30 disabled:cursor-not-allowed focus-visible:outline-2 focus-visible:outline-primary';

type LayerIconButtonProps = Omit<ButtonHTMLAttributes<HTMLButtonElement>, 'children'> & { icon: string };

function LayerIconButton({ icon, className = '', title, 'aria-label': label, ...props }: LayerIconButtonProps) {
    return <button {...props} type="button" title={title} aria-label={label ?? title}
        className={`${ICON_BUTTON_CLASS} ${className}`}>
        <span aria-hidden="true" className="material-symbols-outlined text-[18px]">{icon}</span>
    </button>;
}

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
    onRenameLayer: (frameId: string, layerId: string, name: string) => void;
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
    onToggleVisibility,
    onRenameLayer,
}: Props) {
    const [expanded, setExpanded] = useState<Set<string>>(() => new Set(activeFrameId ? [activeFrameId] : []));
    const [clipboard, setClipboard] = useState<LayerData | null>(null);
    const [destination, setDestination] = useState('');
    const [renaming, setRenaming] = useState<{ frameId: string; layerId: string } | null>(null);
    const [source, setSource] = useState<{ frameId: string; layerId: string } | null>(null);

    const rename = (frameId: string, layerId: string, value: string) => {
        const name = value.trim().slice(0, 50);
        const original = state.frames.find(f => f.id === frameId)?.layers.find(l => l.id === layerId);
        setRenaming(null);
        if (!name || !original || original.name === name) return;
        onRenameLayer(frameId, layerId, name);
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
        const emptyLayer = remove && state.frames.find(f => f.id === remove.frameId)?.layers.length === 1
            ? createDefaultLayer() : null;
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
        toast.success(`‘${image.name}’ 복사되었습니다. 붙여넣을 프레임을 선택하세요.`);
    };

    const transfer = (move: boolean) => {
        if (!source || !destination || source.frameId === destination) return;
        const image = snapshot(source.frameId, source.layerId);
        if (!image || !state.frames.some(f => f.id === destination)) return;
        append(image, [destination], move ? source : undefined);
        setExpanded(prev => new Set([...prev, destination]));
        toast.success(`‘${image.name}’ ${move ? '이동' : '복사'} 완료. 편집 프레임은 유지됩니다.`);
        setSource(null);
    };


    return <section className="flex flex-col text-on-surface-variant" style={{ background: 'var(--color-surface)' }} aria-label="전체 프레임 레이어">
        <header className="px-4 py-3 border-b border-outline font-bold">레이어</header>
        <div className="p-3">
            <div className="flex items-center justify-between mb-3">
                <h2 className="text-sm font-bold">전체 프레임의 레이어 요약</h2>
                <LayerIconButton title={expanded.size ? '모든 프레임 접기' : '모든 프레임 펼치기'} aria-label={expanded.size ? '모든 프레임 접기' : '모든 프레임 펼치기'} onClick={() => setExpanded(expanded.size ? new Set() : new Set(state.frames.map(f => f.id)))} icon={expanded.size ? 'unfold_less' : 'unfold_more'} />
            </div>
            <div className="space-y-2">
                {state.frames.map((frame, index) => {
                    const open = expanded.has(frame.id);
                    const current = frame.id === activeFrameId;
                    return <div key={frame.id} className="rounded-xl overflow-hidden border border-outline">
                        <div className={`flex items-center gap-1 px-1 py-2 ${current ? 'bg-primary/10 text-primary' : 'bg-surface-container-low'}`}>
                            <LayerIconButton aria-label={`프레임 ${index + 1} 레이어 ${open ? '접기' : '펼치기'}`} aria-expanded={open}
                                onClick={() => setExpanded(prev => { const next = new Set(prev); if (next.has(frame.id)) next.delete(frame.id); else next.add(frame.id); return next; })} icon={open ? 'expand_more' : 'chevron_right'} />
                            <button type="button" className="flex-1 min-w-0 cursor-pointer transition-colors hover:text-primary text-left text-sm font-bold rounded focus-visible:outline-2 focus-visible:outline-primary"
                                title="이 프레임을 캔버스에서 편집" aria-current={current ? 'true' : undefined} onClick={() => onSelectFrame(frame.id)}>
                                프레임 {index + 1}{current ? ' (현재)' : ''}<span className="ml-1 text-[10px] opacity-60">{frame.layers.length}개</span>
                            </button>
                            <LayerIconButton title="이 프레임에 빈 레이어 추가" aria-label={`프레임 ${index + 1}에 레이어 추가`} onClick={() => onAddLayer(frame.id)} icon={'add'} />
                            <LayerIconButton disabled={!clipboard} title="복사한 레이어를 새 레이어로 추가" aria-label={`프레임 ${index + 1}에 새 레이어로 붙여넣기`}
                                onClick={() => { if (!clipboard) return; append(clipboard, [frame.id]); setExpanded(prev => new Set([...prev, frame.id])); toast.success(`프레임 ${index + 1}에 ‘${clipboard.name}’ 새 레이어 추가됨.`); }} icon={'content_paste'} />
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
                                    <LayerIconButton className={`${layer.isVisible ? 'text-primary' : 'opacity-40'}`} aria-label={`${layer.name} ${layer.isVisible ? '숨기기' : '표시'}`} onClick={() => onToggleVisibility(frame.id, layer.id)} icon={layer.isVisible ? 'visibility' : 'visibility_off'} />
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
                                    <LayerIconButton title="레이어 이름 편집" aria-label={`${layer.name} 이름 편집`}
                                        onClick={() => setRenaming({ frameId: frame.id, layerId: layer.id })} icon={'edit'} />
                                    {layer.isLocked && <span title="잠긴 레이어"><span aria-hidden="true" className="material-symbols-outlined text-[18px]">lock</span></span>}
                                    <LayerIconButton disabled={frame.layers.length <= 1} aria-label={`${layer.name} 삭제`} title={frame.layers.length <= 1 ? '프레임에는 최소 1개 레이어가 필요합니다' : '레이어 삭제'} onClick={() => onDeleteLayer(frame.id, layer.id)} icon={'delete'} />
                                </div>
                                <div className="flex flex-wrap justify-end gap-1 mt-1 text-[10px]">
                                    <LayerIconButton title="레이어 복사" aria-label={`${layer.name} 복사`} onClick={() => copy(frame.id, layer.id)} icon={'content_copy'} />
                                    <LayerIconButton title="다른 프레임으로 복사 또는 이동" aria-label={`${layer.name} 다른 프레임으로 복사 또는 이동`} onClick={() => { setSource({ frameId: frame.id, layerId: layer.id }); setDestination(state.frames.find(f => f.id !== frame.id)?.id ?? ''); }} disabled={state.frames.length < 2} icon={'drive_file_move'} />
                                    <LayerIconButton disabled={state.frames.length < 2} aria-label={`${layer.name} 다른 모든 프레임에 1회 복사`} title="다른 모든 프레임에 새 레이어로 1회 복사 (이후 수정은 연동되지 않음)"
                                        onClick={() => { const image = snapshot(frame.id, layer.id); if (!image) return; append(image, state.frames.filter(f => f.id !== frame.id).map(f => f.id)); toast.success(`‘${image.name}’ 다른 모든 프레임에 1회 복사됨. 이후 수정은 연동되지 않습니다.`); }} icon={'library_add'} />
                                </div>
                                {source?.frameId === frame.id && source.layerId === layer.id && <div data-layer-transfer className="cursor-default mt-2 rounded-lg bg-surface-container p-2 space-y-2">
                                    <label className="block text-xs">대상 프레임
                                        <select aria-label="복사 또는 이동할 대상 프레임" className="mt-1 w-full rounded p-1 bg-surface text-on-surface" value={destination} onChange={e => setDestination(e.target.value)}>
                                            {state.frames.map((f, i) => f.id !== frame.id && <option key={f.id} value={f.id}>프레임 {i + 1}</option>)}
                                        </select>
                                    </label>
                                    <div className="flex gap-1 text-xs">
                                        <LayerIconButton title="대상 프레임에 새 레이어로 복사" aria-label="대상 프레임에 새 레이어로 복사" onClick={() => transfer(false)} icon={'content_copy'} />
                                        <LayerIconButton disabled={!destination} title="대상 프레임으로 이동 (마지막 레이어이면 원본에 빈 배경을 남깁니다)" aria-label="대상 프레임으로 이동" onClick={() => transfer(true)} icon={'drive_file_move'} />
                                        <LayerIconButton title="취소" aria-label="프레임 전송 취소" onClick={() => setSource(null)} icon={'close'} />
                                    </div>
                                </div>}
                            </li>)}
                        </ul>}
                    </div>;
                })}
            </div>

        </div>
    </section>;
}
