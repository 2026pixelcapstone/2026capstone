import { MENU_ACTION, MENU_GROUP_ID, MenuGroup } from "../../type/editorType";

  // ── 메뉴 정의 (actions can reference state) ──
  export const MENU_DEFS: MenuGroup[] = [
    {
      id: MENU_GROUP_ID.FILE, 
      label: 'File',
      items: [
        { id: MENU_ACTION.NEW_PROJECT, label: 'New Project', icon: 'add', shortcut: 'Ctrl+N'},
        { id: MENU_ACTION.OPEN_PROJECT, label: 'Open Project…', icon: 'folder' },
        { id: MENU_ACTION.OPEN_PPIT, label: 'Open .ppit…',       icon: 'folder_open'},
        { separator: true },
        { id: MENU_ACTION.SAVE, label: 'Save', icon: 'save', shortcut: 'Ctrl+S' },
        //{ label: 'Save As…',          icon: 'save_as',       shortcut: 'Ctrl+Shift+S' },
        { id: MENU_ACTION.BROWSER_SAVE, label: 'Browser Save', icon: 'open_in_browser', shortcut: 'Ctrl + Shift + S'},
        { separator: true },
        { id: MENU_ACTION.EXPORT_IMAGE, label: 'Export Image', icon: 'image' },
        { id: MENU_ACTION.EXPORT_SPRITESHEET, label: 'Export Spritesheet', icon: 'grid_on' },
        { id: MENU_ACTION.DOWNLOAD_PPIT, label: 'Download .ppit', icon: 'download' },
        { separator: true },
        { id: MENU_ACTION.BACK_TO_MAIN, label: 'Back to Main', icon: 'arrow_back' },
      ],
    },
    {
      id: MENU_GROUP_ID.EDIT, 
      label: 'Edit',
      items: [
        { id: MENU_ACTION.UNDO, label: 'Undo', icon: 'undo', shortcut: 'Ctrl+Z' },
        { id: MENU_ACTION.REDO, label: 'Redo', icon: 'redo', shortcut: 'Ctrl+Y' },
        { separator: true },
        { id: MENU_ACTION.CUT, label: 'Cut', icon: 'content_cut',  shortcut: 'Ctrl+X' },
        { id: MENU_ACTION.COPY, label: 'Copy', icon: 'content_copy', shortcut: 'Ctrl+C' },
        { id: MENU_ACTION.PASTE, label: 'Paste', icon: 'content_paste',shortcut: 'Ctrl+V' },
        { id: MENU_ACTION.RESIZE, label: 'RESIZE', icon: 'crop', shortcut: 'Ctrl + Alt + C'},
        { separator: true },
        { id: MENU_ACTION.SELECT_ALL, label: 'Select All', icon: 'select_all', shortcut: 'Ctrl+A' },
        { id: MENU_ACTION.DESELECT, label: 'Deselect',   icon: 'deselect',     shortcut: 'Ctrl+D' },
      ],
    },
    {
      id: MENU_GROUP_ID.IMAGE, 
      label: 'Image',
      items: [
        /*
        { label: 'Canvas Size…',     icon: 'crop',      action: () => {} },
        ...CANVAS_PRESETS.map(p => ({
          label: p,
          action: () => {
            const [w, h] = p.split('×').map(Number)
            applyCanvasSize(w, h)
          },
        })),*/
        { separator: true },
        { id: MENU_ACTION.FLIP_HORIZONTAL, label: 'Flip Horizontal', icon: 'flip' },
        { id: MENU_ACTION.FLIP_VERTICAL, label: 'Flip Vertical', icon: 'flip', },
        { id: MENU_ACTION.ROTATE_90_CW, label: 'Rotate 90° CW', icon: 'rotate_right' },
      ],
    },
    {
      id: MENU_GROUP_ID.VIEW,
      label: 'View',
      items: [
        { id: MENU_ACTION.FIT_SCREEN, label: 'Fit Screen', icon: 'fit_screen' },
        //{ id: '100%', label: '100%', icon: 'crop_free' },
        { separator: true },
        { id: MENU_ACTION.TOGGLE_GRID, label: 'Show Grid', icon: 'grid_on' }, // UI에서 상태에 따라 Hide/Show 매핑
      ],
    },
    {
      id: MENU_GROUP_ID.LAYER, 
      label: 'Layer',
      items: [
        { id: MENU_ACTION.ADD_LAYER,label: 'Add Layer', icon: 'add' },
        { id: MENU_ACTION.DELETE_LAYER, label: 'Delete Layer', icon: 'delete' },
        { id: MENU_ACTION.DUPLICATE, label: 'Duplicate', icon: 'copy_all' },
        { separator: true },
        { id: MENU_ACTION.MOVE_UP, label: 'Move Up', icon: 'arrow_upward' },
        { id: MENU_ACTION.MOVE_DOWN, label: 'Move Down', icon: 'arrow_downward' },
        { separator: true },
        { id: MENU_ACTION.MERGE_VISIBLE, label: 'Merge Visible',icon: 'merge' },
        { id: MENU_ACTION.FLATTEN, label: 'Flatten', icon: 'layers_clear' },
      ],
    },
    {
      id: MENU_GROUP_ID.AI_ASSISTANT, 
      label: 'AI Assistant',
      items:[
        {id: MENU_ACTION.AI_GUIDE, label: 'AI Guide', icon: 'auto_awesome'},
      ],
    },
  ]