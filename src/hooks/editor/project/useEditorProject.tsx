import React, { useCallback, useEffect, useRef, useState } from "react";
import { CanvasState, SaveModelData } from "../../../type/editor";
import { useEditorLoad } from "./useEditorLoad";
import { useEditorSave } from "./useEditorSave";
import { createInitialCanvasData } from "../../../constants/editor/editor";
import { toast } from "../../../store/toastStore";
import { useSearchParams } from "react-router-dom";
import Konva from "konva";


interface UseEditorProjectProps {
    isLoggedIn: boolean;
    stageRef: React.RefObject<Konva.Stage | null>;
    state: CanvasState;
    unsaved: boolean;
    setUnsaved: React.Dispatch<React.SetStateAction<boolean>>;
    setCustomW: React.Dispatch<React.SetStateAction<number>>;
    setCustomH: React.Dispatch<React.SetStateAction<number>>;
    reset: (newState: CanvasState) => void;
    setActiveFrameId: React.Dispatch<React.SetStateAction<string | null>>;
    setActiveLayerId: React.Dispatch<React.SetStateAction<string | null>>;
    resetLayerCounters: () => void;
    peekLayerCanvas: (cachekey: string) => HTMLCanvasElement | null;
    clearAllLayerCanvas: () => void;
}

export function useEditorProject({
    isLoggedIn,
    stageRef,
    state,
    unsaved,
    setUnsaved,
    setCustomW,
    setCustomH,
    reset,
    setActiveFrameId,
    setActiveLayerId,
    resetLayerCounters,
    peekLayerCanvas,
    clearAllLayerCanvas,
}: UseEditorProjectProps) {
    const [projectId, setProjectIdState] = useState<number | null>(null);
    // ID 갱신은 로드를 시작시키지 않고, URL 변경 시 중복 여부만 판단합니다.
    const currentProjectIdRef = useRef<number | null>(null);
    const loadControllerRef = useRef<AbortController | null>(null);
    const setProjectId = useCallback<React.Dispatch<React.SetStateAction<number | null>>>((value) => {
        const next = typeof value === 'function' ? value(currentProjectIdRef.current) : value;
        currentProjectIdRef.current = next;
        setProjectIdState(next);
    }, []);
    const [projectTitle, setProjectTitle] = useState('Untitled Project');
    const [isPublic, setIsPublic] = useState<boolean>(false);
    //const [editingTitle, setEditingTitle] = useState(false);
    
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false);
    
    const [searchParams, setSearchParams] = useSearchParams();
    const rawProjectId = searchParams.get('projectId');

    const {loadProject} = useEditorLoad();
    const {saving, saveProject} = useEditorSave({
        stageRef,
        peekLayerCanvas,
    });

    // ── URL 파라미터로 프로젝트 불러오기 ──────────────
    useEffect(() => {
        if (!rawProjectId || !isLoggedIn) return
        
        const numId = Number(rawProjectId);
        if (!Number.isSafeInteger(numId) || numId <= 0) return
        // 저장 결과로 URL에 현재 프로젝트 ID를 반영한 경우 재로드하지 않습니다.
        if (numId === currentProjectIdRef.current) return;

        const controller = new AbortController();
        loadControllerRef.current = controller;
        (async () => {
        try {
            const proj = await loadProject(numId, controller.signal);

            if (!proj || controller.signal.aborted) return;

            setProjectId(proj.projectId)
            setProjectTitle(proj.title)
            setCustomW(proj.width)
            setCustomH(proj.height)
            setIsPublic(proj.isPublic)
            // 1. 프레임 데이터 결정 (불러온 프레임이 있으면 사용하고, 없으면 기본 프레임 생성 또는 기존 프레임 유지)
            const framesToReset = proj.frames.length > 0 
            ? proj.frames 
            : createInitialCanvasData().frames; // 또는 prev/기존 frames 사용
            
            reset({
                frames: framesToReset,
                width: proj.width,
                height: proj.height,
            })

            setActiveFrameId(framesToReset[0]?.id ?? null);
            setActiveLayerId(framesToReset[0]?.layers[0]?.id ?? null);

            setUnsaved(false);
            toast.success('프로젝트를 성공적으로 불러왔습니다!')
        } catch {
            if (controller.signal.aborted) return;
            toast.error('프로젝트를 불러오지 못했습니다.');
        }
        })()
        return () => {
            controller.abort();
            if (loadControllerRef.current === controller) loadControllerRef.current = null;
        }
    }, [isLoggedIn, rawProjectId, loadProject, reset, setProjectId, setProjectTitle,
        setCustomW, setCustomH, setActiveFrameId, setActiveLayerId])


    // ── 프로젝트 교체 ──────────────
    const replaceProject = useCallback((canvasData: CanvasState, title: string) => {
        const firstFrame = canvasData.frames[0];
        const firstLayer = firstFrame?.layers[0];
        setActiveFrameId(firstFrame?.id ?? null);
        setActiveLayerId(firstLayer?.id ?? null);
    
        reset(canvasData);
    
        setProjectId(null);  // 불러온 .ppit은 새 작업(저장된 프로젝트 아님)
        setProjectTitle(title || 'Untitled Project');
        setIsPublic(false);
        setUnsaved(true);
    
        // 새 작업이므로 URL의 projectId 제거 (새로고침 시 옛 서버 프로젝트 재로드 방지)
        setSearchParams(prev => {
          const p = new URLSearchParams(prev)
          p.delete('projectId')
          return p
        }, { replace: true });
        
        setCustomW(canvasData.width);
        setCustomH(canvasData.height);
        
        // 캔버스·히스토리·프로젝트 정보 등 초기화
    }, [setActiveFrameId, setActiveLayerId, setProjectId, setProjectTitle, setUnsaved, setSearchParams, setCustomW, setCustomH]);


    // ── 새 프로젝트 ───────────────────────────────────
    const handleNewProject = useCallback(() => {
        if (unsaved && !confirm('저장되지 않은 변경사항이 있습니다. 계속하시겠습니까?')) return
        
        loadControllerRef.current?.abort();
        loadControllerRef.current = null;
        const defaultCanvasData = createInitialCanvasData();
        // 히스토리 초기화
        reset({
            frames: [defaultCanvasData.frames[0]], // 기본 프레임 하나만 생성
            width: defaultCanvasData.width,
            height: defaultCanvasData.height,
        });
    
        setActiveFrameId(defaultCanvasData.frames[0].id)
        setActiveLayerId(defaultCanvasData.frames[0].layers[0].id);
        resetLayerCounters();
        clearAllLayerCanvas(); // 메모리 상에 남아있던 이전 프로젝트의 캔버스 이미지 버퍼 캐시를 전부 청소함
    
        // 기타 메타데이터 및 URL 초기화
        setProjectId(null);
        setProjectTitle('Untitled Project');
        setIsPublic(false);
        setUnsaved(false);
        // URL에 남은 projectId 쿼리 파라미터 제거
        setSearchParams({}, { replace: true });
    }, [unsaved, setUnsaved, setSearchParams, setActiveFrameId, setActiveLayerId, reset, resetLayerCounters, clearAllLayerCanvas, setProjectId])

    // 저장된 프로젝트 열기 (모달에서 선택) → URL projectId로 로드 effect 트리거
    const openProject = useCallback((pid: number) => {
        if (pid !== projectId &&
            unsaved && !window.confirm('저장하지 않은 변경사항이 있습니다. 불러오면 현재 작업이 사라집니다. 계속할까요?')) {
          return false;
        }
        setSearchParams({ projectId: String(pid) }, { replace: true })
        return true;
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [projectId, unsaved, setSearchParams])


    //  ── 프로젝트 저장 ───────────────────────────────────
    const handleSave = useCallback(async (saveModelData: SaveModelData) => {
        if (!isLoggedIn) { 
            toast.error('로그인이 필요합니다.'); 
            return;
        }
        const nextTitle = saveModelData?.title.trim() || projectTitle.trim();
        const isNextPublic = saveModelData?.isPublic || false;

        if (!nextTitle) {
            toast.error('프로젝트 이름을 입력해주세요');
            return; // 여기서는 아직 setSaving(true) 전이므로 안전하게 탈출합니다.
        }
        if (saving) return;
        toast.info('저장중...');

        try{
            const result = await saveProject(
                projectId,
                state,
                nextTitle,
                isNextPublic,
            );

            if(!result){ return; }      
                  
            setProjectId(result.projectId);
            setSearchParams(prev => {
                const next = new URLSearchParams(prev);
                next.set('projectId', String(result.projectId));
                return next;
            }, { replace: true });
            setProjectTitle(result.title);
            setIsPublic(result.isPublic);
            setUnsaved(false);
            toast.success('성공적으로 저장되었습니다.');
        }
        catch(error){
            console.error("저장 중 에러 발생", error);
            toast.error('저장에 실패했습니다.');
        }
    }, [isLoggedIn, saving, saveProject, projectId, state, projectTitle, setSearchParams])

    const openSaveModal = useCallback(() => {
        if (!isLoggedIn) {
            toast.error('로그인이 필요합니다.');
            return;
        }
        setIsSaveModalOpen(true);
    }, [isLoggedIn]);

    return { 
        projectId, 
        projectTitle,
        saving,
        isPublic,
        isSaveModalOpen, 
        setProjectTitle,
        setIsSaveModalOpen, 
        handleNewProject, 
        handleSave,
        openProject,
        openSaveModal,
        replaceProject,
    };
}
