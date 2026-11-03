export function LayerTap() {
    return(
        <div className="flex flex-col h-full overflow-y-auto custom-scrollbar" style={{background: 'var(--color-surface)'}}>
            {/* 상단 탭 헤더 */}
            <div 
                className="flex items-center justify-between px-4 py-3 border-b flex-shrink-0" 
                style={{borderColor: 'var(--color-outline)'}}
            >
                <span className="text-us font-bold tracking-wider text-on-surface-variant">레이어</span>
                
            </div>
        </div>
    )
}