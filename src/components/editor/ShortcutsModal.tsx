import { useRef } from 'react';
import { useFocusTrap } from '../../hooks/useFocusTrap';

/** 도움말 › 단축키 목록(PR-F) — 키는 자판 위치 기준이라 한글 자판에서도 같음 */
const GROUPS: { title: string; items: [string, string][] }[] = [
    { title: '도구', items: [['P', '연필'], ['E', '지우개'], ['G', '채우기'], ['I / Alt 누르고 있기', '스포이드'], ['L', '직선'], ['R', '사각형'], ['O', '원'], ['M', '사각 선택'], ['Q', '올가미'], ['V', '이동'], ['H / Space 누르고 있기', '손(화면 이동)'], ['[ ]', '붓 크기'], ['X', '전경·배경색 바꾸기']] },
    { title: '편집', items: [['Ctrl+Z', '실행 취소'], ['Ctrl+Y / Ctrl+Shift+Z', '다시 실행'], ['Ctrl+C / X / V', '복사·잘라내기·붙여넣기'], ['Ctrl+A', '모두 선택'], ['Ctrl+D', '선택 해제'], ['Ctrl+Shift+I', '선택 반전'], ['Delete', '선택 영역 지우기'], ['Esc', '선택 해제'], ['Ctrl+Alt+C', '캔버스 크기']] },
    { title: '보기', items: [['= / -', '확대·축소(마우스 휠도)'], ['1', '실제 크기(1배)'], ['0', '화면에 맞추기']] },
    { title: '레이어·프레임', items: [['Ctrl+E', '아래 레이어와 병합'], [', / .', '이전·다음 프레임'], ['Shift+Enter', '재생·정지']] },
    { title: '파일·탭', items: [['Ctrl+S', '저장'], ['Ctrl+Shift+S', '다른 이름으로 저장'], ['Ctrl+Alt+N', '새 탭'], ['Ctrl+Alt+W', '탭 닫기'], ['Ctrl+Alt+← / →', '탭 이동'], ['Shift+/', '이 목록']] },
];

export function ShortcutsModal({ onClose }: { onClose: () => void }) {
    const ref = useRef<HTMLDivElement>(null);
    useFocusTrap(true, ref, onClose);
    return (
        <div className="fixed inset-0 z-[70] flex items-center justify-center bg-black/60 p-4" onClick={onClose}>
            <div ref={ref} role="dialog" aria-modal="true" aria-labelledby="shortcuts-title"
                className="w-full max-w-3xl max-h-[85vh] overflow-y-auto rounded-2xl p-6"
                style={{ background: 'var(--color-surface)', border: '1px solid var(--color-outline)' }}
                onClick={e => e.stopPropagation()}>
                <div className="flex items-center justify-between mb-4">
                    <h2 id="shortcuts-title" className="text-base font-bold" style={{ color: 'var(--color-on-surface)' }}>단축키 목록</h2>
                    <button type="button" onClick={onClose} aria-label="닫기" className="w-8 h-8 flex items-center justify-center rounded-lg hover:bg-surface-container"
                        style={{ color: 'var(--color-on-surface-variant)' }}>
                        <span className="material-symbols-outlined text-base">close</span>
                    </button>
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-5">
                    {GROUPS.map(g => (
                        <section key={g.title}>
                            <h3 className="text-xs font-bold mb-2" style={{ color: 'var(--color-primary)' }}>{g.title}</h3>
                            <dl className="space-y-1">
                                {g.items.map(([k, v]) => (
                                    <div key={k} className="flex items-center justify-between gap-4 text-sm">
                                        <dt style={{ color: 'var(--color-on-surface-variant)' }}>{v}</dt>
                                        <dd><kbd className="px-1.5 py-0.5 rounded text-xs font-mono" style={{ background: 'var(--color-surface-container-high)', color: 'var(--color-on-surface)' }}>{k}</kbd></dd>
                                    </div>
                                ))}
                            </dl>
                        </section>
                    ))}
                </div>
            </div>
        </div>
    );
}
