//import { Layer } from "konva/lib/Layer";
import { getCacheKey } from "../../utils/editorUtils";
import { editorApi, LayerSaveRequest } from "../../api/editorApi";
import { LayerData, SaveData, useEditorProps } from "../../constants/editorType";
import { toast } from "../../store/toastStore";
import { useCallback, useState } from "react";
import axios from "axios";

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
        
        try{
            // ── [1단계] 이미지들을 담을 FormData 장바구니 준비 ────────────────
            const uploadFormData = new FormData();
            // 백엔드 @RequestParam("folder") 값 세팅
            uploadFormData.append("folder", "pixel-art");

            const thumDataURL = canvas.toDataURL({
                mimeType: 'image/webp', // png -> webp로 변경
                quality: 0.7, // 0.7은 70% 압축
                pixelRatio: 1 // 숫자를 올릴수록 선명하고 큼직한 썸네일 PNG 파일이 추출됨(크기 때문에 1~2배율로 변경)
            });
            const thumbResponse = await fetch(thumDataURL);
            const thumbnailBlob = await thumbResponse.blob();

            // 백엔드 @RequestParam("files") 이름과 매칭
            uploadFormData.append('files', thumbnailBlob, 'thumbnail.webp');

            // ② 모든 레이어를 순회하며 WebP Blob 생성 후 추가
            // 💡 중요: FormData에 집어넣는 순서가 나중에 결과 URL 배열의 순서가 됩니다.
            for(const [fIdx, frame] of state.frames.entries()){
                for(const layer of frame.layers){
                    const layerCanvas = layerCanvasRefs.current[getCacheKey(fIdx, layer.id)];
                    if(layerCanvas){
                        const layerDataURL = layerCanvas.toDataURL('image/webp', 0.6);

                        const layerResponse = await fetch(layerDataURL);
                        const layerBlob = await layerResponse.blob();
                        
                        // 다건 파일이므로 똑같이 'files'라는 키에 순서대로 push
                        uploadFormData.append('files', layerBlob, `layer_${fIdx}_${layer.id}.webp`);
                    }
                }
            }
            // ── [2단계] R2 대량 업로드 API 호출 ──────────────────────────────
            const uploadRes = await axios.post("/api/files/upload/bulk", uploadFormData, {
                headers: { "Content-Type": "multipart/form-data" }
            });

            // 백엔드 공통 응답 규격(ApiResponse.success)에 맞춰 결과 배열 구조 분해 할당
            // 첫 번째가 썸네일 주소, 나머지가 순서대로 레이어 주소 리스트가 됩니다.
            const [uploadedThumbUrl, ...uploadedLayerUrls] = uploadRes.data.data;
            
            // ── [3단계] 기존 JSON 저장 API에 R2 주소 매핑하여 쏘기 ──────────────
            let pid = projectId;
            if (!pid) {
                // 새 프로젝트 생성
                const res = await editorApi.createProject({
                    title: nextTitle,
                    width: canvasW,
                    height: canvasH,
                    isPublic: nextIsPublic,
                    thumbnailUrl: uploadedThumbUrl // 👑 드디어 공백이 아닌 실제 R2 주소를 주입!
                });
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

            // 레이어 DTO 리스트 매핑
            let urlIdx = 0;
            const layersToSave: LayerSaveRequest[] = state.frames.flatMap((frame) => 
                frame.layers.map((layer: LayerData): LayerSaveRequest => {
                    const cleanId = String(layer.id).trim();      
                    const isNewLayer = cleanId.startsWith('layer-') || cleanId === 'null' || cleanId === 'undefined' || !cleanId;
                    
                    return {
                        layerId: isNewLayer ? null : Number(cleanId),
                        name: layer.name,
                        layerOrder: layer.layerOrder, 
                        blendMode: layer.blendMode,
                        isLocked: layer.isLocked,
                        isVisible: layer.isVisible,
                        opacity: layer.opacity,
                        fileUrl: uploadedLayerUrls[urlIdx++], // 👑 R2 이미지 주소 할당!
                        pixelData: "" // 👑 150만 자 제한 폭탄이던 고질적인 데이터 필드는 과감히 빈 값 처리!
                    };
                })
            );
            
            // 레이어 데이터 최종 저장
            await editorApi.saveLayers(pid, layersToSave);

            setUnsaved(false);
            toast.success('성공적으로 저장되었습니다.');
        }
        catch(error){
            console.error("저장 중 에러 발생", error);
            toast.error('저장에 실패했습니다.');
        }
        finally{
            setSaving(false);
        }

  }, [isLoggedIn, saving, projectId, projectTitle, canvasW, canvasH, stageRef, setSearchParams, state.frames, layerCanvasRefs])

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