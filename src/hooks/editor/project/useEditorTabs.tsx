/**
 * 여러 프로젝트 탭(PR-E).
 * 에디터 화면은 하나만 두고, 탭을 바꿀 때 지금 탭의 상태(되돌리기 기록 전체·프로젝트 정보·저장 여부·팔레트·고른 프레임/레이어)를
 * 꺼내 두었다가 다른 탭의 것을 되살린다. 그림은 레이어 pixelData에 다 들어 있어서 레이어 캐시는 지우고 다시 그리게 함.
 *
 * 탭 목록(tabs)에서 지금 탭 칸은 '자리'만 맞고 내용은 옛 값 → 화면에 보일 땐 live 값(지금 상태)을 씀.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { CanvasState, FrameData, LayerData } from '../../../type/editor';
import type { HistoryState } from '../useHistory';
import type { ProjectMeta } from './useEditorProject';
import { createInitialCanvasData, DEFAULT_PROJECT_TITLE, MAX_HISTORY_SIZE, PALETTE_COLORS } from '../../../constants/editor/editor';
import { toast } from '../../../store/toastStore';

export const MAX_TABS = 8;

export interface EditorTab {
    key: string;
    history: HistoryState;
    meta: ProjectMeta;
    unsaved: boolean;
    palette: string[];
    activeFrameId: string | null;
    activeLayerId: string | null;
}

/** 탭 줄에 그릴 정보 */
export interface TabView {
    key: string;
    title: string;
    projectId: number | null;
    unsaved: boolean;
    active: boolean;
}

interface Live {
    /** 지금 탭의 현재 값들 */
    getHistory: () => HistoryState;
    meta: ProjectMeta;
    unsaved: boolean;
    palette: string[];
    activeFrameId: string | null;
    activeLayerId: string | null;
    /** 저장·이미지 계산 중이면 탭 전환을 막음(저장 결과가 다른 탭에 들어가거나 서버에 같은 프로젝트가 두 번 생기는 것 방지) */
    busy: boolean;
}

interface Apply {
    restoreHistory: (h: HistoryState) => void;
    restoreProject: (meta: ProjectMeta) => void;
    loadProjectHere: (pid: number) => void;
    setUnsaved: (v: boolean) => void;
    setPaletteColors: (colors: string[]) => void;
    setActiveFrameId: (id: string | null) => void;
    setActiveLayerId: (id: string | null) => void;
    setCustomW: (w: number) => void;
    setCustomH: (h: number) => void;
    clearAllLayerCanvas: () => void;
    /** 전환 직후 정리(선택 해제·레이어 설정 닫기·화면 맞추기 등) */
    onSwitched: () => void;
}

const newKey = () => `tab-${crypto.randomUUID().slice(0, 8)}`;
const shortId = (p: string) => `${p}-${crypto.randomUUID().slice(0, 8)}`;

function blankTab(): EditorTab {
    const canvas = createInitialCanvasData();
    return {
        key: newKey(),
        history: { past: [], present: canvas, future: [] },
        meta: { projectId: null, title: DEFAULT_PROJECT_TITLE, isPublic: false },
        unsaved: false,
        palette: [...PALETTE_COLORS],
        activeFrameId: canvas.frames[0].id,
        activeLayerId: canvas.frames[0].layers[0].id,
    };
}

/** 아무것도 안 한 빈 탭인지(불러오기를 새 탭 대신 여기에 열어도 되는지) */
function isBlank(t: Pick<EditorTab, 'history' | 'meta' | 'unsaved'>) {
    const p = t.history.present;
    return t.meta.projectId === null && !t.unsaved && t.history.past.length === 0
        && p.frames.length === 1 && p.frames[0].layers.length === 1 && !p.frames[0].layers[0].pixelData;
}

/** 받는 탭 캔버스 크기에 맞춰 그림을 왼쪽 위 기준으로 옮겨 그림(남는 부분은 잘림) */
async function fitPixelData(pixelData: string, from: { width: number; height: number }, to: { width: number; height: number }) {
    if (!pixelData || (from.width === to.width && from.height === to.height)) return pixelData;
    const img = new Image();
    img.src = pixelData;
    await img.decode();
    const c = document.createElement('canvas');
    c.width = to.width;
    c.height = to.height;
    const ctx = c.getContext('2d')!;
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(img, 0, 0);
    return c.toDataURL('image/png');
}

function pushHistory(h: HistoryState, next: CanvasState): HistoryState {
    const past = [...h.past, h.present];
    return { past: past.length > MAX_HISTORY_SIZE ? past.slice(1) : past, present: next, future: [] };
}

export function useEditorTabs(live: Live, apply: Apply) {
    const [tabs, setTabs] = useState<EditorTab[]>(() => [{ ...blankTab(), key: 'tab-first' }]);
    const [activeKey, setActiveKey] = useState('tab-first');

    // 이벤트 처리에서 늘 최신 값을 읽도록 ref로도 둠
    const liveRef = useRef(live);
    liveRef.current = live;
    const applyRef = useRef(apply);
    applyRef.current = apply;
    const tabsRef = useRef(tabs);
    tabsRef.current = tabs;
    const activeKeyRef = useRef(activeKey);
    activeKeyRef.current = activeKey;

    /** 지금 탭 상태를 꺼냄 */
    const capture = useCallback((): EditorTab => {
        const l = liveRef.current;
        return {
            key: activeKeyRef.current,
            history: l.getHistory(),
            meta: { ...l.meta },
            unsaved: l.unsaved,
            palette: l.palette,
            activeFrameId: l.activeFrameId,
            activeLayerId: l.activeLayerId,
        };
    }, []);

    /** 탭 하나를 화면에 되살림 */
    const show = useCallback((t: EditorTab) => {
        const a = applyRef.current;
        a.clearAllLayerCanvas();
        a.restoreHistory(t.history);
        a.setActiveFrameId(t.activeFrameId);
        a.setActiveLayerId(t.activeLayerId);
        a.setCustomW(t.history.present.width);
        a.setCustomH(t.history.present.height);
        a.setPaletteColors(t.palette);
        a.restoreProject(t.meta);
        a.setUnsaved(t.unsaved);
        activeKeyRef.current = t.key;
        setActiveKey(t.key);
        a.onSwitched();
    }, []);

    const guardBusy = useCallback(() => {
        if (liveRef.current.busy) { toast.info('저장(또는 계산) 중에는 탭을 바꿀 수 없어요. 잠시 뒤에 다시 해 주세요.'); return true; }
        return false;
    }, []);

    /** 지금 탭을 꺼내 목록에 넣은 새 목록 */
    const withCaptured = useCallback(() => {
        const cur = capture();
        return tabsRef.current.map(t => (t.key === cur.key ? cur : t));
    }, [capture]);

    const switchTab = useCallback((key: string) => {
        if (key === activeKeyRef.current || guardBusy()) return;
        const list = withCaptured();
        const target = list.find(t => t.key === key);
        if (!target) return;
        setTabs(list);
        show(target);
    }, [guardBusy, withCaptured, show]);

    /** 새 빈 탭(지금 탭 오른쪽). 열지 못하면 false */
    const newTab = useCallback((): boolean => {
        if (guardBusy()) return false;
        if (tabsRef.current.length >= MAX_TABS) { toast.info(`탭은 최대 ${MAX_TABS}개까지 열 수 있어요. 안 쓰는 탭을 닫아 주세요.`); return false; }
        const list = withCaptured();
        const t = blankTab();
        const idx = list.findIndex(x => x.key === activeKeyRef.current);
        list.splice(idx + 1, 0, t);
        tabsRef.current = list;
        setTabs(list);
        show(t);
        return true;
    }, [guardBusy, withCaptured, show]);

    /** 불러오기 전에: 지금 탭이 빈 탭이면 그대로, 아니면 새 탭. 못 열면 false */
    const prepareFreshTab = useCallback((): boolean => {
        if (isBlank(capture())) return true;
        return newTab();
    }, [capture, newTab]);

    const closeTab = useCallback((key: string) => {
        const isActive = key === activeKeyRef.current;
        if (isActive && guardBusy()) return;
        const list = withCaptured();
        const idx = list.findIndex(t => t.key === key);
        if (idx < 0) return;
        const t = list[idx];
        if (t.unsaved && !window.confirm(`'${t.meta.title}' 탭에 저장하지 않은 변경사항이 있습니다. 닫을까요?`)) return;
        const rest = list.filter(x => x.key !== key);
        if (!isActive) { tabsRef.current = rest; setTabs(rest); return; }
        const next = rest.length > 0 ? rest[Math.min(idx, rest.length - 1)] : blankTab();
        const finalList = rest.length > 0 ? rest : [next];
        tabsRef.current = finalList;
        setTabs(finalList);
        show(next);
    }, [guardBusy, withCaptured, show]);

    const moveTab = useCallback((from: string, to: string) => {
        if (from === to) return;
        setTabs(prev => {
            const list = [...prev];
            const fi = list.findIndex(t => t.key === from);
            const ti = list.findIndex(t => t.key === to);
            if (fi < 0 || ti < 0) return prev;
            const [m] = list.splice(fi, 1);
            list.splice(ti, 0, m);
            return list;
        });
    }, []);

    const cycleTab = useCallback((dir: 1 | -1) => {
        const list = tabsRef.current;
        if (list.length < 2) return;
        const idx = list.findIndex(t => t.key === activeKeyRef.current);
        switchTab(list[(idx + dir + list.length) % list.length].key);
    }, [switchTab]);

    /** 저장된 프로젝트 열기: 이미 열린 탭이 있으면 그 탭으로, 아니면 새 탭(또는 빈 지금 탭)에 */
    const openProjectInTab = useCallback((pid: number): boolean => {
        const l = liveRef.current;
        if (l.meta.projectId === pid) return true;
        const open = tabsRef.current.find(t => t.key !== activeKeyRef.current && t.meta.projectId === pid);
        if (open) { switchTab(open.key); return true; }
        if (!prepareFreshTab()) return false;
        applyRef.current.loadProjectHere(pid);
        return true;
    }, [switchTab, prepareFreshTab]);

    /** 서버에서 지운 프로젝트 → 열려 있던 탭은 '저장 안 한 새 작업'으로 남김(그림은 지키고 다시 저장하면 새 프로젝트) */
    const forgetProject = useCallback((pid: number) => {
        const l = liveRef.current;
        if (l.meta.projectId === pid) {
            applyRef.current.restoreProject({ ...l.meta, projectId: null });
            applyRef.current.setUnsaved(true);
        }
        setTabs(prev => prev.map(t => (t.key !== activeKeyRef.current && t.meta.projectId === pid)
            ? { ...t, meta: { ...t.meta, projectId: null }, unsaved: true } : t));
    }, []);

    /** 다른 탭으로 보내기 — 지금 레이어는 받는 탭의 현재 프레임에 새 레이어로, 지금 프레임은 받는 탭 맨 끝에 새 프레임으로 */
    const sendToTab = useCallback(async (targetKey: string, what: 'layer' | 'frame') => {
        const src = liveRef.current.getHistory().present;
        const frame = src.frames.find(f => f.id === liveRef.current.activeFrameId) ?? src.frames[0];
        const layer = frame?.layers.find(l => l.id === liveRef.current.activeLayerId) ?? frame?.layers[0];
        const target0 = tabsRef.current.find(t => t.key === targetKey);
        if (!frame || !layer || !target0 || targetKey === activeKeyRef.current) return;
        const to = { width: target0.history.present.width, height: target0.history.present.height };

        const copyLayer = async (l: LayerData, order: number): Promise<LayerData> => ({
            ...l, id: shortId('layer'), layerOrder: order, isLocked: false,
            pixelData: await fitPixelData(l.pixelData, src, to),
        });
        let built: (cur: EditorTab) => EditorTab;
        try {
            if (what === 'layer') {
                const tf = target0.history.present.frames.find(f => f.id === target0.activeFrameId) ?? target0.history.present.frames[0];
                const nl = await copyLayer(layer, tf.layers.length);
                nl.name = `${layer.name} (보냄)`;
                built = cur => {
                    const p = cur.history.present;
                    const fid = p.frames.some(f => f.id === tf.id) ? tf.id : p.frames[0].id;
                    const next = { ...p, frames: p.frames.map(f => f.id !== fid ? f : { ...f, layers: [...f.layers, { ...nl, layerOrder: f.layers.length }] }) };
                    return { ...cur, history: pushHistory(cur.history, next), unsaved: true, activeFrameId: fid, activeLayerId: nl.id };
                };
            } else {
                const layers = await Promise.all(frame.layers.map((l, i) => copyLayer(l, i)));
                const nf: FrameData = { id: shortId('frame'), duration: frame.duration, layers };
                built = cur => {
                    const p = cur.history.present;
                    const next = { ...p, frames: [...p.frames, { ...nf, frameOrder: p.frames.length }] };
                    return { ...cur, history: pushHistory(cur.history, next), unsaved: true, activeFrameId: nf.id, activeLayerId: layers[0]?.id ?? null };
                };
            }
        } catch {
            toast.error('보낼 그림을 만들지 못했어요.');
            return;
        }
        // 그림을 만드는 사이 받는 탭이 지금 탭이 됐거나 닫혔으면 취소(지금 탭은 따로 꺼내 둔 기록이 없음)
        if (targetKey === activeKeyRef.current || !tabsRef.current.some(t => t.key === targetKey)) {
            toast.info('보내는 사이 탭이 바뀌어 취소했어요. 다시 해 주세요.');
            return;
        }
        setTabs(prev => prev.map(t => (t.key === targetKey ? built(t) : t)));
        toast.success(`'${target0.meta.title}' 탭으로 ${what === 'layer' ? '레이어' : '프레임'}를 보냈어요.`);
    }, []);

    /** 복구한 탭들을 뒤에 붙임(지금 탭은 그대로) — 넘치는 것은 버림. 붙인 개수 */
    const appendTabs = useCallback((restored: Omit<EditorTab, 'key'>[]): number => {
        const room = MAX_TABS - tabsRef.current.length;
        const add = restored.slice(0, Math.max(0, room)).map(t => ({ ...t, key: newKey() }));
        if (add.length === 0) return 0;
        const list = [...tabsRef.current, ...add];
        tabsRef.current = list;
        setTabs(list);
        // 지금 탭이 아무것도 안 한 빈 탭이면 첫 복구 탭으로 옮기고 빈 탭은 닫음
        if (isBlank(capture()) && !liveRef.current.busy) {
            const rest = list.filter(t => t.key !== activeKeyRef.current);
            tabsRef.current = rest;
            setTabs(rest);
            show(add[0]);
        }
        return add.length;
    }, [capture, show]);

    /** 자동 저장·나가기 확인용: 지금 탭은 live 값으로 채운 전체 목록 */
    const snapshotAll = useCallback(() => withCaptured(), [withCaptured]);

    const views: TabView[] = useMemo(() => tabs.map(t => t.key === activeKey
        ? { key: t.key, title: live.meta.title, projectId: live.meta.projectId, unsaved: live.unsaved, active: true }
        : { key: t.key, title: t.meta.title, projectId: t.meta.projectId, unsaved: t.unsaved, active: false }),
    [tabs, activeKey, live.meta.title, live.meta.projectId, live.unsaved]);

    const anyUnsaved = live.unsaved || tabs.some(t => t.key !== activeKey && t.unsaved);

    // 저장 안 한 탭이 있으면 새로고침·창 닫기 때 브라우저 확인
    useEffect(() => {
        if (!anyUnsaved) return;
        const onBeforeUnload = (e: BeforeUnloadEvent) => { e.preventDefault(); e.returnValue = ''; };
        window.addEventListener('beforeunload', onBeforeUnload);
        return () => window.removeEventListener('beforeunload', onBeforeUnload);
    }, [anyUnsaved]);

    return {
        tabs: views, activeKey, anyUnsaved,
        switchTab, newTab, closeTab, moveTab, cycleTab, prepareFreshTab,
        openProjectInTab, forgetProject, sendToTab, appendTabs, snapshotAll,
    };
}
