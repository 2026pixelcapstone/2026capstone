/**
 * 에디터 자동 저장·복구(PR-E).
 * 저장 안 한 탭의 그림을 브라우저 IndexedDB에 몇 초마다 넣어 두고, 다음에 에디터를 열면 복구할지 묻는다.
 * - 페이지(브라우저 탭)마다 세션 id 하나 → 창을 여러 개 띄워도 서로 덮어쓰지 않음
 * - 사용자 id별로 나눠 다른 계정에 남의 작업이 뜨지 않게
 * - 되돌리기 기록은 넣지 않음(현재 그림만), 7일 지난 것은 버림
 */
import type { CanvasState } from '../type/editor';

const DB = 'pixelpilot-autosave';
const STORE = 'sessions';
const MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;

export interface AutosaveTab {
    projectId: number | null;
    title: string;
    isPublic: boolean;
    canvas: CanvasState;
    palette: string[];
    activeFrameId: string | null;
    activeLayerId: string | null;
}

export interface AutosaveSession {
    sessionId: string;
    userId: number;
    updatedAt: number;
    tabs: AutosaveTab[];
}

/** 이 페이지의 세션 id(새로고침하면 바뀜) */
export const AUTOSAVE_SESSION_ID = crypto.randomUUID();

function open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE, { keyPath: 'sessionId' });
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

async function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T> | void): Promise<T | undefined> {
    const db = await open();
    try {
        return await new Promise<T | undefined>((resolve, reject) => {
            const tx = db.transaction(STORE, mode);
            const req = fn(tx.objectStore(STORE));
            tx.oncomplete = () => resolve(req ? req.result : undefined);
            tx.onerror = () => reject(tx.error);
            tx.onabort = () => reject(tx.error);
        });
    } finally {
        db.close();
    }
}

/** 저장할 탭이 없으면 이 세션 기록을 지움 */
export async function writeAutosave(userId: number, tabs: AutosaveTab[]): Promise<void> {
    if (tabs.length === 0) {
        await run('readwrite', s => { s.delete(AUTOSAVE_SESSION_ID); });
        return;
    }
    const session: AutosaveSession = { sessionId: AUTOSAVE_SESSION_ID, userId, updatedAt: Date.now(), tabs };
    await run('readwrite', s => { s.put(session); });
}

// StrictMode의 effect 2회 실행에도 한 번만 꺼내지도록(TROUBLESHOOTING #52 같은 문제)
let pending: Promise<AutosaveSession[]> | null = null;

/** 이 사용자의 다른 세션(지난 페이지)들 — 오래된 것은 지움 */
export function readOtherSessions(userId: number): Promise<AutosaveSession[]> {
    pending ??= (async () => {
        const all = (await run<AutosaveSession[]>('readonly', s => s.getAll())) ?? [];
        const now = Date.now();
        const stale = all.filter(x => now - x.updatedAt > MAX_AGE_MS);
        if (stale.length) await run('readwrite', s => { stale.forEach(x => s.delete(x.sessionId)); });
        return all
            .filter(x => x.sessionId !== AUTOSAVE_SESSION_ID && x.userId === userId && now - x.updatedAt <= MAX_AGE_MS && x.tabs.length > 0)
            .sort((a, b) => b.updatedAt - a.updatedAt);
    })();
    return pending;
}

export async function deleteSessions(ids: string[]): Promise<void> {
    if (ids.length === 0) return;
    await run('readwrite', s => { ids.forEach(id => s.delete(id)); });
}
