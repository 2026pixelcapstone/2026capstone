/**
 * 자동 저장·복구(PR-E) — 저장 안 한 탭을 3초 쉬면 IndexedDB에 넣고, 에디터를 열 때 지난 세션에 남은 게 있으면 안내 띠로 알림.
 * 사용자가 [복구]·[지우기]를 고르기 전에는 지우지 않음(확인 창은 실수로 닫혀 작업이 지워질 수 있어서 안 씀).
 * 복구한 탭은 '저장 안 함' 탭으로 뒤에 붙음(되돌리기 기록은 없음). 서버 저장은 하지 않음.
 */
import { useCallback, useEffect, useRef, useState } from 'react';
import type { EditorTab } from './useEditorTabs';
import { deleteSessions, readOtherSessions, writeAutosave, type AutosaveSession, type AutosaveTab } from '../../../lib/editorAutosave';
import { toast } from '../../../store/toastStore';

const DEBOUNCE_MS = 3000;

interface Props {
    userId: number | null;
    /** 바뀌면 다시 저장(지금 그림·탭 목록 등) */
    changeKey: unknown;
    snapshotAll: () => EditorTab[];
    appendTabs: (tabs: Omit<EditorTab, 'key'>[]) => number;
}

export function useEditorAutosave({ userId, changeKey, snapshotAll, appendTabs }: Props) {
    const snapRef = useRef(snapshotAll);
    snapRef.current = snapshotAll;
    const appendRef = useRef(appendTabs);
    appendRef.current = appendTabs;

    // 열 때: 지난 세션에 남은 작업 찾기(readOtherSessions가 페이지당 한 번만 읽음 — StrictMode 2회 실행 대비)
    const [pending, setPending] = useState<AutosaveSession[]>([]);
    useEffect(() => {
        if (!userId) return;
        let cancelled = false;
        readOtherSessions(userId)
            .then(s => { if (!cancelled) setPending(s); })
            .catch(() => { /* IndexedDB를 못 쓰는 환경(사생활 보호 모드 등) — 조용히 넘어감 */ });
        return () => { cancelled = true; };
    }, [userId]);

    const pendingCount = pending.reduce((n, s) => n + s.tabs.length, 0);

    const restorePending = useCallback(() => {
        const tabs = pending.flatMap(s => s.tabs);
        if (tabs.length === 0) return;
        const added = appendRef.current(tabs.map((t: AutosaveTab) => ({
            history: { past: [], present: t.canvas, future: [] },
            meta: { projectId: t.projectId, title: t.title, isPublic: t.isPublic },
            unsaved: true,
            palette: t.palette,
            activeFrameId: t.activeFrameId,
            activeLayerId: t.activeLayerId,
        })));
        if (added === 0) { toast.info('탭이 가득 차 복구하지 못했어요. 탭을 닫고 다시 눌러 주세요.'); return; }
        if (added < tabs.length) toast.info(`탭이 가득 차 ${added}개만 복구했어요(나머지는 지웠어요).`);
        else toast.success(`${added}개 작업을 복구했어요.`);
        deleteSessions(pending.map(s => s.sessionId)).catch(() => {});
        setPending([]);
    }, [pending]);

    const discardPending = useCallback(() => {
        deleteSessions(pending.map(s => s.sessionId)).catch(() => {});
        setPending([]);
    }, [pending]);

    // 바뀔 때마다 3초 쉬면 저장
    useEffect(() => {
        if (!userId) return;
        const t = setTimeout(() => {
            const tabs: AutosaveTab[] = snapRef.current().filter(x => x.unsaved).map(x => ({
                projectId: x.meta.projectId,
                title: x.meta.title,
                isPublic: x.meta.isPublic,
                canvas: x.history.present,
                palette: x.palette,
                activeFrameId: x.activeFrameId,
                activeLayerId: x.activeLayerId,
            }));
            writeAutosave(userId, tabs).catch(() => {});
        }, DEBOUNCE_MS);
        return () => clearTimeout(t);
    }, [userId, changeKey]);

    return { pendingCount, restorePending, discardPending };
}
