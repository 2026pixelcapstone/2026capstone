import React from "react";

interface RightSideBarProps{
    activeRightTab: 'main' | 'layers' | 'palette' | 'CanvasSize';
    setActiveRightTab: React.Dispatch<React.SetStateAction<'main' | 'layers' | 'palette' | 'CanvasSize'>>;
}
export function EditorRightSideBar({
    activeRightTab,
    setActiveRightTab,
}: RightSideBarProps){
    
    return(
        <div className="w-12 flex flex-col flex-shrink-0 border-l items-center py-2 space-y-3"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
            

            <button 
                onClick={() => {
                    setActiveRightTab('main');
                }}
                title="홈"
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    activeRightTab === 'main'
                    ? 'bg-primary/20 text-primary'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}   
            >
                <span className="material-symbols-outlined text-[38px]">home</span>
            </button>
            
            <button 
                onClick={() => {
                    setActiveRightTab('layers');
                }} 
                title="레이어"
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    activeRightTab === 'layers' 
                    ? 'bg-primary/20 text-primary' 
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
            >
                <span className="material-symbols-outlined text-[38px]">layers</span>
            </button>

            <button 
                onClick={() => {
                    setActiveRightTab('palette');
                }} 
                title="팔레트"
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    activeRightTab === 'palette' 
                    ? 'bg-primary/20 text-primary' 
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
            >
                <span className="material-symbols-outlined text-[38px]">palette</span>
            </button>
            
            {/* 크기 설정 영역 위쪽 테두리 (구분선) */}
            <div className="w-full border-t my-1" style={{ borderColor: 'var(--color-outline)' }} />

            {/* 크기 설정 모달 버튼 */}
            <button
                onClick={() => {
                    setActiveRightTab('CanvasSize');
                }}
                title="크기 설정"
                className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                    activeRightTab === 'CanvasSize'
                    ? 'bg-primary/20 text-primary'
                    : 'text-on-surface-variant hover:bg-surface-container'
                }`}
            >
                <span className="material-symbols-outlined text-[38px]">aspect_ratio</span>
            </button>

            {/* 추후 도구 옵션 등 추가 탭 버튼이 들어갈 자리 */}
        </div>
    )
}