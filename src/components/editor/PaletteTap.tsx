export function PaletteTap(){
    return(
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar" style={{background: 'var(--color-surface)'}}>
            {/* 상단 탭 헤더 */}
            <div 
                className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" 
                style={{borderColor: 'var(--color-outline)'}}
            >
                <span className="text-us font-bold tracking-wider text-on-surface-variant">팔레트</span>
                <button className="flex items-center justify-center p-1 rounded hover:bg-surface-container transition-colors text-on-surface-variant">
                    <span className="material-symbols-outlined text-sm">create_new_folder</span>
                </button>
            </div>
        </div>

    )
}