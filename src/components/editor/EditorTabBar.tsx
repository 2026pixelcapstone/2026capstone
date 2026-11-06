import { useState } from 'react';
import type { TabView } from '../../hooks/editor/project/useEditorTabs';
import { MAX_TABS } from '../../hooks/editor/project/useEditorTabs';

interface Props {
    tabs: TabView[];
    onSwitch: (key: string) => void;
    onClose: (key: string) => void;
    onNew: () => void;
    onMove: (from: string, to: string) => void;
}

/** 캔버스 위 프로젝트 탭 줄(PR-E) — 클릭 전환, × 닫기(가운데 클릭도), + 새 탭, 끌어서 순서 바꾸기 */
export function EditorTabBar({ tabs, onSwitch, onClose, onNew, onMove }: Props) {
    const [dragKey, setDragKey] = useState<string | null>(null);
    const [overKey, setOverKey] = useState<string | null>(null);

    return (
        <div className="flex items-end gap-0.5 px-2 pt-1 overflow-x-auto flex-shrink-0 border-b"
            style={{ background: 'var(--color-surface-container-lowest)', borderColor: 'var(--color-outline)', scrollbarWidth: 'thin' }}
            role="tablist" aria-label="열린 프로젝트">
            {tabs.map(t => (
                <div key={t.key}
                    role="tab"
                    aria-selected={t.active}
                    tabIndex={0}
                    draggable
                    title={`${t.title}${t.unsaved ? ' (저장 안 함)' : ''}${t.projectId ? '' : ' · 서버에 저장 안 된 새 작업'}`}
                    onClick={() => onSwitch(t.key)}
                    onKeyDown={e => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); onSwitch(t.key); } }}
                    onAuxClick={e => { if (e.button === 1) { e.preventDefault(); onClose(t.key); } }}
                    onDragStart={e => { setDragKey(t.key); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragOver={e => { if (dragKey) { e.preventDefault(); setOverKey(t.key); } }}
                    onDragLeave={() => setOverKey(k => (k === t.key ? null : k))}
                    onDrop={e => { e.preventDefault(); if (dragKey) onMove(dragKey, t.key); setDragKey(null); setOverKey(null); }}
                    onDragEnd={() => { setDragKey(null); setOverKey(null); }}
                    className="group flex items-center gap-1.5 pl-3 pr-1 h-8 max-w-[200px] min-w-[96px] rounded-t-lg cursor-pointer select-none text-xs transition-colors"
                    style={{
                        background: t.active ? 'var(--color-surface)' : 'transparent',
                        color: t.active ? 'var(--color-on-surface)' : 'var(--color-on-surface-variant)',
                        fontWeight: t.active ? 700 : 500,
                        borderTop: `2px solid ${t.active ? 'var(--color-primary)' : 'transparent'}`,
                        outline: overKey === t.key && dragKey !== t.key ? '1px dashed var(--color-primary)' : 'none',
                        opacity: dragKey === t.key ? 0.5 : 1,
                    }}>
                    <span className="truncate flex-1">{t.title}</span>
                    {t.unsaved && <span className="w-1.5 h-1.5 rounded-full bg-amber-400 flex-shrink-0" aria-label="저장 안 함" />}
                    <button type="button" aria-label={`${t.title} 탭 닫기`} title="탭 닫기 (Ctrl+Alt+W)"
                        onClick={e => { e.stopPropagation(); onClose(t.key); }}
                        className="w-5 h-5 flex items-center justify-center rounded hover:bg-surface-container-high flex-shrink-0">
                        <span className="material-symbols-outlined" style={{ fontSize: 14 }}>close</span>
                    </button>
                </div>
            ))}
            <button type="button" onClick={onNew} disabled={tabs.length >= MAX_TABS}
                title={tabs.length >= MAX_TABS ? `탭은 최대 ${MAX_TABS}개` : '새 탭 (Ctrl+Alt+N)'} aria-label="새 탭"
                className="w-7 h-7 mb-0.5 flex items-center justify-center rounded-lg hover:bg-surface-container disabled:opacity-40 flex-shrink-0"
                style={{ color: 'var(--color-on-surface-variant)' }}>
                <span className="material-symbols-outlined text-base">add</span>
            </button>
        </div>
    );
}
