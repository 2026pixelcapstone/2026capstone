/**
 * 에디터 → 에셋 등록 페이지로 파일 넘기기(PR-C).
 * 에디터를 떠나면 저장 안 한 그림이 사라지므로 등록 페이지는 새 탭으로 엶 → 탭 사이에 파일(Blob)을 넘기려고 IndexedDB를 씀
 * (localStorage는 문자열만·용량 작음). 한 번 꺼내면 지움. 같은 출처·같은 브라우저에서만 보임.
 */
const DB = 'pixelpilot-handoff';
const STORE = 'drafts';

export interface AssetDraft {
    title: string;
    preview: File;      // 미리보기 이미지(PNG·GIF)
    bundle: File;       // 다운로드 파일(zip)
    createdAt: number;
}

function open(): Promise<IDBDatabase> {
    return new Promise((resolve, reject) => {
        const req = indexedDB.open(DB, 1);
        req.onupgradeneeded = () => req.result.createObjectStore(STORE);
        req.onsuccess = () => resolve(req.result);
        req.onerror = () => reject(req.error);
    });
}

export async function putAssetDraft(draft: AssetDraft): Promise<string> {
    const id = crypto.randomUUID();
    const db = await open();
    await new Promise<void>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        tx.objectStore(STORE).put(draft, id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => reject(tx.error);
    });
    db.close();
    return id;
}

// 같은 id를 두 번 꺼내도(개발 모드 StrictMode의 effect 2회 실행 등) 같은 결과를 받게 — 첫 번째가 지워 두 번째가 빈손이 되는 것 방지
const taking = new Map<string, Promise<AssetDraft | null>>();

/** 꺼내면서 지움. 하루 지난 것은 버림 */
export function takeAssetDraft(id: string): Promise<AssetDraft | null> {
    let p = taking.get(id);
    if (!p) {
        p = takeOnce(id);
        taking.set(id, p);
    }
    return p;
}

async function takeOnce(id: string): Promise<AssetDraft | null> {
    const db = await open();
    const draft = await new Promise<AssetDraft | null>((resolve, reject) => {
        const tx = db.transaction(STORE, 'readwrite');
        const store = tx.objectStore(STORE);
        const req = store.get(id);
        req.onsuccess = () => { store.delete(id); resolve((req.result as AssetDraft) ?? null); };
        req.onerror = () => reject(req.error);
    });
    db.close();
    if (draft && Date.now() - draft.createdAt > 24 * 60 * 60 * 1000) return null;
    return draft;
}
