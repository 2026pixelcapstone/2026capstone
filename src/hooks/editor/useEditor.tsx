//import { Layer } from "konva/lib/Layer";
import { getCacheKey } from "../../utils/editorUtils";
import { editorApi, LayerSaveRequest } from "../../api/editorApi";
import { LayerData, SaveData, useEditorProps } from "../../constants/editorType";
import { toast } from "../../store/toastStore";
import { useCallback, useState } from "react";

export const useEditor = ({
    stageRef,
    layerCanvasRefs,
    canvasW,
    canvasH,
    state,
    isLoggedIn,
    setUnsaved,
    setSearchParams,
}: useEditorProps) => {
    const [isSaveModalOpen, setIsSaveModalOpen] = useState(false)
    const [projectId, setProjectId]       = useState<number | null>(null)
    const [projectTitle, setProjectTitle] = useState('Untitled Project')
    const [editingTitle, setEditingTitle] = useState(false)
    const [saving, setSaving]             = useState(false)

    // ── 프로젝트 서버 저장 로직 ──────────────────────────────────────────
    const handleSave = useCallback(async (saveData?: SaveData) => {
        if (!isLoggedIn) { toast.error('로그인이 필요합니다.'); return }
        if(saving) return;

        const canvas = stageRef.current;
        if (!canvas) return;

        const nextTitle = saveData?.title.trim() || projectTitle.trim();
        const nextIsPublic = saveData?.isPublic || false;

        if(!nextTitle){
            toast.error('프로젝트 이름을 입력해주세요');
            return;
        }

        // 현재 캔버스 데이터 저장 로직(⭐ 서버 문제가 해결되면 currentFrameData함수 다시 사용할거임 ⭐)
        /*
        const currentFrameData = canvas.toDataURL(({
            mimeType: 'image/png',
            pixelRatio: 4 // 숫자를 올릴수록 선명하고 큼직한 썸네일 PNG 파일이 추출됨
        }));
        setSaving(true);
        */
       
        // 새 프로젝트를 생성하여 프로젝트를 저장하는 로직
        try {
            let pid = projectId
            if (!pid) {
                // 새 프로젝트 생성
                const res = await editorApi.createProject({
                    title: nextTitle,
                    width: canvasW,
                    height: canvasH,
                    //backgroundColor: '',
                    isPublic: nextIsPublic,
                    thumbnailUrl: "", // ⭐ 백엔드에서 거부를 하여 "" 로 초기화 해놓음 ***
                })
                pid = res.data.data.projectId;
                setProjectId(pid);
                setSearchParams({ projectId: String(pid) }, { replace: true });
            } else {
                // 기존 프로젝트 덮어쓰기
                await editorApi.updateProject(pid, { 
                    title: nextTitle,
                    isPublic: nextIsPublic,
                    thumbnailUrl: "", // ⭐ 백엔드에서 거부를 하여 "" 로 초기화 해놓음 ***
                })
            }
            /* flatMap의 효과 -> 각 프레임 당으로 분리되어 있는 레이어를 1치원 배열로 오름차순 정렬시켜줌
            (layerOrder의 수가 리셋되는 부분을 찾아 프레임 구별) */
            const layersToSave: LayerSaveRequest[] = state.frames.flatMap((frame, fIdx) => 
                frame.layers.map((layer:LayerData): LayerSaveRequest => {
                    // 1. 혹시 모를 공백 제거 및 문자열화
                    const cleanId = String(layer.id).trim();      
                    // 2. 신규 임시 ID('layer-')이거나, 유령 문자열("null", "undefined")이거나, 빈 값인 경우를 체크
                    const isNewLayer = cleanId.startsWith('layer-') || cleanId === 'null' || cleanId === 'undefined' || !cleanId;
                    return{
                        // 임시 UUID 형태(`layer-`)면 서버에서 신규 PK를 따도록 null 처리, 기존 정수 ID면 유지
                        layerId: isNewLayer ? null : Number(cleanId),
                        name: layer.name,
                        layerOrder: layer.layerOrder, // 위에 flatMap + layerOder 조합으로 프레임 순서와 레이어 순서를 구별
                        blendMode: layer.blendMode,
                        isLocked: layer.isLocked,
                        isVisible: layer.isVisible,
                        opacity: layer.opacity,
                        // 키 저장은 안됨
                        pixelData: layerCanvasRefs.current[getCacheKey(fIdx, layer.id)]?.toDataURL('image/png') || layer.pixelData || ''
                    }
                })
            );
            await editorApi.saveLayers(pid, layersToSave);
            
            setUnsaved(false);
            toast.success('저장되었습니다.');
        } catch(error) {
            console.error("저장 중 에러 발생", error);
            toast.error('저장에 실패했습니다.');
        } finally {
            setSaving(false)
        }

  }, [isLoggedIn, saving, projectId, projectTitle, canvasW, canvasH, stageRef, setSearchParams, state.frames])

  const openSaveModal = useCallback(() => {
    if (!isLoggedIn) {
        toast.error('로그인이 필요합니다.');
        return;
    }
    setIsSaveModalOpen(true)
  }, [isLoggedIn]);

  // ── [ 컴포넌트가 사용할 무기들을 반환] ──────────────────
    return {
        isSaveModalOpen,
        setIsSaveModalOpen,
        projectId,
        setProjectId,
        projectTitle,
        setProjectTitle,
        editingTitle,
        setEditingTitle,
        saving,
        handleSave,
        openSaveModal,
        layerCanvasRefs
    };
}