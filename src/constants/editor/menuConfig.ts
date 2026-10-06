import { MENU_ACTION, MENU_GROUP_ID, MenuGroup } from "../../type/editor";

  // ── 메뉴 정의 (actions can reference state) ──
export const MENU_DEFS: MenuGroup[] = [
  {
    id: MENU_GROUP_ID.FILE,
    label: { ko: '파일', en: 'File' },
    items: [
      { id: MENU_ACTION.NEW_PROJECT, label: { ko: '새 프로젝트', en: 'New Project' }, icon: 'add', shortcut: 'Ctrl+N' },
      { id: MENU_ACTION.OPEN_PROJECT, label: { ko: '프로젝트 열기…', en: 'Open Project…' }, icon: 'folder' },
      { id: MENU_ACTION.OPEN_PPIT, label: { ko: '.ppit 파일 열기…', en: 'Open .ppit…' }, icon: 'folder_open' },
      { separator: true },
      { id: MENU_ACTION.SAVE, label: { ko: '저장', en: 'Save' }, icon: 'save', shortcut: 'Ctrl+S' },
      { id: MENU_ACTION.BROWSER_SAVE, label: { ko: '브라우저에 저장', en: 'Browser Save' }, icon: 'open_in_browser', shortcut: 'Ctrl + Shift + S' },
      { separator: true },
      { id: MENU_ACTION.EXPORT_IMAGE, label: { ko: '이미지 내보내기', en: 'Export Image' }, icon: 'image' },
      { id: MENU_ACTION.EXPORT_SPRITESHEET, label: { ko: '스프라이트시트 내보내기', en: 'Export Spritesheet' }, icon: 'grid_on' },
      { id: MENU_ACTION.DOWNLOAD_PPIT, label: { ko: '.ppit 다운로드', en: 'Download .ppit' }, icon: 'download' },
      { separator: true },
      { id: MENU_ACTION.BACK_TO_MAIN, label: { ko: '메인으로 돌아가기', en: 'Back to Main' }, icon: 'arrow_back' },
    ],
  },

  {
    id: MENU_GROUP_ID.EDIT,
    label: { ko: '편집', en: 'Edit' },
    items: [
      { id: MENU_ACTION.UNDO, label: { ko: '실행 취소', en: 'Undo' }, icon: 'undo', shortcut: 'Ctrl+Z' },
      { id: MENU_ACTION.REDO, label: { ko: '다시 실행', en: 'Redo' }, icon: 'redo', shortcut: 'Ctrl+Y' },
      { separator: true },
      { id: MENU_ACTION.CUT, label: { ko: '잘라내기', en: 'Cut' }, icon: 'content_cut', shortcut: 'Ctrl+X' },
      { id: MENU_ACTION.COPY, label: { ko: '복사', en: 'Copy' }, icon: 'content_copy', shortcut: 'Ctrl+C' },
      { id: MENU_ACTION.PASTE, label: { ko: '붙여넣기', en: 'Paste' }, icon: 'content_paste', shortcut: 'Ctrl+V' },
      { id: MENU_ACTION.RESIZE, label: { ko: '크기 조절', en: 'Resize' }, icon: 'crop', shortcut: 'Ctrl + Alt + C' },
      { separator: true },
      { id: MENU_ACTION.SELECT_ALL, label: { ko: '모두 선택', en: 'Select All' }, icon: 'select_all', shortcut: 'Ctrl+A' },
      { id: MENU_ACTION.DESELECT, label: { ko: '선택 해제', en: 'Deselect' }, icon: 'deselect', shortcut: 'Ctrl+D' },
    ],
  },

  {
    id: MENU_GROUP_ID.IMAGE,
    label: { ko: '이미지', en: 'Image' },
    items: [
      { separator: true },
      { id: MENU_ACTION.FLIP_HORIZONTAL, label: { ko: '좌우 반전', en: 'Flip Horizontal' }, icon: 'flip' },
      { id: MENU_ACTION.FLIP_VERTICAL, label: { ko: '상하 반전', en: 'Flip Vertical' }, icon: 'flip' },
      { id: MENU_ACTION.ROTATE_90_CW, label: { ko: '시계방향 90° 회전', en: 'Rotate 90° CW' }, icon: 'rotate_right' },
    ],
  },

  {
    id: MENU_GROUP_ID.VIEW,
    label: { ko: '보기', en: 'View' },
    items: [
      { id: MENU_ACTION.TOGGLE_PIXEL_COUNTER, label: { ko: '픽셀 카운터', en: 'Pixel Counter' }, icon: 'straighten' },
      { id: MENU_ACTION.TOGGLE_RATIO_GUIDE, label: { ko: '비율 가이드', en: 'Ratio Guide' }, icon: 'aspect_ratio' },
      { id: MENU_ACTION.TOGGLE_GRID_SNAP, label: { ko: '그리드 스냅', en: 'Grid Snap' }, icon: 'grid_goldenratio' },
      { id: MENU_ACTION.FIT_SCREEN, label: { ko: '화면에 맞추기', en: 'Fit Screen' }, icon: 'fit_screen' },
      { separator: true },
      { id: MENU_ACTION.TOGGLE_GRID, label: { ko: '그리드 표시', en: 'Show Grid' }, icon: 'grid_on' },
    ],
  },

  {
    id: MENU_GROUP_ID.LAYER,
    label: { ko: '레이어', en: 'Layer' },
    items: [
      { id: MENU_ACTION.ADD_LAYER, label: { ko: '레이어 추가', en: 'Add Layer' }, icon: 'add' },
      { id: MENU_ACTION.DELETE_LAYER, label: { ko: '레이어 삭제', en: 'Delete Layer' }, icon: 'delete' },
      { id: MENU_ACTION.DUPLICATE, label: { ko: '레이어 복제', en: 'Duplicate' }, icon: 'copy_all' },
      { separator: true },
      { id: MENU_ACTION.MOVE_UP, label: { ko: '위로 이동', en: 'Move Up' }, icon: 'arrow_upward' },
      { id: MENU_ACTION.MOVE_DOWN, label: { ko: '아래로 이동', en: 'Move Down' }, icon: 'arrow_downward' },
      { separator: true },
      { id: MENU_ACTION.MERGE_VISIBLE, label: { ko: '보이는 레이어 병합', en: 'Merge Visible' }, icon: 'merge' },
      { id: MENU_ACTION.FLATTEN, label: { ko: '이미지 병합(배경화)', en: 'Flatten' }, icon: 'layers_clear' },
    ],
  },

  {
    id: MENU_GROUP_ID.DRAWING_GUIDE,
    label: { ko: 'AI 가이드', en: 'AI Guide' },
    items: [
      { id: MENU_ACTION.TOGGLE_AI_GUIDE, label: { ko: 'AI 가이드', en: 'AI Guide' }, icon: 'auto_awesome' },
    ],
  },
];