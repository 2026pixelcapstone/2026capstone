import { MENU_DEFS } from "../../constants/editor/menuConfig";
import { MENU_ACTION, MenuActionId } from "../../type/editorType";
import React, { useEffect, useRef, useState } from "react";

interface FileActions{
    handleNewProject: () => void;
    setOpenProjectModalOpen: React.Dispatch<React.SetStateAction<boolean>>
    handleOpenPpit: () => void;
    openSaveModal: () => void;
    handleExportImage: () => void;
    handleExportPpit: () => void;
    handleBackToMain: () => void;
}

interface EditActions{
    undo: () => void;
    redo: () => void;
}

interface ViewActions{
    setZoomIdx: React.Dispatch<React.SetStateAction<number>>;
    showGridLines: boolean;
    setShowGridLines: React.Dispatch<React.SetStateAction<boolean>>;
}

interface LayerAction{
    handleAddLayer: () => void;
    handleDeleteLayer: () => void;
}

interface PixelGuide{
    showAIGuide: boolean;
    setShowAIGuide: React.Dispatch<React.SetStateAction<boolean>>;
}

interface MenuBarProps {
   fileActions: FileActions;
   editActions: EditActions;
   viewActions: ViewActions;
   layerActions: LayerAction;
   pixelGuides: PixelGuide;
}

export default function MenuBar({
    fileActions,
    editActions,
    viewActions,
    layerActions, // <- 임시 주석
    pixelGuides,

}: MenuBarProps){
    const [openMenu, setOpenMenu] = useState<string | null>(null);

    const menuContainerRef = useRef<HTMLDivElement>(null);

      // 메뉴 외부 클릭 시 닫기
      useEffect(() => {
        const handleClickOutside = (e: MouseEvent) => {
          if (menuContainerRef.current && ! menuContainerRef.current.contains(e.target as Node)) {
            setOpenMenu(null)
          }
        }
        if (openMenu) document.addEventListener('mousedown', handleClickOutside)
        return () => document.removeEventListener('mousedown', handleClickOutside)
      }, [openMenu])
    
    // 통합 액션 핸들러
    const handleAction = (actionId: MenuActionId) => {

        setOpenMenu(null) // 메뉴 닫기
        switch(actionId) {
            // File
            case MENU_ACTION.NEW_PROJECT:
                fileActions.handleNewProject();
                break;
            case MENU_ACTION.OPEN_PROJECT:
                fileActions.setOpenProjectModalOpen(true);
                break;
            case MENU_ACTION.OPEN_PPIT:
                fileActions.handleOpenPpit();
                break;
            case MENU_ACTION.SAVE:
                fileActions.openSaveModal();
                break;
            case MENU_ACTION.BROWSER_SAVE:
                break;
            case MENU_ACTION.EXPORT_IMAGE:
                fileActions.handleExportImage();
                break;
            case MENU_ACTION.EXPORT_SPRITESHEET:
                break;
            case MENU_ACTION.DOWNLOAD_PPIT:
                fileActions.handleExportPpit();
                break;
            case MENU_ACTION.BACK_TO_MAIN:
                fileActions.handleBackToMain();
                break;
            
            // Edit
            case MENU_ACTION.UNDO:
                editActions.undo();
                break;
            case MENU_ACTION.REDO:
                editActions.redo();
                break;
            case MENU_ACTION.CUT:
                break;
            case MENU_ACTION.COPY:
                break;
            case MENU_ACTION.PASTE:
                break;
            case MENU_ACTION.RESIZE:
                break;
            case MENU_ACTION.SELECT_ALL:
                break;
            case MENU_ACTION.DESELECT:
                break;
            // image
            case MENU_ACTION.FLIP_HORIZONTAL:
                break;
            case MENU_ACTION.FLIP_VERTICAL:
                break;
            case MENU_ACTION.ROTATE_90_CW:
                break;
            // view
            case MENU_ACTION.FIT_SCREEN:
                viewActions.setZoomIdx(6);
                break;
            /*case MENU_ACTION.100:
                break;
            */
            case MENU_ACTION.TOGGLE_GRID:
                viewActions.setShowGridLines(!viewActions.showGridLines);
                break;

            // layer
            case MENU_ACTION.ADD_LAYER:
                layerActions.handleAddLayer();
                break;
            case MENU_ACTION.DELETE_LAYER:
                layerActions.handleDeleteLayer();
                break;
            case MENU_ACTION.DUPLICATE:
                break;
            case MENU_ACTION.MOVE_UP:
                break;
            case MENU_ACTION.MOVE_DOWN:
                break;
            case MENU_ACTION.MERGE_VISIBLE:
                break;
            case MENU_ACTION.FLATTEN:
                break;
            
            // pixel-guide
            case MENU_ACTION.TOGGLE_PIXEL_COUNTER:
                break;
            case MENU_ACTION.TOGGLE_RATIO_GUIDE:
                break;
            case MENU_ACTION.TOGGLE_GRID_SNAP:
                break;
            case MENU_ACTION.TOGGLE_AI_GUIDE:
                pixelGuides.setShowAIGuide(!pixelGuides.showAIGuide)
                break;            
        }
    };
    return(
        <div ref={menuContainerRef} className="flex items-center h-full">
            {/* 메뉴 그룹 루프 */}
            {MENU_DEFS.map(menu => (
                // relative -> absolute의 기준점으로, 드롭다운 박스가 정확히 클릭한 메뉴 버튼의 바로 아래에 띄워지게 된다
                <div key={menu.id} className="relative h-full flex items-center">
                    <button // 상단 메뉴 버튼 설정
                        onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
                        // px-3: 버튼 내부의 좌우 여백 12px, h-full: 감지 범위도 상하로 넒어짐 text-sm: 글자 크기 14px, transition-colors: 마우스를 올리거나 메뉴가 열렸을 때 애니메이션 효과
                        className="px-3 h-full text-sm transition-colors" 
                        style={{
                            // --color-on-surface: 색상 값을 적는 대신 의미가 부여돈 이름으로 색상 관리
                            color: openMenu === menu.id ? 'var(--color-on-surface)' : 'var(--color-on-surface)',
                            background: openMenu === menu.id ? 'var(--color-surface-container)' : 'transparent',
                        }}>
                        {menu.label}
                    </button>
                
                    {/* 드롭다운 메뉴 */}
                    {openMenu === menu.id && (
                        <div className="absolute top-full left-0 rounded-b-lg border shadow-2xl py-1 z-50 min-w-[220px]"
                        style={{ 
                                background: 'var(--color-surface-container)', 
                                borderColor: 'var(--color-outline)', 
                                borderTopColor: 'transparent' 
                            }}
                        >
                        {menu.items.map((item, idx) => {
                            // 1. 구분선
                            if ('separator' in item) {
                                return (
                                    <div 
                                        key={idx} className="my-1 border-t" 
                                        style={{ borderColor: 'var(--color-outline)' }} 
                                    />
                                )
                            }
                            // 2. Dynamic label 처리
                            const itemlabel = item.id === MENU_ACTION.TOGGLE_GRID
                                ? (viewActions.showGridLines ? 'Hide Grid' : 'Show Grid') 
                                : item.label;
                            
                            // 3. 일반 메뉴 버튼
                            return (
                                <button 
                                    key={item.id}
                                    onClick={() => handleAction(item.id)}
                                    disabled={item.disabled}
                                    className="w-full flex items-center gap-2.5 px-4 py-1.5 text-sm text-left transition-colors hover:bg-surface-container-high disabled:opacity-40 disabled:cursor-default">
                                    {item.icon && (
                                    <span className="material-symbols-outlined text-sm w-4 flex-shrink-0"
                                        style={{ color: 'var(--color-on-surface-variant)' }}>{item.icon}</span>
                                    )}
                                    <span className="flex-1" style={{ color: 'var(--color-on-surface)' }}>{itemlabel}</span>
                                    {item.shortcut && (
                                    <span className="text-xs ml-4" style={{ color: 'var(--color-on-surface-variant)' }}>{item.shortcut}</span>
                                    )}
                                </button>
                            )
                        })}
                        </div>
                    )}
                </div>
            ))}
        </div>
    )

}