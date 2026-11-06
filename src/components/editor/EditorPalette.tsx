import React, { useRef, useState } from "react";
import { toast } from "../../store/toastStore";
import { parsePaletteFile, safeFileName, saveFile, toGplFile, toHexFile, toJascPalFile, toPngBlob } from "../../lib/paletteExport";

interface EditorPalette{
    paletteColors: string[];
    fgColor: string;
    setPaletteBrowserOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setPaletteSaveOpen: React.Dispatch<React.SetStateAction<boolean>>;
    addColorsToPalette: (colors: string[]) => void;
    selectPaletteColor: (color: string) => void;
    /** PR-F: 색 지우기·순서 바꾸기·파일 가져오기(없으면 그 기능 숨김) */
    setPaletteColors?: React.Dispatch<React.SetStateAction<string[]>>;
    /** 파일 이름에 쓸 이름(프로젝트 제목) */
    fileName?: string;
    /** 최근 쓴 색(PR-G) — 팔레트 위 한 줄 */
    recentColors?: string[];
}

const same = (a: string, b: string) => a.toLowerCase() === b.toLowerCase();

export function EditorPalette({
    paletteColors,
    fgColor,
    setPaletteBrowserOpen,
    setPaletteSaveOpen,
    addColorsToPalette,
    selectPaletteColor,
    setPaletteColors,
    fileName = 'palette',
    recentColors = [],
}: EditorPalette){
    const fileRef = useRef<HTMLInputElement>(null);
    const [dragIdx, setDragIdx] = useState<number | null>(null);
    const [exportOpen, setExportOpen] = useState(false);
    const inPalette = paletteColors.some(c => same(c, fgColor));

    const removeColor = (color: string) => {
        if (!setPaletteColors) return;
        setPaletteColors(prev => prev.filter(c => !same(c, color)));
    };

    const importFile = async (file: File) => {
        if (!setPaletteColors) return;
        if (file.size > 200_000) { toast.error('팔레트 파일이 너무 커요.'); return; }
        const colors = parsePaletteFile(await file.text());
        if (colors.length === 0) { toast.error('파일에서 색을 찾지 못했어요(.hex·.gpl·.pal 지원).'); return; }
        setPaletteColors(colors);
        toast.success(`팔레트 ${colors.length}색을 불러왔어요.`);
    };

    const exportAs = async (kind: 'hex' | 'gpl' | 'pal' | 'png') => {
        setExportOpen(false);
        const name = safeFileName(fileName);
        const hex6 = paletteColors.map(c => c.slice(0, 7));
        if (kind === 'hex') saveFile(toHexFile(hex6), `${name}.hex`);
        else if (kind === 'gpl') saveFile(toGplFile(fileName, hex6), `${name}.gpl`);
        else if (kind === 'pal') saveFile(toJascPalFile(hex6), `${name}.pal`);
        else saveFile(await toPngBlob(hex6, 8), `${name}.png`, 'image/png');
    };

    const buttons = [
        ['add', '현재 색을 팔레트에 추가', () => addColorsToPalette([fgColor]), false],
        ...(setPaletteColors ? [['remove', '현재 색을 팔레트에서 빼기(색 칸 우클릭도 됨)', () => removeColor(fgColor), !inPalette] as const] : []),
        ['upload', '커뮤니티 팔레트 가져오기', () => setPaletteBrowserOpen(true), false],
        ['save', '현재 팔레트를 커뮤니티에 저장', () => setPaletteSaveOpen(true), false],
    ] as const;

    return(
        <div className="p-4 border-b" style={{ borderColor: 'var(--color-outline)' }}>
            <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)' }}>팔레트 <span className="font-normal normal-case">({paletteColors.length})</span></div>
                    <div className="flex gap-1 relative">
                        {buttons.map(([icon, tip, onClick, disabled]) => (
                        <button key={icon} type="button" title={tip} aria-label={tip} onClick={onClick} disabled={disabled}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-surface-container disabled:opacity-30"
                            style={{ color: 'var(--color-on-surface-variant)' }}>
                            <span className="material-symbols-outlined text-sm">{icon}</span>
                        </button>
                        ))}
                        {setPaletteColors && (
                          <button type="button" title="팔레트 파일 내보내기·불러오기" aria-label="팔레트 파일 내보내기·불러오기" aria-expanded={exportOpen}
                            onClick={() => setExportOpen(v => !v)}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-surface-container"
                            style={{ color: 'var(--color-on-surface-variant)' }}>
                            <span className="material-symbols-outlined text-sm">more_vert</span>
                          </button>
                        )}
                        {exportOpen && (
                          <div className="absolute right-0 top-8 z-20 w-48 py-1 rounded-lg shadow-xl"
                            style={{ background: 'var(--color-surface-container)', border: '1px solid var(--color-outline)' }}>
                            <button type="button" onClick={() => { setExportOpen(false); fileRef.current?.click(); }}
                              className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-container-high">파일에서 불러오기(.hex·.gpl·.pal)…</button>
                            <div className="my-1 border-t" style={{ borderColor: 'var(--color-outline)' }} />
                            {(['hex', 'gpl', 'pal', 'png'] as const).map(k => (
                              <button key={k} type="button" onClick={() => { void exportAs(k); }}
                                className="w-full text-left px-3 py-1.5 text-xs hover:bg-surface-container-high">.{k} 로 내보내기</button>
                            ))}
                          </div>
                        )}
                    </div>
                </div>
                {recentColors.length > 0 && (
                  <div className="flex items-center gap-1 px-1 mb-2" aria-label="최근 쓴 색">
                    <span className="text-[11px] mr-1 flex-shrink-0" style={{ color: 'var(--color-on-surface-variant)' }}>최근</span>
                    {recentColors.map(c => (
                      <button key={c} type="button" onClick={() => selectPaletteColor(c)} aria-label={`최근 색 ${c}`} title={c}
                        className="w-5 h-5 rounded-sm border hover:scale-110 transition-transform"
                        style={{ background: c, borderColor: same(fgColor, c) ? 'var(--color-on-surface)' : 'var(--color-outline)' }} />
                    ))}
                  </div>
                )}
                <div className="grid grid-cols-7 gap-1.5 px-1">
                {paletteColors.map((c, i) => (
                    <button
                    key={c}
                    onClick={() => { selectPaletteColor(c) }}
                    onContextMenu={e => { if (!setPaletteColors) return; e.preventDefault(); removeColor(c); }}
                    draggable={!!setPaletteColors}
                    onDragStart={e => { setDragIdx(i); e.dataTransfer.effectAllowed = 'move'; }}
                    onDragOver={e => { if (dragIdx !== null) e.preventDefault(); }}
                    onDrop={e => {
                        e.preventDefault();
                        if (dragIdx === null || !setPaletteColors || dragIdx === i) { setDragIdx(null); return; }
                        const from = dragIdx;
                        setPaletteColors(prev => { const next = [...prev]; const [m] = next.splice(from, 1); next.splice(i, 0, m); return next; });
                        setDragIdx(null);
                    }}
                    onDragEnd={() => setDragIdx(null)}
                    aria-label={`색상 ${c}`}
                    title={setPaletteColors ? `${c} — 끌어서 순서 바꾸기, 우클릭으로 빼기` : c}
                    className="w-8 h-8 rounded cursor-pointer transition-all border-2 hover:scale-110"
                    style={{ background: c, borderColor: same(fgColor, c) ? 'var(--color-on-surface)' : 'transparent', opacity: dragIdx === i ? 0.4 : 1 }} />
                ))}
                </div>
            <button
                type="button"
                onClick={() => setPaletteBrowserOpen(true)}
                className="mt-3 text-xs font-bold hover:underline px-1"
                style={{ color: 'var(--color-primary)' }}>팔레트 둘러보기…
            </button>
            <input ref={fileRef} type="file" accept=".hex,.gpl,.pal,.txt" className="hidden"
                onChange={e => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void importFile(f); }} />
        </div>
    )

}
