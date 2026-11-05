import { getLabel } from "../../utils/editorUtils";
import { MENU_DEFS } from "../../constants/editor/menuConfig";
import { AiTool, MENU_ACTION, MenuActionId } from "../../type/editor";
import React, { useEffect, useRef, useState } from "react";

// 파일 메뉴 들어오고 나가기(PR-C)
interface IoActions{
    openExport: (tab: 'image' | 'sheet') => void;
    importImage: () => void;
    openReference: () => void;
    shareGallery: (challenge: boolean) => void;
    registerAsset: () => void;
    hasReference: boolean;
    referenceVisible: boolean;
    setReferenceVisible: React.Dispatch<React.SetStateAction<boolean>>;
}

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
    openResize: () => void;   // 크기 조절 = 오른쪽 캔버스 크기 창 열기
}

// 이미지 메뉴(PR-B) — 반전·회전은 바로, 색 조정은 조정 창을 그 탭으로 엶
type AdjustTabId = 'hsb' | 'invert' | 'gray' | 'palette' | 'outline' | 'replace';
interface ImageActions{
    transform: (op: 'flipH' | 'flipV' | 'rot90cw' | 'rot90ccw' | 'rot180') => void;
    openAdjust: (tab: AdjustTabId) => void;
    paletteLock: boolean;
    setPaletteLock: React.Dispatch<React.SetStateAction<boolean>>;
}

interface ViewActions{
    setZoomIdx: React.Dispatch<React.SetStateAction<number>>;
    showGridLines: boolean;
    setShowGridLines: React.Dispatch<React.SetStateAction<boolean>>;
    // 화면 보조 켜기·끄기(PR-A) — 켜져 있으면 메뉴에 체크 표시
    pixelCounter: boolean;
    setPixelCounter: React.Dispatch<React.SetStateAction<boolean>>;
    ratioGuide: boolean;
    setRatioGuide: React.Dispatch<React.SetStateAction<boolean>>;
    previewOpen: boolean;
    setPreviewOpen: React.Dispatch<React.SetStateAction<boolean>>;
    onionSkin: boolean;
    setOnionSkin: React.Dispatch<React.SetStateAction<boolean>>;
    fitScreen: () => void;
}

interface LayerAction{
    handleAddLayer: () => void;
    handleDeleteLayer: () => void;
    duplicateLayer: () => void;
    moveLayer: (dir: 1 | -1) => void;
    mergeLayers: (mode: 'visible' | 'flatten') => void;
}

interface PixelGuide{
    aiTool: AiTool | null;
    setAiTool: React.Dispatch<React.SetStateAction<AiTool | null>>;
}

// AI 가이드 메뉴 항목 → 패널에 보일 기능
const AI_TOOL_OF: Partial<Record<MenuActionId, AiTool>> = {
    [MENU_ACTION.AI_SHADE]: 'shade',
    [MENU_ACTION.AI_PALETTE]: 'palette',
    [MENU_ACTION.AI_TAG_COLOR]: 'tagColor',
    [MENU_ACTION.AI_CONCEPT]: 'concept',
};

interface MenuBarProps {
   fileActions: FileActions;
   editActions: EditActions;
   viewActions: ViewActions;
   layerActions: LayerAction;
   imageActions: ImageActions;
   ioActions: IoActions;
   pixelGuides: PixelGuide;
}

export default function MenuBar({
    fileActions,
    editActions,
    viewActions,
    layerActions,
    imageActions,
    ioActions,
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
    
    // 켜기·끄기 메뉴 항목의 지금 상태(체크 표시)
    const isToggleOn = (id: MenuActionId) =>
        (id === MENU_ACTION.TOGGLE_PIXEL_COUNTER && viewActions.pixelCounter)
        || (id === MENU_ACTION.TOGGLE_RATIO_GUIDE && viewActions.ratioGuide)
        || (id === MENU_ACTION.TOGGLE_PREVIEW && viewActions.previewOpen)
        || (id === MENU_ACTION.TOGGLE_ONION_SKIN && viewActions.onionSkin)
        || (id === MENU_ACTION.TOGGLE_PALETTE_LOCK && imageActions.paletteLock)
        || (id === MENU_ACTION.TOGGLE_REFERENCE && ioActions.hasReference && ioActions.referenceVisible);

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
            case MENU_ACTION.IMPORT_PROJECT:
                break;
            case MENU_ACTION.OPEN_PPIT:
                fileActions.handleOpenPpit();
                break;
            case MENU_ACTION.IMPORT_IMAGE:
                ioActions.importImage();
                break;
            case MENU_ACTION.OPEN_REFERENCE:
                ioActions.openReference();
                break;
            case MENU_ACTION.SHARE_GALLERY:
                ioActions.shareGallery(false);
                break;
            case MENU_ACTION.JOIN_CHALLENGE:
                ioActions.shareGallery(true);
                break;
            case MENU_ACTION.REGISTER_ASSET:
                ioActions.registerAsset();
                break;
            case MENU_ACTION.TOGGLE_REFERENCE:
                if (ioActions.hasReference) ioActions.setReferenceVisible(v => !v);
                else ioActions.openReference();
                break;
            case MENU_ACTION.SAVE:
                fileActions.openSaveModal();
                break;
            case MENU_ACTION.SAVE_AS:
                break;
            case MENU_ACTION.EXPORT_IMAGE:
                ioActions.openExport('image');   // 배율·형식(PNG·GIF)을 고르는 창(기존 바로 저장 대신)
                break;
            case MENU_ACTION.EXPORT_SPRITESHEET:
                ioActions.openExport('sheet');
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
                editActions.openResize();
                break;
            case MENU_ACTION.SELECT_ALL:
                break;
            case MENU_ACTION.DESELECT:
                break;
            // image
            case MENU_ACTION.FLIP_HORIZONTAL:
                imageActions.transform('flipH');
                break;
            case MENU_ACTION.FLIP_VERTICAL:
                imageActions.transform('flipV');
                break;
            case MENU_ACTION.ROTATE_90_CW:
                imageActions.transform('rot90cw');
                break;
            case MENU_ACTION.ROTATE_90_CCW:
                imageActions.transform('rot90ccw');
                break;
            case MENU_ACTION.ROTATE_180:
                imageActions.transform('rot180');
                break;
            case MENU_ACTION.ADJUST_HSB:
                imageActions.openAdjust('hsb');
                break;
            case MENU_ACTION.ADJUST_INVERT:
                imageActions.openAdjust('invert');
                break;
            case MENU_ACTION.ADJUST_GRAY:
                imageActions.openAdjust('gray');
                break;
            case MENU_ACTION.SNAP_TO_PALETTE:
                imageActions.openAdjust('palette');
                break;
            case MENU_ACTION.ADD_OUTLINE:
                imageActions.openAdjust('outline');
                break;
            case MENU_ACTION.REPLACE_COLOR:
                imageActions.openAdjust('replace');
                break;
            case MENU_ACTION.TOGGLE_PALETTE_LOCK:
                imageActions.setPaletteLock(v => !v);
                break;
            // view
            case MENU_ACTION.FIT_SCREEN:
                viewActions.fitScreen();   // 캔버스 영역 크기에 들어가는 가장 큰 배율 + 화면 이동 초기화
                break;
            case MENU_ACTION.TOGGLE_ONION_SKIN:
                viewActions.setOnionSkin(v => !v);
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
                layerActions.duplicateLayer();
                break;
            case MENU_ACTION.MOVE_UP:
                layerActions.moveLayer(1);
                break;
            case MENU_ACTION.MOVE_DOWN:
                layerActions.moveLayer(-1);
                break;
            case MENU_ACTION.MERGE_VISIBLE:
                layerActions.mergeLayers('visible');
                break;
            case MENU_ACTION.FLATTEN:
                layerActions.mergeLayers('flatten');
                break;
            
            // pixel-guide
            case MENU_ACTION.TOGGLE_PIXEL_COUNTER:
                viewActions.setPixelCounter(v => !v);
                break;
            case MENU_ACTION.TOGGLE_RATIO_GUIDE:
                viewActions.setRatioGuide(v => !v);
                break;
            case MENU_ACTION.TOGGLE_PREVIEW:
                viewActions.setPreviewOpen(v => !v);
                break;
            case MENU_ACTION.TOGGLE_GRID_SNAP:
                break;
            // AI 가이드 — 고른 기능만 패널에, 같은 기능을 다시 고르면 닫기
            case MENU_ACTION.AI_SHADE:
            case MENU_ACTION.AI_PALETTE:
            case MENU_ACTION.AI_TAG_COLOR:
            case MENU_ACTION.AI_CONCEPT: {
                const tool = AI_TOOL_OF[actionId] ?? null;
                pixelGuides.setAiTool((prev) => (prev === tool ? null : tool));
                break;
            }
        }
    };
    return(
        <div ref={menuContainerRef} className="flex items-center h-full">
            {/* 메뉴 그룹 루프 */}
            {MENU_DEFS.map(menu => (
                <div key={menu.id} className="relative h-full flex items-center">
                    <button // 상단 메뉴 버튼 설정
                        onClick={() => setOpenMenu(openMenu === menu.id ? null : menu.id)}
                        className="px-3 h-full text-sm transition-colors" 
                        style={{
                            // --color-on-surface: 색상 값을 적는 대신 의미가 부여돈 이름으로 색상 관리
                            color: openMenu === menu.id ? 'var(--color-on-surface)' : 'var(--color-on-surface)',
                            background: openMenu === menu.id ? 'var(--color-surface-container)' : 'transparent',
                        }}>
                        {getLabel(menu.label)}
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
                                ? (viewActions.showGridLines 
                                    ? {ko: '그리드 숨기기', en: 'Hide Grid'} : {ko: '그리드 표시', en: 'Show Grid'})
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
                                    <span className="flex-1" style={{ color: 'var(--color-on-surface)' }}>{getLabel(itemlabel)}</span>
                                    {(AI_TOOL_OF[item.id] ? AI_TOOL_OF[item.id] === pixelGuides.aiTool : isToggleOn(item.id)) && (
                                    <span className="material-symbols-outlined text-sm" style={{ color: 'var(--color-primary)' }}>check</span>
                                    )}
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