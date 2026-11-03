import React from "react";

interface EditorPalette{
    paletteColors: string[];
    fgColor: string; 
    setPaletteBrowserOpen: React.Dispatch<React.SetStateAction<boolean>>;
    setPaletteSaveOpen: React.Dispatch<React.SetStateAction<boolean>>;
    addColorsToPalette: (colors: string[]) => void;
    selectPaletteColor: (color: string) => void;
}
export function EditorPalette({
    paletteColors,
    fgColor,
    setPaletteBrowserOpen,
    setPaletteSaveOpen,
    addColorsToPalette,
    selectPaletteColor,
}: EditorPalette){
    return(
        <div className="p-4 border-b" style={{ borderColor: 'var(--color-outline)' }}>
            <div className="flex items-center justify-between mb-3">
                <div className="text-xs font-bold uppercase tracking-widest" style={{ color: 'var(--color-on-surface-variant)' }}>Palette</div>
                    <div className="flex gap-1">
                        {([
                        ['add', '현재 색을 팔레트에 추가', () => addColorsToPalette([fgColor])],
                        ['upload', '팔레트 가져오기', () => setPaletteBrowserOpen(true)],
                        ['save', '현재 팔레트를 커뮤니티에 저장', () => setPaletteSaveOpen(true)],
                        ] as const).map(([icon, tip, onClick]) => (
                        <button key={icon} type="button" title={tip} aria-label={tip} onClick={onClick}
                            className="w-7 h-7 flex items-center justify-center rounded-lg transition-all hover:bg-surface-container"
                            style={{ color: 'var(--color-on-surface-variant)' }}>
                            <span className="material-symbols-outlined text-sm">{icon}</span>
                        </button>
                        ))}
                    </div>
                </div>
                <div className="grid grid-cols-7 gap-1.5 px-1">
                {paletteColors.map(c => (
                    <button
                    key={c}
                    onClick={() => { selectPaletteColor(c) }}
                    aria-label={`색상 ${c}`}
                    title={c}
                    className="w-8 h-8 rounded cursor-pointer transition-all border-2 hover:scale-110"
                    style={{ background: c, borderColor: fgColor === c ? 'var(--color-on-surface)' : 'transparent' }} />
                ))}
                </div>
            <button 
                type="button" 
                onClick={() => setPaletteBrowserOpen(true)}
                className="mt-3 text-xs font-bold hover:underline px-1"
                style={{ color: 'var(--color-primary)' }}>팔레트 둘러보기…
            </button>
        </div>
    )

}