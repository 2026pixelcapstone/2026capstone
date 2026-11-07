import React, { useEffect, useRef, useState } from "react";
import { EditorCanvasSize } from "./EditorCanvasSize";

interface RightSideBarProps{
    activeRightTab: 'main' | 'layers' | 'palette' | 'CanvasSize';
    setActiveRightTab: React.Dispatch<React.SetStateAction<'main' | 'layers' | 'palette' | 'CanvasSize'>>;
    customW: number;
    customH: number;
    isScaleImage: boolean;
    setCustomW: React.Dispatch<React.SetStateAction<number>>;
    setCustomH: React.Dispatch<React.SetStateAction<number>>;
    setIsScaleImage: React.Dispatch<React.SetStateAction<boolean>>;
    applyCanvasSize: (w: number, h: number) => void
    openCanvasSizeRequest?: number;   // 편집 > 크기 조절 메뉴: 값이 바뀌면 크기 창을 엶(PR-B)
    anchor?: { x: number; y: number };   // 크기 바꿀 때 기준점(PR-F)
    setAnchor?: (a: { x: number; y: number }) => void;
}
export function EditorRightSideBar({
    activeRightTab,
    setActiveRightTab,
    customW, 
    customH,
    isScaleImage,
    setCustomW,
    setCustomH,
    setIsScaleImage, 
    applyCanvasSize,
    openCanvasSizeRequest = 0,
    anchor,
    setAnchor,
}: RightSideBarProps){
    
    const [modalPos, setModalPos] = useState({ top: 0, left: 0 });
    const [isCanvasSizeModal, setIsCanvasSizeModal] = useState<boolean>(false);
    const sizeBtnRef = useRef<HTMLButtonElement>(null);

    // 메뉴에서 연 경우: 버튼 위치 기준으로 열기(이미 열려 있으면 그대로)
    useEffect(() => {
        if (!openCanvasSizeRequest || !sizeBtnRef.current) return;
        const rect = sizeBtnRef.current.getBoundingClientRect();
        setModalPos({ top: rect.top, left: rect.right - 310 });
        setIsCanvasSizeModal(true);
    }, [openCanvasSizeRequest]);
    
    const handleOpenModal = (e: React.MouseEvent<HTMLButtonElement>) => {
        // 버튼의 화면상 크기와 위치 정보 가져오기
        const rect = e.currentTarget.getBoundingClientRect();

        setModalPos({
            top: rect.top, // 버튼의 상단과 맞춤
            left: rect.right - 310, // 버튼의 오른쪽 끝 + 여백 10px 위치
        });
        setIsCanvasSizeModal(!isCanvasSizeModal);
    };

    return(
        <div className="w-15 flex flex-col flex-shrink-0 border-l items-center py-2 space-y-3"
            style={{ background: 'var(--color-surface)', borderColor: 'var(--color-outline)' }}>
            {/* 오른쪽 바의 내용물을 나타내는 버튼 */}
            <div className="w-full flex flex-col items-center py-2 space-y-3 pb-4"
                style={{background: 'var(--color-surface)'}}>
                {/* 홈 버튼 */}
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
                    <span className="material-symbols-outlined text-[40px]">home</span>

                </button>
                {/* 레이어 버튼 */}
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
                    <span className="material-symbols-outlined text-[40px]">layers</span>

                </button>

                {/* 팔레트 버튼 */}
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
                    <span className="material-symbols-outlined text-[40px]">palette</span>
                </button>
            </div>

            
            {/* 모달을 띄우는 버튼 */}
            <div className="w-full flex flex-col items-center py-2 space-y-3 mt-2">
                {/* 크기 설정 모달 버튼 */}
                <button
                    ref={sizeBtnRef}
                    onClick={(e) => {
                        handleOpenModal(e);
                    }}
                    title="크기 설정"
                    className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                        isCanvasSizeModal
                        ? 'bg-primary/20 text-primary'
                        : 'text-on-surface-variant hover:bg-surface-container'
                    }`}
                >
                    <span className="material-symbols-outlined text-[38px]">aspect_ratio</span>
                </button>
            </div>
        
            {/* 캔버스 크기 섹션 */}
            <EditorCanvasSize
                position={modalPos}
                isOpen = {isCanvasSizeModal}
                customW = {customW}
                customH = {customH}
                isScaleImage = {isScaleImage}
                onClose={() => setIsCanvasSizeModal(false)}
                setCustomW = {setCustomW}
                setCustomH = {setCustomH}
                setIsScaleImage = {setIsScaleImage}
                applyCanvasSize = {applyCanvasSize}
                anchor={anchor}
                setAnchor={setAnchor}
            />
        </div>
    )
}