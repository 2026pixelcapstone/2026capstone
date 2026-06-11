//import { Layer } from "konva/lib/Layer";
import { editorApi } from "../../api/editorApi";
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
    layers,
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

        const canvas = stageRef.current
        if (!canvas) return;

        const nextTitle = saveData?.title.trim() || projectTitle.trim();
        const nextIsPublic = saveData?.isPublic || false;

        if(!nextTitle){
            toast.error('프로젝트 이름을 입력해주세요');
            return;
        }

        // 현재 캔버스 데이터 저장 로직
        const currentFrameData = canvas.toDataURL(({
            mimeType: 'image/png',
            pixelRatio: 4 // 숫자를 올릴수록 선명하고 큼직한 썸네일 PNG 파일이 추출됨
        }));
        setSaving(true);
        
        // 새 프로젝트를 생성하여 프로젝트를 저장하는 로직
        try {
            let pid = projectId
            if (!pid) {
                // 새 프로젝트 생성
                const res = await editorApi.createProject({
                    title: nextTitle,
                    width: canvasW,
                    height: canvasH,
                    isPublic: nextIsPublic,
                    thumbnailUrl: currentFrameData,
                })
                pid = res.data.data.projectId;
                setProjectId(pid);
                setSearchParams({ projectId: String(pid) }, { replace: true });
            } else {
                // 기존 프로젝트 덮어쓰기
                await editorApi.updateProject(pid, { 
                    title: nextTitle,
                    isPublic: nextIsPublic,
                    thumbnailUrl: currentFrameData,
                })
            }

            const layersToSave = state.frames.flatMap((frame, fIdx) => 
                frame.layers.map((layer: LayerData) => ({
                    // 임시 UUID 형태(`layer-`)면 서버에서 신규 PK를 따도록 null 처리, 기존 정수 ID면 유지
                    layerId: String(layer.id).startsWith('layer-') ? null : Number(layer.id),
                    name: layer.name,
                    layerOrder: layer.layerOrder,
                    blendMode: layer.blendMode,
                    isLocked: layer.isLocked,
                    isVisible: layer.isVisible,
                    opacity: layer.opacity,
                    
                    // 💡 [중요]: 백엔드 DB 저장 규격에 맞춰 현재 프레임 인덱스(fIdx) 정보와 
                    // 해당 프레임-레이어 버퍼 캔버스의 최신 스냅샷 이미지 주소를 동적으로 바인딩합니다!
                    frameIdx: fIdx, 
                    pixelData: layerCanvasRefs.current[`frame-${fIdx}_layer-${layer.id}`]?.toDataURL('image/png') || layer.pixelData || ''
                }))
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

  }, [isLoggedIn, saving, projectId, projectTitle, canvasW, canvasH, layers, stageRef, setSearchParams])

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