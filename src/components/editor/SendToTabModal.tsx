import { useRef, useState } from 'react';
import type { TabView } from '../../hooks/editor/project/useEditorTabs';
import { useFocusTrap } from '../../hooks/useFocusTrap';

interface Props {
    tabs: TabView[];          // 지금 탭을 뺀 다른 탭들
    layerName: string;
    onSend: (targetKey: string, what: 'layer' | 'frame') => void;
    onClose: () => void;
}

/** 다른 탭으로 보내기(PR-E) — 지금 레이어 또는 지금 프레임을 고른 탭에 복사 */
export function SendToTabModal({ tabs, layerName, onSend, onClose }: Props) {
    const [target, setTarget] = useState(tabs[0]?.key ?? '');
    const [what, setWhat] = useState<'layer' | 'frame'>('layer');
    const ref = useRef<HTMLDivElement>(null);
    useFocusTrap(true, ref, onClose);

    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="send-tab-title"
                className="w-full max-w-sm rounded-2xl p-5 space-y-4"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}
                onClick={e => e.stopPropagation()}>
                <h2 id="send-tab-title" className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>다른 탭으로 보내기</h2>

                <fieldset className="space-y-1.5">
                    <legend className="text-xs font-bold mb-1" style={{ color: 'var(--color-on-surface-variant)' }}>보낼 것</legend>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="send-what" checked={what === 'layer'} onChange={() => setWhat('layer')} />
                        지금 레이어 <span className="truncate" style={{ color: 'var(--color-on-surface-variant)' }}>({layerName})</span> → 새 레이어
                    </label>
                    <label className="flex items-center gap-2 text-sm cursor-pointer">
                        <input type="radio" name="send-what" checked={what === 'frame'} onChange={() => setWhat('frame')} />
                        지금 프레임(레이어 전부) → 맨 끝 새 프레임
                    </label>
                </fieldset>

                <label className="block space-y-1.5">
                    <span className="text-xs font-bold" style={{ color: 'var(--color-on-surface-variant)' }}>받을 탭</span>
                    <select value={target} onChange={e => setTarget(e.target.value)}
                        className="w-full rounded-lg p-2 text-sm outline-none"
                        style={{ background: 'var(--color-surface-container)', border: '1px solid var(--color-outline)', color: 'var(--color-on-surface)' }}>
                        {tabs.map(t => <option key={t.key} value={t.key}>{t.title}{t.unsaved ? ' •' : ''}</option>)}
                    </select>
                </label>

                <p className="text-xs" style={{ color: 'var(--color-on-surface-variant)' }}>
                    캔버스 크기가 다르면 왼쪽 위에 맞춰 넣고 넘치는 부분은 잘려요. 선택 영역만 보내려면 복사(Ctrl+C) 후 그 탭에서 붙여넣기(Ctrl+V)하세요.
                </p>

                <div className="flex justify-end gap-2">
                    <button type="button" onClick={onClose} className="px-3 py-1.5 text-sm rounded-lg hover:bg-surface-container"
                        style={{ color: 'var(--color-on-surface-variant)' }}>취소</button>
                    <button type="button" disabled={!target} onClick={() => { onSend(target, what); onClose(); }}
                        className="px-3 py-1.5 text-sm font-bold rounded-lg disabled:opacity-40"
                        style={{ background: 'var(--color-primary)', color: 'var(--color-background)' }}>보내기</button>
                </div>
            </div>
        </div>
    );
}
